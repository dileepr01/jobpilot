import pLimit from 'p-limit'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchAllJobSources } from '@/lib/job-sources'
import type { DiscoveredJob, FollowedSource } from '@/lib/job-sources/types'
import { embedText } from '@/lib/hf'
import { getServerEnv } from '@/lib/env'
import { hashText } from '@/lib/utils'
import { scoreJob } from '@/lib/score'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  CareerProfileData,
  JobPreferences,
  JobRecord
} from '@/lib/types'

export type JobSearchTrigger = 'resume_upload' | 'manual' | 'profile_change'

const SEARCH_COOLDOWN_MS = 20_000
const MAX_JOBS_PER_SOURCE = 18
const MAX_JOBS_PER_SEARCH = 108

export class SearchCooldownError extends Error {
  retryAfterSeconds: number

  constructor(retryAfterSeconds: number) {
    super(`Please wait ${retryAfterSeconds} seconds before searching again.`)
    this.name = 'SearchCooldownError'
    this.retryAfterSeconds = retryAfterSeconds
  }
}

function parseVector(value: unknown): number[] | null {
  if (Array.isArray(value)) return value.map(Number)
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as number[]
    } catch {
      const trimmed = value.trim()
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        const parsed = trimmed
          .slice(1, -1)
          .split(',')
          .map((item) => Number(item.trim()))
        return parsed.every(Number.isFinite) ? parsed : null
      }
      return null
    }
  }
  return null
}

function vectorLiteral(value: number[] | null) {
  return value ? `[${value.join(',')}]` : null
}

function safeDate(value?: string) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function selectBalancedJobs(jobs: DiscoveredJob[]) {
  const sorted = [...jobs].sort((left, right) => {
    const leftTime = left.postedAt ? Date.parse(left.postedAt) : 0
    const rightTime = right.postedAt ? Date.parse(right.postedAt) : 0
    return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime)
  })

  const counts = new Map<string, number>()
  const selected: DiscoveredJob[] = []

  for (const job of sorted) {
    const count = counts.get(job.source) || 0
    if (count >= MAX_JOBS_PER_SOURCE) continue
    counts.set(job.source, count + 1)
    selected.push(job)
    if (selected.length >= MAX_JOBS_PER_SEARCH) break
  }

  return selected
}

async function embeddingFor(text: string) {
  return embedText(text)
}

async function storeJob(admin: SupabaseClient, job: DiscoveredJob) {
  const descriptionHash = hashText(job.description)
  const { data: existing } = await admin
    .from('jobs')
    .select('id, description_hash, embedding')
    .eq('source', job.source)
    .eq('external_id', job.externalId)
    .maybeSingle()

  const unchanged =
    existing?.description_hash === descriptionHash &&
    parseVector(existing.embedding)?.length === 384

  const embedding = unchanged
    ? parseVector(existing.embedding)
    : await embeddingFor(
        `${job.title}\n${job.company}\n${job.location || ''}\n${job.description}`
      )

  const payload = {
    source: job.source,
    external_id: job.externalId,
    external_url: job.externalUrl,
    title: job.title,
    company: job.company,
    location: job.location || null,
    work_mode: job.workMode || null,
    salary_min: job.salaryMin || null,
    salary_max: job.salaryMax || null,
    salary_currency: job.salaryCurrency || null,
    description: job.description,
    description_hash: descriptionHash,
    embedding: vectorLiteral(embedding),
    posted_at: safeDate(job.postedAt),
    last_seen_at: new Date().toISOString(),
    metadata: job.metadata || {}
  }

  const { data, error } = await admin
    .from('jobs')
    .upsert(payload, { onConflict: 'source,external_id' })
    .select('id')
    .single()

  if (error) {
    console.error('[store-job]', job.source, job.externalId, error.message)
    return null
  }

  return data.id as string
}

async function enforceCooldown(supabase: SupabaseClient, userId: string) {
  const { data: recent, error } = await supabase
    .from('job_search_runs')
    .select('started_at')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!recent?.started_at) return

  const elapsed = Date.now() - new Date(recent.started_at).getTime()
  if (elapsed >= SEARCH_COOLDOWN_MS) return

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((SEARCH_COOLDOWN_MS - elapsed) / 1000)
  )
  throw new SearchCooldownError(retryAfterSeconds)
}

