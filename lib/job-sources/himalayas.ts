import type { DiscoveredJob, SearchContext } from './types'
import { stripHtml } from '@/lib/utils'

type HimalayasLocation = {
  alpha2?: string
  name?: string
  slug?: string
}

type HimalayasJob = {
  title?: string
  excerpt?: string
  companyName?: string
  companySlug?: string
  employmentType?: string
  minSalary?: number | null
  maxSalary?: number | null
  salaryPeriod?: string
  seniority?: string[]
  currency?: string
  locationRestrictions?: HimalayasLocation[]
  timezoneRestrictions?: string[]
  categories?: string[]
  description?: string
  pubDate?: number
  expiryDate?: number
  applicationLink?: string
  guid?: string
}

function countryForContext(context: SearchContext) {
  const locations = context.locations.join(' ').toLowerCase()

  if (
    !locations ||
    /\bindia\b|hyderabad|bengaluru|bangalore|chennai|pune|mumbai|noida|gurugram|gurgaon|delhi/.test(
      locations
    )
  ) {
    return 'IN'
  }

  return undefined
}

function asIsoDate(value?: number) {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

async function searchHimalayas(query: string, country?: string) {
  const url = new URL('https://himalayas.app/jobs/api/search')
  url.searchParams.set('q', query)
  url.searchParams.set('sort', 'recent')
  url.searchParams.set('page', '1')
  if (country) url.searchParams.set('country', country)

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'JobPilot/0.1 (+https://jobpilot-umber.vercel.app)'
    }
  })

  if (!response.ok) {
    throw new Error(`Himalayas returned ${response.status} for "${query}"`)
  }

  const payload = (await response.json()) as {
    jobs?: HimalayasJob[]
  }

  return (payload.jobs || []).map<DiscoveredJob>((job) => {
    const restrictions = job.locationRestrictions || []
    const restrictionText = restrictions
      .map((item) => item.name || item.alpha2)
      .filter(Boolean)
      .join(', ')

    return {
      source: 'himalayas',
      externalId: String(job.guid || job.applicationLink || ''),
      externalUrl: String(job.applicationLink || ''),
      title: String(job.title || ''),
      company: String(job.companyName || 'Unknown company'),
      location: restrictionText
        ? `Remote (${restrictionText})`
        : 'Remote',
      workMode: 'remote',
      salaryMin: job.minSalary || undefined,
      salaryMax: job.maxSalary || undefined,
      salaryCurrency: job.currency || undefined,
      description: stripHtml(
        String(job.description || job.excerpt || '')
      ),
      postedAt: asIsoDate(job.pubDate),
      metadata: {
        fetchedVia: 'Himalayas public API',
        sourceAttribution: 'Himalayas',
        employmentType: job.employmentType,
        salaryPeriod: job.salaryPeriod,
        seniority: job.seniority,
        categories: job.categories,
        timezoneRestrictions: job.timezoneRestrictions,
        companySlug: job.companySlug,
        expiryDate: asIsoDate(job.expiryDate)
      }
    }
  })
}

export async function fetchHimalayas(
  context: SearchContext
): Promise<DiscoveredJob[]> {
  const queries = context.queries.length
    ? context.queries.slice(0, 3)
    : ['Power BI', 'Microsoft Fabric', 'BI Platform']
  const country = countryForContext(context)

  const settled = await Promise.allSettled(
    queries.map((query) => searchHimalayas(query, country))
  )

  settled
    .filter(
      (result): result is PromiseRejectedResult =>
        result.status === 'rejected'
    )
    .forEach((result) => console.error('[himalayas]', result.reason))

  const unique = new Map<string, DiscoveredJob>()

  for (const job of settled.flatMap((result) =>
    result.status === 'fulfilled' ? result.value : []
  )) {
    if (job.externalId && job.externalUrl && job.title && job.description) {
      unique.set(`${job.source}:${job.externalId}`, job)
    }
  }

  console.log(`[himalayas] jobs=${unique.size}`)
  return [...unique.values()]
}
