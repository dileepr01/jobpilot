import type { DiscoveredJob, SearchContext } from './types'
import { stripHtml } from '@/lib/utils'

type JoobleJob = Record<string, any>

async function searchJooble(
  apiKey: string,
  keywords: string,
  location: string
): Promise<DiscoveredJob[]> {
  const response = await fetch(`https://jooble.org/api/${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      keywords,
      location
    })
  })

  if (!response.ok) {
    throw new Error(
      `Jooble returned ${response.status} for "${keywords}" in "${location}"`
    )
  }

  const payload = await response.json() as {
    jobs?: JoobleJob[]
  }

  return (payload.jobs || []).map((job) => ({
    source: 'jooble',
    externalId: String(job.id || job.link),
    externalUrl: String(job.link || ''),
    title: String(job.title || ''),
    company: String(job.company || 'Unknown company'),
    location: String(job.location || location),
    salaryMin: undefined,
    salaryMax: undefined,
    description: stripHtml(
      String(job.snippet || job.description || '')
    ),
    postedAt: String(job.updated || ''),
    metadata: {
      salaryText: job.salary,
      sourceName: job.source,
      searchKeywords: keywords,
      searchLocation: location
    }
  }))
}

export async function fetchJooble(
  context: SearchContext
): Promise<DiscoveredJob[]> {
  const apiKey = process.env.JOOBLE_API_KEY

  if (!apiKey) {
    console.log('[jooble] skipped: JOOBLE_API_KEY is missing')
    return []
  }

  const queries = context.queries.length
    ? context.queries.slice(0, 5)
    : ['Power BI']

  const locations = context.locations.length
    ? context.locations.slice(0, 2)
    : ['India']

  const searches = queries.flatMap((query) =>
    locations.map((location) => ({
      query,
      location
    }))
  )

  const results = await Promise.allSettled(
    searches.map(({ query, location }) =>
      searchJooble(apiKey, query, location)
    )
  )

  results
    .filter(
      (result): result is PromiseRejectedResult =>
        result.status === 'rejected'
    )
    .forEach((failure) => {
      console.error('[jooble]', failure.reason)
    })

  const jobs = results.flatMap((result) =>
    result.status === 'fulfilled' ? result.value : []
  )

  const unique = new Map<string, DiscoveredJob>()

  for (const job of jobs) {
    const key = `${job.source}:${job.externalId}`

    if (job.externalUrl && job.title && job.description) {
      unique.set(key, job)
    }
  }

  console.log(
    `[jooble] searches=${searches.length} jobs=${unique.size}`
  )

  return [...unique.values()]
}
