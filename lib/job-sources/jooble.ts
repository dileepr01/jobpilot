import type { DiscoveredJob, SearchContext } from './types'
import { stripHtml } from '@/lib/utils'

export async function fetchJooble(context: SearchContext): Promise<DiscoveredJob[]> {
  const apiKey = process.env.JOOBLE_API_KEY
  if (!apiKey) return []
  const response = await fetch(`https://jooble.org/api/${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keywords: context.queries.slice(0, 5).join(' '), location: context.locations[0] || '' })
  })
  if (!response.ok) throw new Error(`Jooble returned ${response.status}`)
  const payload = await response.json() as { jobs?: Array<Record<string, any>> }
  return (payload.jobs || []).map((job) => ({
    source: 'jooble',
    externalId: String(job.id || job.link),
    externalUrl: String(job.link),
    title: String(job.title),
    company: String(job.company || 'Unknown company'),
    location: String(job.location || ''),
    salaryMin: undefined,
    salaryMax: undefined,
    description: stripHtml(String(job.snippet || '')),
    postedAt: String(job.updated || ''),
    metadata: { salaryText: job.salary, sourceName: job.source }
  }))
}
