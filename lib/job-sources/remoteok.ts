import type { DiscoveredJob, SearchContext } from './types'
import { stripHtml } from '@/lib/utils'

type RemoteOkJob = {
  id?: string | number
  slug?: string
  date?: string
  company?: string
  position?: string
  tags?: string[]
  description?: string
  location?: string
  apply_url?: string
  url?: string
  salary_min?: number
  salary_max?: number
}

function queryTokens(query: string) {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

export function matchesRemoteOkContext(
  job: RemoteOkJob,
  context: SearchContext
) {
  if (!context.queries.length) return true

  const haystack = `${job.position || ''} ${(job.tags || []).join(' ')}`
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, ' ')

  return context.queries.some((query) => {
    const normalized = query
      .toLowerCase()
      .replace(/[^a-z0-9+#.]+/g, ' ')
      .trim()

    if (normalized && haystack.includes(normalized)) return true

    const tokens = queryTokens(query)
    if (!tokens.length) return false
    const matched = tokens.filter((token) => haystack.includes(token)).length
    return tokens.length === 1 ? matched === 1 : matched >= 2
  })
}

function locationMatches(job: RemoteOkJob, context: SearchContext) {
  if (!context.locations.length) return true

  const location = String(job.location || '').toLowerCase()
  if (!location || /worldwide|anywhere|global/.test(location)) return true

  const wantsIndia = context.locations.some((item) =>
    /india|hyderabad|bengaluru|bangalore|chennai|pune|mumbai|noida|gurugram|gurgaon|delhi/i.test(
      item
    )
  )

  if (wantsIndia && /india|asia/.test(location)) return true

  return context.locations.some((item) =>
    location.includes(item.toLowerCase())
  )
}

export async function fetchRemoteOk(
  context: SearchContext
): Promise<DiscoveredJob[]> {
  const response = await fetch('https://remoteok.com/api', {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'JobPilot/0.1 (+https://jobpilot-umber.vercel.app)'
    }
  })

  if (!response.ok) {
    throw new Error(`Remote OK returned ${response.status}`)
  }

  const payload = (await response.json()) as Array<
    RemoteOkJob | Record<string, unknown>
  >

  const jobs = payload
    .filter((item): item is RemoteOkJob => Boolean((item as RemoteOkJob).id))
    .filter((job) => matchesRemoteOkContext(job, context))
    .filter((job) => locationMatches(job, context))
    .map<DiscoveredJob>((job) => ({
      source: 'remoteok',
      externalId: String(job.id || job.slug || job.url || ''),
      externalUrl: String(job.apply_url || job.url || ''),
      title: String(job.position || ''),
      company: String(job.company || 'Unknown company'),
      location: String(job.location || 'Remote'),
      workMode: 'remote',
      salaryMin: Number(job.salary_min) || undefined,
      salaryMax: Number(job.salary_max) || undefined,
      description: stripHtml(String(job.description || '')),
      postedAt: job.date || undefined,
      metadata: {
        fetchedVia: 'Remote OK public JSON feed',
        sourceAttribution: 'Remote OK',
        tags: job.tags || []
      }
    }))

  console.log(`[remoteok] jobs=${jobs.length}`)
  return jobs
}