async function sendSearchNotifications(
  userId: string,
  profile: {
    email_digest_enabled?: boolean
    telegram_enabled?: boolean
    telegram_chat_id?: string | null
  },
  scored: Array<{
    job: JobRecord
    breakdown: ReturnType<typeof scoreJob>
  }>
) {
  const env = getServerEnv()

  if (profile.email_digest_enabled) {
    try {
      const response = await fetch(
        `${env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-digest`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: env.SUPABASE_SERVICE_ROLE_KEY
          },
          body: JSON.stringify({ userId })
        }
      )
      if (!response.ok) console.error('[search-email]', await response.text())
    } catch (error) {
      console.error('[search-email]', error)
    }
  }

  if (
    profile.telegram_enabled &&
    profile.telegram_chat_id &&
    process.env.TELEGRAM_BOT_TOKEN
  ) {
    const top = scored
      .filter((item) => item.breakdown.bucket === 'apply_now')
      .slice(0, 5)

    if (top.length) {
      const text = [
        '🚀 JobPilot Apply Now opportunities',
        ...top.map(
          ({ job, breakdown }) =>
            `${Math.round(breakdown.total)} — ${job.title} at ${job.company}\n${job.external_url}`
        )
      ].join('\n\n')

      try {
        const response = await fetch(
          `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: profile.telegram_chat_id,
              text,
              disable_web_page_preview: true
            })
          }
        )
        if (!response.ok) console.error('[search-telegram]', await response.text())
      } catch (error) {
        console.error('[search-telegram]', error)
      }
    }
  }
}

export async function searchAndMatchForUser(
  supabase: SupabaseClient,
  userId: string,
  trigger: JobSearchTrigger = 'manual'
) {
  await enforceCooldown(supabase, userId)

  const { data: run, error: runError } = await supabase
    .from('job_search_runs')
    .insert({ user_id: userId, trigger })
    .select('id')
    .single()

  if (runError) throw runError

  try {
    const [profileResult, sourcesResult] = await Promise.all([
      supabase
        .from('profiles')
        .select(
          'preferences, resume_embedding, career_profile, email_digest_enabled, telegram_enabled, telegram_chat_id'
        )
        .eq('user_id', userId)
        .single(),
      supabase
        .from('job_sources')
        .select('source_type, identifier, feed_url')
        .eq('user_id', userId)
        .eq('active', true)
    ])

    if (profileResult.error) throw profileResult.error
    if (sourcesResult.error) throw sourcesResult.error

    const profile = profileResult.data
    if (!profile?.resume_embedding) {
      throw new Error('Complete your Career Profile first.')
    }

    const preferences = (profile.preferences || {}) as JobPreferences
    const career = (profile.career_profile || {}) as Partial<CareerProfileData>
    const queries = (preferences.targetRoles || []).filter(Boolean).slice(0, 6)
    const locations = (preferences.locations || []).filter(Boolean).slice(0, 4)

    if (!queries.length) {
      throw new Error('Add at least one target role before searching for jobs.')
    }

    const discovered = await fetchAllJobSources(
      { queries, locations },
      (sourcesResult.data || []) as FollowedSource[]
    )
    const selected = selectBalancedJobs(discovered)

    const sourceCounts = discovered.reduce<Record<string, number>>(
      (counts, job) => {
        counts[job.source] = (counts[job.source] || 0) + 1
        return counts
      },
      {}
    )

    const admin = createAdminClient()
    const limit = pLimit(4)
    const storedIds = await Promise.all(
      selected.map((job) => limit(() => storeJob(admin, job)))
    )
    const stored = storedIds.filter(Boolean).length

    const { data: candidates, error: candidateError } = await supabase.rpc(
      'match_jobs_for_profile',
      { p_user_id: userId, p_limit: 250 }
    )
    if (candidateError) throw candidateError

    const candidateRows = candidates || []
    const jobIds = candidateRows.map(
      (candidate: { job_id: string }) => candidate.job_id
    )

    let scored: Array<{
      job: JobRecord
      breakdown: ReturnType<typeof scoreJob>
    }> = []

    if (jobIds.length) {
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('*')
        .in('id', jobIds)
      if (jobsError) throw jobsError

      const similarities = new Map<string, number>(
        candidateRows.map(
          (candidate: { job_id: string; semantic_similarity: number }) => [
            String(candidate.job_id),
            Number(candidate.semantic_similarity)
          ]
        )
      )

      scored = ((jobs || []) as unknown as JobRecord[])
        .map((job) => ({
          job,
          breakdown: scoreJob(
            job,
            preferences,
            similarities.get(job.id) ?? 0,
            {
              skills: career.skills || [],
              currentTitle: career.currentTitle || career.headline || '',
              yearsExperience: career.yearsExperience
            }
          )
        }))
        .sort(
          (left, right) => right.breakdown.total - left.breakdown.total
        )
        .slice(0, 100)

      if (scored.length) {
        const { error: matchError } = await supabase
          .from('matches')
          .upsert(
            scored.map(({ job, breakdown }) => ({
              user_id: userId,
              job_id: job.id,
              score: breakdown.total,
              score_breakdown: breakdown
            })),
            { onConflict: 'user_id,job_id' }
          )
        if (matchError) throw matchError
      }
    }

    const metrics = {
      discovered: discovered.length,
      selected: selected.length,
      stored,
      matches: scored.length,
      applyNow: scored.filter((item) => item.breakdown.bucket === 'apply_now').length,
      consider: scored.filter((item) => item.breakdown.bucket === 'consider').length,
      skipped: scored.filter((item) => item.breakdown.bucket === 'skip').length,
      sources: sourceCounts
    }

    const { error: completeError } = await supabase
      .from('job_search_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        metrics
      })
      .eq('id', run.id)
    if (completeError) throw completeError

    await sendSearchNotifications(userId, profile, scored)
    return metrics
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const { error: updateError } = await supabase
      .from('job_search_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: message
      })
      .eq('id', run.id)

    if (updateError) console.error('[job-search-run]', updateError.message)
    throw error
  }
}
