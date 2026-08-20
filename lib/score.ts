import type {
  JobPreferences,
  JobRecord,
  OpportunityBucket,
  ScoreBreakdown
} from '@/lib/types'
import { clamp } from '@/lib/utils'

const TOKEN_ALIASES: Record<string, string> = {
  administrator: 'admin',
  administrators: 'admin',
  administration: 'admin',
  platforms: 'platform'
}

const SENIORITY_LEVELS: Array<{ level: number; terms: string[] }> = [
  { level: 1, terms: ['junior', 'associate', 'entry'] },
  { level: 2, terms: ['engineer', 'analyst', 'specialist', 'developer'] },
  { level: 3, terms: ['senior', 'sr'] },
  { level: 4, terms: ['lead', 'staff'] },
  { level: 5, terms: ['principal', 'architect'] },
  { level: 6, terms: ['manager', 'director', 'head'] }
]

export type CareerSignals = {
  skills?: string[]
  currentTitle?: string
  yearsExperience?: number
}

function normalizeRoleText(value: string) {
  return value
    .toLowerCase()
    .replace(/\bpower\s*bi\b/g, 'powerbi')
    .replace(/\bms\s*fabric\b/g, 'microsoft fabric')
}

function tokenSet(value: string) {
  const tokens = normalizeRoleText(value)
    .split(/[^a-z0-9+#.]+/)
    .filter((token) => token.length > 2)
    .map((token) => TOKEN_ALIASES[token] || token)

  return new Set(tokens)
}

function overlapScore(a: string, b: string) {
  const left = tokenSet(a)
  const right = tokenSet(b)

  if (!left.size || !right.size) return 0

  const overlap = [...left]
    .filter((token) => right.has(token))
    .length

  return overlap / Math.min(left.size, right.size)
}

function normalizeLocation(value: string) {
  return value
    .toLowerCase()
    .replace(/\bbengaluru\b/g, 'bangalore')
}

function seniorityLevel(value: string) {
  const normalized = normalizeRoleText(value)
  let best = 0
  for (const group of SENIORITY_LEVELS) {
    if (group.terms.some((term) => new RegExp(`\\b${term}\\b`, 'i').test(normalized))) {
      best = Math.max(best, group.level)
    }
  }
  return best
}

function seniorityScore(jobTitle: string, preferences: JobPreferences, signals: CareerSignals) {
  const jobLevel = seniorityLevel(jobTitle)
  const preferredLevel = Math.max(
    seniorityLevel(signals.currentTitle || ''),
    ...(preferences.targetRoles || []).map(seniorityLevel)
  )

  if (!jobLevel || !preferredLevel) {
    return (signals.yearsExperience || 0) >= 10 && /principal|staff|lead|senior|architect/i.test(jobTitle)
      ? 5
      : 2.5
  }

  const difference = Math.abs(jobLevel - preferredLevel)
  if (difference === 0) return 5
  if (difference === 1) return 3.5
  if (difference === 2) return 1.5
  return 0
}

function freshnessScore(postedAt: string | null) {
  if (!postedAt) return 1
  const ageMs = Date.now() - new Date(postedAt).getTime()
  if (!Number.isFinite(ageMs)) return 1
  const ageDays = ageMs / 86_400_000
  if (ageDays <= 2) return 5
  if (ageDays <= 7) return 4
  if (ageDays <= 14) return 2.5
  if (ageDays <= 30) return 1
  return 0
}

function skillScore(job: JobRecord, skills: string[]) {
  const verifiedSkills = skills.filter(Boolean).slice(0, 40)
  if (!verifiedSkills.length) return 0

  const haystack = normalizeRoleText(`${job.title}\n${job.description}`)
  const matches = verifiedSkills.filter((skill) => {
    const normalized = normalizeRoleText(skill).trim()
    return normalized.length >= 2 && haystack.includes(normalized)
  }).length

  return Math.min(10, (matches / Math.min(8, verifiedSkills.length)) * 10)
}

export function opportunityBucket(score: number): OpportunityBucket {
  if (score >= 85) return 'apply_now'
  if (score >= 65) return 'consider'
  return 'skip'
}

export function scoreJob(
  job: JobRecord,
  preferences: JobPreferences,
  semanticSimilarity: number,
  signals: CareerSignals = {}
): ScoreBreakdown {
  const semantic = clamp(semanticSimilarity, 0, 1) * 55

  const targetRoles = preferences.targetRoles || []
  const role = targetRoles.length
    ? Math.max(
        ...targetRoles.map((roleName) => overlapScore(roleName, job.title))
      ) * 10
    : 0

  const skills = skillScore(job, signals.skills || [])
  const seniority = seniorityScore(job.title, preferences, signals)
  const freshness = freshnessScore(job.posted_at)

  const locationText = normalizeLocation(job.location || '')
  const location = (preferences.locations || []).some((place) => {
    const normalizedPlace = normalizeLocation(place)
    return (
      locationText.includes(normalizedPlace) ||
      normalizedPlace.includes(locationText)
    )
  })
    ? 6
    : 0

  const preferredModes = preferences.workModes || []
  const jobMode = (job.work_mode || '').toLowerCase()
  const workMode = preferredModes.some(
    (mode) =>
      jobMode.includes(mode) ||
      (mode === 'remote' && locationText.includes('remote'))
  )
    ? 4
    : 0

  const minSalary = preferences.minSalary || 0
  const salary = !minSalary || !job.salary_max
    ? 2.5
    : job.salary_max >= minSalary
      ? 5
      : 0

  const total = Math.round(
    clamp(
      semantic + role + skills + seniority + freshness + location + workMode + salary,
      0,
      100
    ) * 10
  ) / 10

  return {
    semantic: Math.round(semantic * 10) / 10,
    role: Math.round(role * 10) / 10,
    skills: Math.round(skills * 10) / 10,
    seniority: Math.round(seniority * 10) / 10,
    freshness: Math.round(freshness * 10) / 10,
    location,
    workMode,
    salary,
    total,
    bucket: opportunityBucket(total)
  }
}
