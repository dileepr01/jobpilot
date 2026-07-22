import type { DiscoveredJob, SearchContext } from './types'
import { stripHtml } from '@/lib/utils'

export async function fetchJSearch(context: SearchContext): Promise<DiscoveredJob[]> {
  const key = process.env.RAPIDAPI_JSEARCH_KEY
  if (!key) return []
  const query = `${context.queries.slice(0, 4).join(' OR ')} in ${context.locations[0] || 'India'}`
  const url = new URL('https://jsearch.p.rapidapi.com/search')
  url.searchParams.set('query', query)
  url.searchParams.set('page', '1')
  url.searchParams.set('num_pages', '1')
  url.searchParams.set('date_posted', 'week')
  const response = await fetch(url, {
    headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': 'jsearch.p.rapidapi.com' }
  })
  if (!response.ok) throw new Error(`JSearch returned ${response.status}`)
  const payload = await response.json() as { data?: Array<Record<string, any>> }
  return (payload.data || []).map((job) => ({
    source: 'jsearch',
    externalId: String(job.job_id),
    externalUrl: String(job.job_apply_link || job.job_google_link),
    title: String(job.job_title),
    company: String(job.employer_name || 'Unknown company'),
    location: [job.job_city, job.job_state, job.job_country].filter(Boolean).join(', '),
    workMode: job.job_is_remote ? 'remote' : undefined,
    salaryMin: Number(job.job_min_salary) || undefined,
    salaryMax: Number(job.job_max_salary) || undefined,
    salaryCurrency: String(job.job_salary_currency || ''),
    description: stripHtml(String(job.job_description || '')),
    postedAt: String(job.job_posted_at_datetime_utc || ''),
    metadata: { employmentType: job.job_employment_type, benefits: job.job_benefits }
  }))
}
