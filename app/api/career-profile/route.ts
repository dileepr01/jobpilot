import { NextResponse } from 'next/server'
import {
  buildMatchingProfileText,
  refreshCareerProfile
} from '@/lib/career-profile'
import { embedText } from '@/lib/hf'
import { createClient } from '@/lib/supabase/server'
import type { JobPreferences, ParsedResume } from '@/lib/types'

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

    if (profile.source !== 'user') {
      const { data: source, error: sourceError } = await supabase
        .from('profiles')
        .select('resume_text, parsed_resume, preferences')
        .eq('user_id', user.id)
        .single()

      if (sourceError) throw sourceError

      const matchingText = buildMatchingProfileText({
        resumeText: source.resume_text,
        parsedResume: (source.parsed_resume || {}) as ParsedResume,
        careerProfile: profile,
        preferences: (source.preferences || {}) as JobPreferences
      })

      if (matchingText.trim()) {
        const embedding = await embedText(matchingText)
        const { error: embeddingError } = await supabase
          .from('profiles')
          .update({ resume_embedding: embedding })
          .eq('user_id', user.id)

        if (embeddingError) throw embeddingError
      }
    }

    const { error: eventError } = await supabase
      .from('career_profile_events')
      .insert({
        user_id: user.id,
        event_type: 'profile_refresh',
        changed_fields: ['ai_profile_intelligence'],
        search_triggered: false
      })

    if (eventError) console.error('[career-profile-refresh-event]', eventError.message)

    return NextResponse.json({ ok: true, profile })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not refresh Career Profile intelligence.'
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
    const message = error instanceof Error ? error.message : 'Could not update Career Profile intelligence settings.'
    console.error('[career-profile-settings]', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
