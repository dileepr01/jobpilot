import Parser from 'rss-parser'
import type { DiscoveredJob } from './types'
import { isPublicHttpsUrl, stripHtml } from '@/lib/utils'

const parser = new Parser()

export async function fetchRss(feedUrl: string): Promise<DiscoveredJob[]> {
  if (!isPublicHttpsUrl(feedUrl)) throw new Error('RSS feeds must use a public HTTPS URL')
  const feed = await parser.parseURL(feedUrl)
  return (feed.items || []).filter((item: any) => item.link && item.title).map((item: any) => ({
    source: `rss:${new URL(feedUrl).hostname}`,
    externalId: String(item.guid || item.link),
    externalUrl: String(item.link),
    title: String(item.title),
    company: String(feed.title || new URL(feedUrl).hostname),
    location: '',
    description: stripHtml(String(item.contentSnippet || item.content || item.summary || '')),
    postedAt: item.isoDate || item.pubDate,
    metadata: { feedUrl }
  }))
}
