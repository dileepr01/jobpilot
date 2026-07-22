export interface DiscoveredJob {
  source: string
  externalId: string
  externalUrl: string
  title: string
  company: string
  location?: string
  workMode?: string
  salaryMin?: number
  salaryMax?: number
  salaryCurrency?: string
  description: string
  postedAt?: string
  metadata?: Record<string, unknown>
}

export interface SearchContext {
  queries: string[]
  locations: string[]
}

export interface FollowedSource {
  source_type: 'greenhouse' | 'lever' | 'rss'
  identifier: string | null
  feed_url: string | null
}
