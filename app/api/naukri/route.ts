import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getPublicEnv } from '@/lib/env'

export const runtime = 'nodejs'
export const maxDuration = 60

const connectSchema = z.object({
  username: z.string().trim().min(3).max(320),
  password: z.string().min(4).max(500),
  profileId: z.string().trim().max(200).optional().default(''),
  consent: z.literal(true)
})

const settingsSchema = z.object({
  enabled: z.boolean()
})

async function authenticatedClient() {
  const supabase = createClient()
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser()

  if (userError || !user) return null

  const {
    data: { session }
  } = await supabase.auth.getSession()

  if (!session?.access_token) return null
  return { supabase, user, accessToken: session.access_token }
}

async function invokeSync(accessToken: string) {
  const { url } = getPublicEnv()
  const response = await fetch(`${url}/functions/v1/naukri-sync`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ mode: 'manual' }),
    cache: 'no-store'
  })

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string
    results?: Array<{ ok?: boolean; error?: string }>
  }

  if (!response.ok) {
    throw new Error(payload.error || 'Could not reach the Naukri sync service.')
  }

  return payload
}

export async function POST(request: Request) {
  try {
    const auth = await authenticatedClient()
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = connectSchema.parse(await request.json())
    const { error } = await auth.supabase.rpc('save_naukri_connection', {
      p_username: body.username,
      p_password: body.password,
      p_profile_id: body.profileId || null
    })

    if (error) throw error

    const sync = await invokeSync(auth.accessToken)
    const first = sync.results?.[0]

    return NextResponse.json({
      ok: true,
      syncOk: first?.ok === true,
      syncError: first?.error || null
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not connect Naukri.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function PUT() {
  try {
    const auth = await authenticatedClient()
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sync = await invokeSync(auth.accessToken)
    const first = sync.results?.[0]

    if (first && first.ok === false) {
      return NextResponse.json(
        { error: first.error || 'Naukri refresh failed.' },
        { status: 400 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Naukri refresh failed.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await authenticatedClient()
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = settingsSchema.parse(await request.json())
    const { error } = await auth.supabase.rpc('set_naukri_auto_refresh', {
      p_enabled: body.enabled
    })

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not update Naukri Auto Refresh.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE() {
  try {
    const auth = await authenticatedClient()
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await auth.supabase.rpc('disconnect_naukri')
    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not disconnect Naukri.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
