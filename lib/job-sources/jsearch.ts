import type { DiscoveredJob, SearchContext } from './types'
import { stripHtml } from '@/lib/utils'

type JSearchJob = Record<string, any>

type SearchPlan = {
  query: string
  location: string
}

const PUBLISHER_PATTERNS: Array<{
  source: string
  pattern: RegExp
}> = [
  { source: 'linkedin', pattern: /linkedin/i },
  { source: 'glassdoor', pattern: /glassdoor/i },
  { source: 'naukri', pattern: /naukri/i },
  { source: 'indeed', pattern: /indeed/i },
  { source: 'monster', pattern: /monster/i },
  { source: 'foundit', pattern: /foundit/i },
  { source: 'dice', pattern: /dice\.com|\bdice\b/i },
  { source: 'ziprecruiter', pattern: /ziprecruiter/i },
  { source: 'simplyhired', pattern: /simplyhired/i },
  { source: 'talent', pattern: /talent\.com|\btalent\b/i }
]

function hostname(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export function normalizeJSearchSource(job: JSearchJob) {
  const publisher = String(job.job_publisher || '')
  const applyLink = String(job.job_apply_link || '')
  const googleLink = String(job.job_google_link || '')
  const signal = `${publisher} ${hostname(applyLink)} ${hostname(googleLink)}`

  return (
    PUBLISHER_PATTERNS.find(({ pattern }) => pattern.test(signal))?.source ||
    'jsearch'
  )
}

export function buildJSearchSearches(
  context: SearchContext
): SearchPlan[] {
  const queries = context.queries.length
    ? context.queries.slice(0, 4)
    : ['Power BI', 'Microsoft Fabric', 'BI Platform']
  const locations = context.locations.length
    ? context.locations.slice(0, 2)
    : ['India']

  const primary = locations[0] || 'India'
  const searches: SearchPlan[] = queries.map((query) => ({
    query,
    location: primary
  }))

  if (locations[1] && locations[1] !== primary && queries[0]) {
    searches.push({
      query: queries[0],
      location: locations[1]
    })
  }

  return searches.slice(0, 5)
}

async function searchJSearch(
  key: string,
  plan: SearchPlan
): Promise<DiscoveredJob[]> {
  const url = new URL('https://jsearch.p.rapidapi.com/search')
  url.searchParams.set('query', `${plan.query} in ${plan.location}`)
  url.searchParams.set('page', '1')
  url.searchParams.set('num_pages', '1')
  url.searchParams.set('date_posted', 'week')

  const response = await fetch(url, {
    headers: {
      'x-rapidapi-key': key,
      'x-rapidapi-host': 'jsearch.p.rapidapi.com'
    }
  })

  if (!response.ok) {
    throw new Error(
      `JSearch returned ${response.status} for "${plan.query}" in "${plan.location}"`
    )
  }

  const payload = (await response.json()) as {
    data?: JSearchJob[]
  }

  return (payload.data || []).map((job) => {
    const source = normalizeJSearchSource(job)
    const publisher = String(job.job_publisher || '')
    const applyLink = String(job.job_apply_link || job.job_google_link || '')
    const salaryCurrency = job.job_salary_currency
      ? String(job.job_salary_currency)
      : undefined

    return {
      source,
      externalId: String(job.job_id || applyLink),
      externalUrl: applyLink,
      title: String(job.job_title || ''),
      company: String(job.employer_name || 'Unknown company'),
      location: [job.job_city, job.job_state, job.job_country]
        .filter(Boolean)
        .join(', '),
      workMode: job.job_is_remote ? 'remote' : undefined,
      salaryMin: Number(job.job_min_salary) || undefined,
      salaryMax: Number(job.job_max_salary) || undefined,
      salaryCurrency,
      description: stripHtml(String(job.job_description || '')),
      postedAt: String(job.job_posted_at_datetime_utc || ''),
      metadata: {
        fetchedVia: 'JSearch',
        publisher: publisher || undefined,
        publisherSource: source,
        applyIsDirect: Boolean(job.job_apply_is_direct),
        employmentType: job.job_employment_type,
        benefits: job.job_benefits,
        searchQuery: plan.query,
        searchLocation: plan.location
      }
    } satisfies DiscoveredJob
  })
}

export async function fetchJSearch(
  context: SearchContext
): Promise<DiscoveredJob[]> {
  const key = process.env.RAPIDAPI_JSEARCH_KEY

  if (!key) {
    console.log('[jsearch] skipped: RAPIDAPI_JSEARCH_KEY is missing')
    return []
  }

  const searches = buildJSearchSearches(context)
  const settled = await Promise.allSettled(
    searches.map((plan) => searchJSearch(key, plan))
  )

  settled
    .filter(
      (result): result is PromiseRejectedResult =>
        result.status === 'rejected'
    )
    .forEach((result) => console.error('[jsearch]', result.reason))

  const unique = new Map<string, DiscoveredJob>()

  for (const job of settled.flatMap((result) =>
    result.status === 'fulfilled' ? result.value : []
  )) {
    if (job.externalUrl && job.title && job.description) {
      unique.set(`${job.source}:${job.externalId}`, job)
    }
  }

  const publisherCounts = [...unique.values()].reduce<Record<string, number>>(
    (counts, job) => {
      counts[job.source] = (counts[job.source] || 0) + 1
      return counts
    },
    {}
  )

  console.log(
    `[jsearch] searches=${searches.length} jobs=${unique.size}`,
    publisherCounts
  )

  return [...unique.values()]
}
