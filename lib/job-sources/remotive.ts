import type { DiscoveredJob } from './types'
import { stripHtml } from '@/lib/utils'

export async function fetchRemotive(): Promise<DiscoveredJob[]> {
  const response = await fetch('https://remotive.com/api/remote-jobs?limit=100', { headers: { 'User-Agent': 'JobPilot/1.0' } })
  if (!response.ok) throw new Error(`Remotive returned ${response.status}`)
  const payload = await response.json() as { jobs?: Array<Record<string, unknown>> }
  return (payload.jobs || []).map((job) => ({
    source: 'remotive',
    externalId: String(job.id),
    externalUrl: String(job.url),
    title: String(job.title),
    company: String(job.company_name),
    location: String(job.candidate_required_location || 'Remote'),
    workMode: 'remote',
    salaryMin: undefined,
    salaryMax: undefined,
    description: stripHtml(String(job.description || '')),
    postedAt: String(job.publication_date || ''),
    metadata: { category: job.category, tags: job.tags }
  }))
}
