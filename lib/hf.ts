import { InferenceClient } from '@huggingface/inference'
import { getServerEnv } from '@/lib/env'
import { PaceLimiter, withRetry } from '@/lib/rate-limit'
import type { ApplicationKit, ParsedResume } from '@/lib/types'

const limiter = new PaceLimiter(700)

function client() {
  return new InferenceClient(getServerEnv().HF_API_TOKEN)
}

async function withDeadline<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                `${label} timed out after ${timeoutMs}ms`
              )
            ),
          timeoutMs
        )
      })
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function flattenEmbedding(result: unknown): number[] {
  if (!Array.isArray(result)) throw new Error('Hugging Face returned a non-array embedding')
  if (result.length === 384 && result.every((item) => typeof item === 'number')) return result as number[]
  if (Array.isArray(result[0])) {
    const rows = result as number[][]
    if (rows.length === 1 && rows[0].length === 384) return rows[0]
    const dimensions = rows[0]?.length || 0
    if (!dimensions) throw new Error('Empty embedding returned')
    return Array.from({ length: dimensions }, (_, index) => rows.reduce((sum, row) => sum + (row[index] || 0), 0) / rows.length)
  }
  throw new Error('Unsupported embedding shape')
}

export function fallbackEmbedding(text: string): number[] {
  const vector = new Array<number>(384).fill(0)

  const tokens =
    text.toLowerCase().match(/[a-z0-9][a-z0-9+#.-]{1,}/g) ?? []

  for (const token of tokens) {
    let hash = 2166136261

    for (let index = 0; index < token.length; index += 1) {
      hash ^= token.charCodeAt(index)
      hash = Math.imul(hash, 16777619)
    }

    const unsignedHash = hash >>> 0
    const position = unsignedHash % 384
    const direction = ((unsignedHash >>> 9) & 1) === 0 ? 1 : -1

    vector[position] += direction
  }

  const norm =
    Math.sqrt(
      vector.reduce((sum, value) => sum + value * value, 0)
    ) || 1

  return vector.map((value) => value / norm)
}

export async function embedText(text: string) {
  const env = getServerEnv()

  try {
    await limiter.wait()

    const result = await withDeadline(
      withRetry(
        () =>
          client().featureExtraction({
            model: env.HF_EMBEDDING_MODEL,
            provider: env.HF_EMBEDDING_PROVIDER as never,
            inputs: text.slice(0, 12_000)
          }),
        { retries: 0 }
      ),
      12_000,
      'Hugging Face embedding'
    )

    const vector = flattenEmbedding(result)

    if (vector.length !== 384) {
      throw new Error(
        `Expected a 384-dimension embedding, received ${vector.length}`
      )
    }

    return vector
  } catch (error) {
    console.error(
      'Hugging Face embedding failed; using deterministic fallback.',
      error
    )

    return fallbackEmbedding(text)
  }
}

async function generateJson<T>(
  system: string,
  user: string,
  fallback: T
): Promise<T> {
  const env = getServerEnv()

  try {
    await limiter.wait()

    const result = await withDeadline(
      withRetry(
        () =>
          client().chatCompletion({
            model: env.HF_TEXT_MODEL,
            provider: env.HF_TEXT_PROVIDER as never,
            temperature: 0.2,
            max_tokens: 1400,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user }
            ]
          }),
        { retries: 0 }
      ),
      20_000,
      'Hugging Face text generation'
    )

    const content = result.choices?.[0]?.message?.content
    const responseText =
      typeof content === 'string' ? content : ''

    const match = responseText.match(/\{[\s\S]*\}/)

    if (!match) {
      return fallback
    }

    try {
      return JSON.parse(match[0]) as T
    } catch {
      return fallback
    }
  } catch (error) {
    console.error(
      'Hugging Face text generation failed; using local fallback.',
      error
    )

    return fallback
  }
}

export async function extractResumeIntelligence(text: string): Promise<ParsedResume> {
  const fallback = heuristicResumeIntelligence(text)
  return generateJson<ParsedResume>(
    'You extract factual resume information. Return only valid JSON and never invent details.',
    `Return this JSON shape: {"name":"","summary":"","skills":[],"titles":[],"yearsExperience":0,"education":[],"locations":[],"noticePeriod":""}\n\nResume:\n${text.slice(0, 18_000)}`,
    fallback
  )
}

