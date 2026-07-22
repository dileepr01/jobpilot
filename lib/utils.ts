import { createHash } from 'node:crypto'

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

export function hashText(value: string) {
  return createHash('sha256').update(normalizeWhitespace(value)).digest('hex')
}

export function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export function isPublicHttpsUrl(value: string) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return false
    const host = url.hostname.toLowerCase()
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return false
    if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(host)) return false
    const private172 = host.match(/^172\.(\d{1,3})\./)
    if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return false
    if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) return false
    return true
  } catch {
    return false
  }
}

export function isSafeSourceIdentifier(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(value)
}

export function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
