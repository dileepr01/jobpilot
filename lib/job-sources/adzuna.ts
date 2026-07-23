import type {
  DiscoveredJob,
  SearchContext
} from './types'
import { stripHtml } from '@/lib/utils'

type AdzunaJob = Record<string, any>

async function searchAdzuna(
  appId: string,
  appKey: string,
  country: string,
  query: string,
  location: string
): Promise<DiscoveredJob[]> {
  const url = new URL(
    `https://api.adzuna.com/v1/api/jobs/${country}/search/1`
  )

  url.searchParams.set('app_id', appId)
  url.searchParams.set('app_key', appKey)
  url.searchParams.set('results_per_page', '50')
  url.searchParams.set('what', query)

  if (location) {
    url.searchParams.set('where', location)
  }

  url.searchParams.set('content-type', 'application/json')

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(
      `Adzuna returned ${response.status} for "${query}" in "${location}"`
    )
  }

  const payload = await response.json() as {
    results?: AdzunaJob[]
  }

  return (payload.results || []).map((job) => ({
    source: 'adzuna',
    externalId: String(job.id),
    externalUrl: String(job.redirect_url || ''),
    title: String(job.title || ''),
    company: String(
      job.company?.display_name || 'Unknown company'
    ),
    location: String(
      job.location?.display_name || location
    ),
    description: stripHtml(
      String(job.description || '')
    ),
    salaryMin:
      Number(job.salary_min) || undefined,
    salaryMax:
      Number(job.salary_max) || undefined,
    salaryCurrency: String(
      job.salary_currency || 'INR'
    ),
    postedAt: String(job.created || ''),
    metadata: {
      category: job.category?.label,
      contractType: job.contract_type,
      searchQuery: query,
      searchLocation: location
    }
  }))
}

export async function fetchAdzuna(
  context: SearchContext
): Promise<DiscoveredJob[]> {
  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY

  if (!appId || !appKey) {
    console.log(
      `[adzuna] skipped: appId=${Boolean(appId)} appKey=${Boolean(appKey)}`
    )
    return []
  }

  const country =
    process.env.ADZUNA_COUNTRY || 'in'

  const profileQueries = context.queries.length
    ? context.queries
    : ['Power BI administrator']

  const expandedQueries = [
    ...profileQueries,
    'Power BI administrator',
    'Microsoft Fabric administrator',
    'Business Intelligence administrator',
    'BI platform engineer'
  ]

  const queries = [
    ...new Set(
      expandedQueries
        .map((value) => value.trim())
        .filter(Boolean)
    )
  ].slice(0, 7)

  const locations = [
    ...new Set([
      ...context.locations,
      'India'
    ])
  ].slice(0, 3)

  const searches = queries.flatMap((query) =>
    locations.map((location) => ({
      query,
      location
    }))
  )

  const results = await Promise.allSettled(
    searches.map(({ query, location }) =>
      searchAdzuna(
        appId,
        appKey,
        country,
        query,
        location
      )
    )
  )

  results
    .filter(
      (result): result is PromiseRejectedResult =>
        result.status === 'rejected'
    )
    .forEach((failure) => {
      console.error('[adzuna]', failure.reason)
    })

  const jobs = results.flatMap((result) =>
    result.status === 'fulfilled'
      ? result.value
      : []
  )

  const unique = new Map<string, DiscoveredJob>()

  for (const job of jobs) {
    const key = `${job.source}:${job.externalId}`

    if (
      job.externalUrl &&
      job.title &&
      job.description
    ) {
      unique.set(key, job)
    }
  }

  console.log(
    `[adzuna] searches=${searches.length} jobs=${unique.size}`
  )

  return [...unique.values()]
}
