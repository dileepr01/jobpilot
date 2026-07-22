import type { DiscoveredJob } from './types'
import { isSafeSourceIdentifier, stripHtml } from '@/lib/utils'

export async function fetchLever(company: string): Promise<DiscoveredJob[]> {
  if (!isSafeSourceIdentifier(company)) throw new Error('Invalid public board identifier')
  const response = await fetch(`https://api.lever.co/v0/postings/${encodeURIComponent(company)}?mode=json`)
  if (!response.ok) throw new Error(`Lever ${company} returned ${response.status}`)
  const payload = await response.json() as Array<Record<string, any>>
  return payload.map((job) => ({
    source: `lever:${company}`,
    externalId: String(job.id),
    externalUrl: String(job.hostedUrl || job.applyUrl),
    title: String(job.text),
    company,
    location: String(job.categories?.location || ''),
    workMode: String(job.workplaceType || ''),
    description: stripHtml(`${job.descriptionPlain || job.description || ''} ${job.additionalPlain || ''}`),
    postedAt: job.createdAt ? new Date(Number(job.createdAt)).toISOString() : undefined,
    metadata: { team: job.categories?.team, commitment: job.categories?.commitment }
  }))
}
