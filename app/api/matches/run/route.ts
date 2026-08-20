import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  SearchCooldownError,
  searchAndMatchForUser,
  type JobSearchTrigger
} from '@/lib/user-job-search'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const supabase = createClient()

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json().catch(() => ({})) as {
      trigger?: JobSearchTrigger
    }

    const trigger: JobSearchTrigger =
      body.trigger === 'resume_upload' ? 'resume_upload' : 'manual'

    const metrics = await searchAndMatchForUser(
      supabase,
      user.id,
      trigger
    )

    return NextResponse.json({ ok: true, ...metrics })
  } catch (error) {
    if (error instanceof SearchCooldownError) {
      return NextResponse.json(
        {
          error: error.message,
          retryAfterSeconds: error.retryAfterSeconds
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(error.retryAfterSeconds)
          }
        }
      )
    }

    const message =
      error instanceof Error
        ? error.message
        : 'Could not search for jobs.'

    console.error('[job-search-route]', error)

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
