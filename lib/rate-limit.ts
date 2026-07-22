import { sleep } from '@/lib/utils'

export async function withRetry<T>(operation: () => Promise<T>, options?: { retries?: number; baseDelayMs?: number }) {
  const retries = options?.retries ?? 3
  const baseDelayMs = options?.baseDelayMs ?? 1200
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (attempt === retries) break
      const jitter = Math.floor(Math.random() * 300)
      await sleep(baseDelayMs * 2 ** attempt + jitter)
    }
  }

  throw lastError
}

export class PaceLimiter {
  private lastRun = 0
  constructor(private readonly minimumGapMs: number) {}

  async wait() {
    const delay = Math.max(0, this.minimumGapMs - (Date.now() - this.lastRun))
    if (delay) await sleep(delay)
    this.lastRun = Date.now()
  }
}
