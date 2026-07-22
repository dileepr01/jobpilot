import pLimit from 'p-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchAllJobSources } from '@/lib/job-sources'
import type { DiscoveredJob, FollowedSource } from '@/lib/job-sources/types'
import { embedText, generateApplicationKit } from '@/lib/hf'
import { getServerEnv } from '@/lib/env'
import { hashText } from '@/lib/utils'
import { scoreJob } from '@/lib/score'
import type { JobPreferences, JobRecord } from '@/lib/types'

function parseVector(value: unknown): number[] | null {
  if (Array.isArray(value)) return value.map(Number)
  if (typeof value === 'string') {
    try { return JSON.parse(value) as number[] } catch { return null }
  }
  return null
}

function safeDate(value?: string) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function inferWorkMode(job: DiscoveredJob) {
  if (job.workMode) return job.workMode.toLowerCase()
  const text = `${job.location || ''} ${job.description}`.toLowerCase()
  if (text.includes('remote')) return 'remote'
  if (text.includes('hybrid')) return 'hybrid'
  if (text.includes('on-site') || text.includes('onsite')) return 'onsite'
  return null
}

async function embeddingFor(text: string) {
  const admin = createAdminClient()
  const env = getServerEnv()
  const textHash = hashText(text)
  const { data: cached } = await admin.from('embedding_cache').select('embedding').eq('text_hash', textHash).eq('model', env.HF_EMBEDDING_MODEL).maybeSingle()
  const cachedVector = parseVector(cached?.embedding)
  if (cachedVector?.length === 384) return cachedVector

  const embedding = await embedText(text)
  const { error } = await admin.from('embedding_cache').upsert({ text_hash: textHash, model: env.HF_EMBEDDING_MODEL, embedding })
  if (error) console.error('[embedding-cache]', error.message)
  return embedding
}

async function storeJob(job: DiscoveredJob): Promise<string | null> {
  const admin = createAdminClient()
  const descriptionHash = hashText(job.description)
  const { data: existing } = await admin.from('jobs').select('id, description_hash, embedding').eq('source', job.source).eq('external_id', job.externalId).maybeSingle()
  const unchanged = existing?.description_hash === descriptionHash && parseVector(existing.embedding)?.length === 384
  const embedding = unchanged ? parseVector(existing.embedding) : await embeddingFor(`${job.title}\n${job.company}\n${job.location || ''}\n${job.description}`)

  const payload = {
    source: job.source,
    external_id: job.externalId,
    external_url: job.externalUrl,
    title: job.title,
    company: job.company,
    location: job.location || null,
    work_mode: inferWorkMode(job),
    salary_min: job.salaryMin || null,
    salary_max: job.salaryMax || null,
    salary_currency: job.salaryCurrency || null,
    description: job.description,
    description_hash: descriptionHash,
    embedding,
    posted_at: safeDate(job.postedAt),
    last_seen_at: new Date().toISOString(),
    metadata: job.metadata || {}
  }

  const { data, error } = await admin.from('jobs').upsert(payload, { onConflict: 'source,external_id' }).select('id').single()
  if (error) {
    console.error('[store-job]', job.source, job.externalId, error.message)
    return null
  }
  return data.id
}

async function sendTelegram(profile: any, matches: any[]) {
  if (!profile.telegram_enabled || !profile.telegram_chat_id || !process.env.TELEGRAM_BOT_TOKEN) return
  const top = matches.filter((match) => Number(match.score) >= 85).slice(0, 5)
  if (!top.length) return
  const text = ['🚀 JobPilot high matches', ...top.map((match) => `${Math.round(match.score)}% — ${match.jobs.title} at ${match.jobs.company}\n${match.jobs.external_url}`)].join('\n\n')
  const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: profile.telegram_chat_id, text, disable_web_page_preview: true })
  })
  if (!response.ok) console.error('[telegram]', await response.text())
}

