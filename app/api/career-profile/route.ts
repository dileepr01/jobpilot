import { NextResponse } from 'next/server'
import { refreshCareerProfile } from '@/lib/career-profile'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST() {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await refreshCareerProfile(supabase, user.id)
    return NextResponse.json({ ok: true, profile })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not refresh Career Insights.'
    console.error('[career-profile-refresh]', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({})) as { enabled?: boolean }
    if (typeof body.enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 })
    }

    const { error } = await supabase
      .from('profiles')
      .update({ auto_career_profile: body.enabled })
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ ok: true, enabled: body.enabled })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not update Career Insights settings.'
    console.error('[career-profile-settings]', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
