import type { DiscoveredJob, SearchContext } from './types'
import { stripHtml } from '@/lib/utils'

export async function fetchAdzuna(context: SearchContext): Promise<DiscoveredJob[]> {
  const appId = process.env.ADZUNA_APP_ID
  const appKey = process.env.ADZUNA_APP_KEY
  if (!appId || !appKey) return []
  const country = process.env.ADZUNA_COUNTRY || 'in'
  const query = context.queries.slice(0, 5).join(' OR ') || 'technology'
  const where = context.locations[0] || ''
  const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/1`)
  url.searchParams.set('app_id', appId)
  url.searchParams.set('app_key', appKey)
  url.searchParams.set('results_per_page', '50')
  url.searchParams.set('what', query)
  if (where) url.searchParams.set('where', where)
  url.searchParams.set('content-type', 'application/json')

  const response = await fetch(url)
  if (!response.ok) throw new Error(`Adzuna returned ${response.status}`)
  const payload = await response.json() as { results?: Array<Record<string, any>> }
  return (payload.results || []).map((job) => ({
    source: 'adzuna',
    externalId: String(job.id),
    externalUrl: String(job.redirect_url),
    title: String(job.title),
    company: String(job.company?.display_name || 'Unknown company'),
    location: String(job.location?.display_name || ''),
    description: stripHtml(String(job.description || '')),
    salaryMin: Number(job.salary_min) || undefined,
    salaryMax: Number(job.salary_max) || undefined,
    salaryCurrency: String(job.salary_currency || 'INR'),
    postedAt: String(job.created || ''),
    metadata: { category: job.category?.label, contractType: job.contract_type }
  }))
}