async function matchProfile(profile: any) {
  const admin = createAdminClient()
  const preferences = (profile.preferences || {}) as JobPreferences
  const { data: candidates, error: rpcError } = await admin.rpc('match_jobs_for_profile', { p_user_id: profile.user_id, p_limit: 250 })
  if (rpcError) throw rpcError
  const jobIds = (candidates || []).map((candidate: any) => candidate.job_id)
  if (!jobIds.length) return { matches: 0, kits: 0 }

  const { data: jobs, error: jobsError } = await admin.from('jobs').select('*').in('id', jobIds)
  if (jobsError) throw jobsError
  const similarity = new Map<string, number>((candidates || []).map((candidate: any) => [String(candidate.job_id), Number(candidate.semantic_similarity)]))
  const typedJobs = (jobs || []) as unknown as JobRecord[]
  const scored = typedJobs
    .map((job: JobRecord) => ({ job, breakdown: scoreJob(job, preferences, similarity.get(job.id) ?? 0) }))
    .filter((item: { job: JobRecord; breakdown: ReturnType<typeof scoreJob> }) => item.breakdown.total >= 55)
    .sort((a: { breakdown: ReturnType<typeof scoreJob> }, b: { breakdown: ReturnType<typeof scoreJob> }) => b.breakdown.total - a.breakdown.total)

  for (const item of scored) {
    const { error } = await admin.from('matches').upsert({
      user_id: profile.user_id,
      job_id: item.job.id,
      score: item.breakdown.total,
      score_breakdown: item.breakdown
    }, { onConflict: 'user_id,job_id' })
    if (error) console.error('[match-upsert]', error.message)
  }

  const { data: highMatches, error: matchError } = await admin
    .from('matches')
    .select('id, score, cover_letter, why_fit, resume_tweaks, screening_answers, jobs!inner(title, company, description, external_url)')
    .eq('user_id', profile.user_id)
    .gte('score', 75)
    .order('score', { ascending: false })
    .limit(10)
  if (matchError) throw matchError

  let kits = 0
  for (const match of highMatches || []) {
    if (match.cover_letter) continue
    const job = match.jobs as unknown as { title: string; company: string; description: string; external_url: string }
    const kit = await generateApplicationKit({ resumeText: profile.resume_text, jobTitle: job.title, company: job.company, jobDescription: job.description })
    const { error } = await admin.from('matches').update({
      why_fit: kit.whyFit,
      cover_letter: kit.coverLetter,
      resume_tweaks: kit.resumeTweaks,
      screening_answers: kit.screeningAnswers
    }).eq('id', match.id)
    if (!error) kits += 1
  }

  if (profile.email_digest_enabled) {
    const env = getServerEnv()
    const response = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-digest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.SUPABASE_SERVICE_ROLE_KEY
      },
      body: JSON.stringify({ userId: profile.user_id })
    })
    if (!response.ok) console.error('[digest]', await response.text())
  }
  await sendTelegram(profile, highMatches || [])
  return { matches: scored.length, kits }
}

export async function runDailyJobs() {
  const admin = createAdminClient()
  const { data: run, error: runError } = await admin.from('daily_runs').insert({ run_type: 'daily_jobs' }).select('id').single()
  if (runError) throw runError

  try {
    const [{ data: profiles, error: profileError }, { data: sources, error: sourceError }] = await Promise.all([
      admin.from('profiles').select('user_id, preferences, resume_text, resume_embedding, email_digest_enabled, telegram_enabled, telegram_chat_id').not('resume_embedding', 'is', null),
      admin.from('job_sources').select('source_type, identifier, feed_url').eq('active', true)
    ])
    if (profileError) throw profileError
    if (sourceError) throw sourceError

    const queries: string[] = [...new Set<string>((profiles || []).flatMap((profile: any): string[] => Array.isArray(profile.preferences?.targetRoles) ? profile.preferences.targetRoles : []))]
    const locations: string[] = [...new Set<string>((profiles || []).flatMap((profile: any): string[] => Array.isArray(profile.preferences?.locations) ? profile.preferences.locations : []))]
    const discovered = await fetchAllJobSources({ queries, locations }, (sources || []) as FollowedSource[])
    const limit = pLimit(2)
    const stored = (await Promise.all(discovered.map((job) => limit(() => storeJob(job))))).filter(Boolean).length

    let matchCount = 0
    let kitCount = 0
    for (const profile of profiles || []) {
      const result = await matchProfile(profile)
      matchCount += result.matches
      kitCount += result.kits
    }

    const metrics = { profiles: profiles?.length || 0, discovered: discovered.length, stored, matches: matchCount, kits: kitCount }
    await admin.from('daily_runs').update({ status: 'completed', completed_at: new Date().toISOString(), metrics }).eq('id', run.id)
    return metrics
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await admin.from('daily_runs').update({ status: 'failed', completed_at: new Date().toISOString(), error_message: message }).eq('id', run.id)
    throw error
  }
}
