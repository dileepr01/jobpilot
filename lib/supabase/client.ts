'use client'

import { createBrowserClient } from '@supabase/ssr'
import { getPublicEnv } from '@/lib/env.public'

export function createClient() {
  const { url, publishableKey } = getPublicEnv()
  return createBrowserClient(url, publishableKey)
}
