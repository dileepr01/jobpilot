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

type EdgeResult = {
  ok?: boolean
  error?: string
  changed?: boolean
  changedFields?: string[]
  message?: string
}

type EdgePayload = {
  error?: string
  results?: EdgeResult[]
}

async function authenticatedSession() {
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
  return { accessToken: session.access_token }
}

async function invokeNaukri(
  accessToken: string,
  body: Record<string, unknown>
) {
  const { url } = getPublicEnv()
  const response = await fetch(`${url}/functions/v1/naukri-sync`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(body),
    cache: 'no-store'
  })

  const payload = (await response.json().catch(() => ({}))) as EdgePayload

  if (!response.ok) {
    throw new Error(payload.error || 'Could not reach the Naukri sync service.')
  }

  return payload
}

export async function POST(request: Request) {
  try {
    const auth = await authenticatedSession()
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = connectSchema.parse(await request.json())
    const sync = await invokeNaukri(auth.accessToken, {
      action: 'connect',
      username: body.username,
      password: body.password,
      profileId: body.profileId || null,
      consent: body.consent
    })
    const first = sync.results?.[0]

    return NextResponse.json({
      ok: true,
      syncOk: first?.ok === true,
      syncError: first?.error || null,
      syncMessage: first?.message || null,
      changedFields: first?.changedFields || []
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not connect Naukri.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function PUT() {
  try {
    const auth = await authenticatedSession()
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sync = await invokeNaukri(auth.accessToken, { action: 'sync' })
    const first = sync.results?.[0]

    if (first && first.ok === false) {
      return NextResponse.json(
        { error: first.error || 'Naukri profile tune-up failed.' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      ok: true,
      syncMessage: first?.message || 'Naukri profile checked successfully.',
      changedFields: first?.changedFields || []
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Naukri profile tune-up failed.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await authenticatedSession()
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = settingsSchema.parse(await request.json())
    await invokeNaukri(auth.accessToken, {
      action: 'toggle',
      enabled: body.enabled
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not update Naukri Auto Tune-up.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function DELETE() {
  try {
    const auth = await authenticatedSession()
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await invokeNaukri(auth.accessToken, { action: 'disconnect' })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not disconnect Naukri.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
