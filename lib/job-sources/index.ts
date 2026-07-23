import type {
  DiscoveredJob,
  FollowedSource,
  SearchContext
} from './types'
import { fetchRemotive } from './remotive'
import { fetchAdzuna } from './adzuna'
import { fetchJooble } from './jooble'
import { fetchJSearch } from './jsearch'
import { fetchGreenhouse } from './greenhouse'
import { fetchLever } from './lever'
import { fetchRss } from './rss'
import { isHttpUrl } from '@/lib/utils'

export async function fetchAllJobSources(
  context: SearchContext,
  followedSources: FollowedSource[]
) {
  const tasks: Array<Promise<DiscoveredJob[]>> = [
    fetchRemotive(),
    fetchAdzuna(context),
    fetchJooble(context),
    fetchJSearch(context)
  ]

  for (const source of followedSources) {
    if (source.source_type === 'greenhouse' && source.identifier) {
      tasks.push(fetchGreenhouse(source.identifier))
    }

    if (source.source_type === 'lever' && source.identifier) {
      tasks.push(fetchLever(source.identifier))
    }

    if (source.source_type === 'rss' && source.feed_url) {
      tasks.push(fetchRss(source.feed_url))
    }
  }

  const settled = await Promise.allSettled(tasks)

  settled
    .filter(
      (result): result is PromiseRejectedResult =>
        result.status === 'rejected'
    )
    .forEach((result) => {
      console.error('[job-source]', result.reason)
    })

  const jobs = settled.flatMap((result) =>
    result.status === 'fulfilled' ? result.value : []
  )

  const sourceCounts = jobs.reduce<Record<string, number>>(
    (counts, job) => {
      counts[job.source] = (counts[job.source] || 0) + 1
      return counts
    },
    {}
  )

  console.log('[job-sources]', sourceCounts)

  const seen = new Set<string>()

  return jobs.filter((job) => {
    const key = `${job.source}:${job.externalId}`

    if (
      !isHttpUrl(job.externalUrl) ||
      !job.title ||
      !job.description ||
      seen.has(key)
    ) {
      return false
    }

    seen.add(key)
    return true
  })
}