export async function generateApplicationKit(input: { resumeText: string; jobTitle: string; company: string; jobDescription: string }): Promise<ApplicationKit> {
  const fallback: ApplicationKit = {
    whyFit: ['Relevant experience aligns with the role requirements.', 'Transferable skills match the job description.', 'The resume shows evidence of ownership and delivery.'],
    coverLetter: `Dear Hiring Team,\n\nI am interested in the ${input.jobTitle} role at ${input.company}. My background aligns with the position's core responsibilities, and I would welcome the opportunity to discuss how I can contribute.\n\nSincerely,`,
    resumeTweaks: [],
    screeningAnswers: []
  }

  return generateJson<ApplicationKit>(
    'You are a truthful job-application writing assistant. Use only facts supported by the resume. Return only valid JSON. Do not claim tools, achievements, employers, degrees, or years not present in the resume.',
    `Create an application kit with this exact JSON shape: {"whyFit":["three concise bullets"],"coverLetter":"220-320 word draft","resumeTweaks":["missing or under-emphasized keywords, never fabricated experience"],"screeningAnswers":[{"question":"Why are you interested in this role?","answer":""},{"question":"Why are you a strong fit?","answer":""},{"question":"What is your notice period?","answer":"Use resume/preferences only; otherwise say to edit manually"}]}\n\nRESUME:\n${input.resumeText.slice(0, 14_000)}\n\nJOB: ${input.jobTitle} at ${input.company}\n${input.jobDescription.slice(0, 12_000)}`,
    fallback
  )
}

export async function generateProfileSuggestions(input: { resumeText: string; recentJobs: string }) {
  return generateJson<{ suggestions: Array<{ type: string; content: string }> }>(
    'You suggest truthful LinkedIn and Naukri profile improvements. Return only JSON. Never invent experience.',
    `Return {"suggestions":[{"type":"linkedin_headline","content":"..."},{"type":"linkedin_about","content":"..."},{"type":"naukri_keywords","content":"..."}]}. Base suggestions on the resume and recurring keywords in recent matched jobs.\n\nRESUME:\n${input.resumeText.slice(0, 12_000)}\n\nRECENT JOB TEXT:\n${input.recentJobs.slice(0, 10_000)}`,
    { suggestions: [] }
  )
}

export function heuristicResumeIntelligence(
  text: string
): ParsedResume {
  const escapeRegex = (value: string) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const commonSkills = [
    'Power BI',
    'Microsoft Fabric',
    'SQL',
    'Python',
    'Azure',
    'AWS',
    'Tableau',
    'Java',
    'JavaScript',
    'TypeScript',
    'React',
    'Next.js',
    'Supabase',
    'PostgreSQL',
    'Docker',
    'Kubernetes',
    'Terraform'
  ]

  const commonTitles = [
    'Senior Software Engineer',
    'Power BI Administrator',
    'Power BI Admin',
    'Fabric Administrator',
    'Fabric Admin',
    'BI Platform Administrator',
    'BI Platform Admin',
    'BI Platform Engineer',
    'Power BI Developer',
    'Business Intelligence Developer',
    'Data Engineer'
  ]

  const commonLocations = [
    'Hyderabad',
    'Bengaluru',
    'Bangalore',
    'Chennai',
    'Pune',
    'Mumbai',
    'Noida',
    'Gurugram',
    'Gurgaon',
    'Delhi',
    'Kolkata'
  ]

  const skills = commonSkills.filter((skill) =>
    new RegExp(escapeRegex(skill), 'i').test(text)
  )

  const titles = commonTitles.filter((title) =>
    new RegExp(escapeRegex(title), 'i').test(text)
  )

  const detectedLocations = commonLocations
    .filter((location) =>
      new RegExp(`\\b${escapeRegex(location)}\\b`, 'i').test(text)
    )
    .map((location) =>
      location === 'Bangalore'
        ? 'Bengaluru'
        : location === 'Gurgaon'
          ? 'Gurugram'
          : location
    )

  const locations = Array.from(new Set(detectedLocations))

  const name = text
    .slice(0, 180)
    .match(
      /^([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3})\b/
    )?.[1]

  const years = [
    ...text.matchAll(/(\d{1,2})\+?\s+years?/gi)
  ]
    .map((match) => Number(match[1]))
    .filter((value) => value < 50)

  const noticePeriod = text.match(
    /\bnotice\s*period\b\s*(?:is|:|-)?\s*(immediate(?:ly)?|\d{1,3}\s*(?:days?|months?))/i
  )?.[1]

  return {
    name,
    skills,
    titles,
    education: [],
    locations,
    yearsExperience:
      years.length > 0 ? Math.max(...years) : undefined,
    summary: text.slice(0, 500),
    noticePeriod
  }
}

