import type {
  JobPreferences,
  JobRecord,
  ScoreBreakdown
} from '@/lib/types'
import { clamp } from '@/lib/utils'

const TOKEN_ALIASES: Record<string, string> = {
  administrator: 'admin',
  administrators: 'admin',
  administration: 'admin',
  platforms: 'platform'
}

function normalizeRoleText(value: string) {
  return value
    .toLowerCase()
    .replace(/\bpower\s*bi\b/g, 'powerbi')
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

export function scoreJob(
  job: JobRecord,
  preferences: JobPreferences,
  semanticSimilarity: number
): ScoreBreakdown {
  const semantic =
    clamp(semanticSimilarity, 0, 1) * 75

  const targetRoles =
    preferences.targetRoles || []

  const role = targetRoles.length
    ? Math.max(
        ...targetRoles.map((roleName) =>
          overlapScore(roleName, job.title)
        )
      ) * 10
    : 0

  const locationText =
    normalizeLocation(job.location || '')

  const location = (
    preferences.locations || []
  ).some((place) => {
    const normalizedPlace =
      normalizeLocation(place)

    return (
      locationText.includes(normalizedPlace) ||
      normalizedPlace.includes(locationText)
    )
  })
    ? 6
    : 0

  const preferredModes =
    preferences.workModes || []

  const jobMode =
    (job.work_mode || '').toLowerCase()

  const workMode = preferredModes.some(
    (mode) =>
      jobMode.includes(mode) ||
      (
        mode === 'remote' &&
        locationText.includes('remote')
      )
  )
    ? 4
    : 0

  const minSalary =
    preferences.minSalary || 0

  const salary =
    !minSalary || !job.salary_max
      ? 2.5
      : job.salary_max >= minSalary
        ? 5
        : 0

  const total =
    Math.round(
      clamp(
        semantic +
          role +
          location +
          workMode +
          salary,
        0,
        100
      ) * 10
    ) / 10

  return {
    semantic:
      Math.round(semantic * 10) / 10,
    role:
      Math.round(role * 10) / 10,
    location,
    workMode,
    salary,
    total
  }
}
