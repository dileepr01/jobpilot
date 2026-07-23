import { z } from 'zod'

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  HF_API_TOKEN: z.string().min(1),
  HF_EMBEDDING_MODEL: z
    .string()
    .default('sentence-transformers/all-MiniLM-L6-v2'),
  HF_TEXT_MODEL: z
    .string()
    .default('Qwen/Qwen2.5-7B-Instruct'),

  HF_EMBEDDING_PROVIDER: z.string().default('hf-inference'),
  HF_TEXT_PROVIDER: z.string().default('together'),

  // Retained temporarily for backward compatibility.
  HF_PROVIDER: z.string().optional(),

  NEXT_PUBLIC_APP_URL: z
    .string()
    .url()
    .default('http://localhost:3000')
})

export function getServerEnv() {
  const parsed = serverSchema.safeParse(process.env)

  if (!parsed.success) {
    throw new Error(
      `Invalid server environment: ${parsed.error.issues
        .map((issue) => issue.path.join('.'))
        .join(', ')}`
    )
  }

  return parsed.data
}

export function getPublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !publishableKey) {
    throw new Error('Missing public Supabase environment variables')
  }

  return { url, publishableKey }
}
