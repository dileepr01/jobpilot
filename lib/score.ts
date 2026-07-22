import type { JobPreferences, JobRecord, ScoreBreakdown } from '@/lib/types'
import { clamp } from '@/lib/utils'

function tokenSet(value: string) {
  return new Set(value.toLowerCase().split(/[^a-z0-9+#.]+/).filter((token) => token.length > 2))
}

function overlapScore(a: string, b: string) {
  const left = tokenSet(a)
  const right = tokenSet(b)
  if (!left.size || !right.size) return 0
  const overlap = [...left].filter((token) => right.has(token)).length
  return overlap / Math.min(left.size, right.size)
}

export function scoreJob(job: JobRecord, preferences: JobPreferences, semanticSimilarity: number): ScoreBreakdown {
  const semantic = clamp(semanticSimilarity, 0, 1) * 75
  const targetRoles = preferences.targetRoles || []
  const role = targetRoles.length ? Math.max(...targetRoles.map((roleName) => overlapScore(roleName, job.title))) * 10 : 0

  const locationText = (job.location || '').toLowerCase()
  const location = (preferences.locations || []).some((place) => locationText.includes(place.toLowerCase()) || place.toLowerCase().includes(locationText)) ? 6 : 0

  const preferredModes = preferences.workModes || []
  const jobMode = (job.work_mode || '').toLowerCase()
  const workMode = preferredModes.some((mode) => jobMode.includes(mode) || (mode === 'remote' && locationText.includes('remote'))) ? 4 : 0

  const minSalary = preferences.minSalary || 0
  const salary = !minSalary || !job.salary_max ? 2.5 : job.salary_max >= minSalary ? 5 : 0
  const total = Math.round(clamp(semantic + role + location + workMode + salary, 0, 100) * 10) / 10

  return {
    semantic: Math.round(semantic * 10) / 10,
    role: Math.round(role * 10) / 10,
    location,
    workMode,
    salary,
    total
  }
}
