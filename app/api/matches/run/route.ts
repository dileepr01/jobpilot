import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { scoreJob } from '@/lib/score'
import type { JobPreferences, JobRecord } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST() {
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

    const admin = createAdminClient()

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('preferences, resume_embedding')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile?.resume_embedding) {
      return NextResponse.json(
        { error: 'Complete your matching profile first.' },
        { status: 400 }
      )
    }

    const { data: candidates, error: candidateError } =
      await admin.rpc('match_jobs_for_profile', {
        p_user_id: user.id,
        p_limit: 200
      })

    if (candidateError) {
      throw candidateError
    }

    const candidateRows = candidates || []
    const jobIds = candidateRows.map(
      (candidate: { job_id: string }) => candidate.job_id
    )

    if (!jobIds.length) {
      return NextResponse.json({
        ok: true,
        matches: 0,
        strong: 0,
        potential: 0,
        stretch: 0
      })
    }

    const { data: jobs, error: jobsError } = await admin
      .from('jobs')
      .select('*')
      .in('id', jobIds)

    if (jobsError) {
      throw jobsError
    }

    const similarities = new Map<string, number>(
      candidateRows.map(
        (candidate: {
          job_id: string
          semantic_similarity: number
        }) => [
          String(candidate.job_id),
          Number(candidate.semantic_similarity)
        ]
      )
    )

    const preferences =
      (profile.preferences || {}) as JobPreferences

    const scored = ((jobs || []) as unknown as JobRecord[])
      .map((job) => ({
        job,
        breakdown: scoreJob(
          job,
          preferences,
          similarities.get(job.id) ?? 0
        )
      }))
      .sort(
        (left, right) =>
          right.breakdown.total - left.breakdown.total
      )
      .slice(0, 100)

    if (!scored.length) {
      return NextResponse.json({
        ok: true,
        matches: 0,
        strong: 0,
        potential: 0,
        stretch: 0
      })
    }

    const { error: matchError } = await admin
      .from('matches')
      .upsert(
        scored.map(({ job, breakdown }) => ({
          user_id: user.id,
          job_id: job.id,
          score: breakdown.total,
          score_breakdown: breakdown
        })),
        { onConflict: 'user_id,job_id' }
      )

    if (matchError) {
      throw matchError
    }

    const scores = scored.map((item) => item.breakdown.total)

    return NextResponse.json({
      ok: true,
      matches: scores.length,
      strong: scores.filter((score) => score >= 80).length,
      potential: scores.filter(
        (score) => score >= 50 && score < 80
      ).length,
      stretch: scores.filter((score) => score < 50).length
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Could not generate matches.'

    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
