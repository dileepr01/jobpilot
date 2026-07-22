import { z } from 'zod'

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  HF_API_TOKEN: z.string().min(1),
  HF_EMBEDDING_MODEL: z.string().default('sentence-transformers/all-MiniLM-L6-v2'),
  HF_TEXT_MODEL: z.string().default('mistralai/Mistral-7B-Instruct-v0.3'),
  HF_PROVIDER: z.string().default('hf-inference'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000')
})

export function getServerEnv() {
  const parsed = serverSchema.safeParse(process.env)
  if (!parsed.success) {
    throw new Error(`Invalid server environment: ${parsed.error.issues.map((issue: { path: Array<string | number> }) => issue.path.join('.')).join(', ')}`)
  }
  return parsed.data
}

export function getPublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !publishableKey) throw new Error('Missing public Supabase environment variables')
  return { url, publishableKey }
}
