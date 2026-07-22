import type { DiscoveredJob } from './types'
import { isSafeSourceIdentifier, stripHtml } from '@/lib/utils'

export async function fetchGreenhouse(boardToken: string): Promise<DiscoveredJob[]> {
  if (!isSafeSourceIdentifier(boardToken)) throw new Error('Invalid public board identifier')
  const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}/jobs?content=true`)
  if (!response.ok) throw new Error(`Greenhouse ${boardToken} returned ${response.status}`)
  const payload = await response.json() as { jobs?: Array<Record<string, any>> }
  return (payload.jobs || []).map((job) => ({
    source: `greenhouse:${boardToken}`,
    externalId: String(job.id),
    externalUrl: String(job.absolute_url),
    title: String(job.title),
    company: boardToken,
    location: String(job.location?.name || ''),
    description: stripHtml(String(job.content || '')),
    postedAt: String(job.updated_at || ''),
    metadata: { departments: job.departments, offices: job.offices }
  }))
}
