import { InferenceClient } from '@huggingface/inference'
import { getServerEnv } from '@/lib/env'
import { PaceLimiter, withRetry } from '@/lib/rate-limit'
import type { ApplicationKit, ParsedResume } from '@/lib/types'

const limiter = new PaceLimiter(700)

function client() {
  return new InferenceClient(getServerEnv().HF_API_TOKEN)
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

export async function embedText(text: string) {
  const env = getServerEnv()
  await limiter.wait()
  const result = await withRetry(() => client().featureExtraction({
    model: env.HF_EMBEDDING_MODEL,
    provider: env.HF_PROVIDER as never,
    inputs: text.slice(0, 12_000)
  }))
  const vector = flattenEmbedding(result)
  if (vector.length !== 384) throw new Error(`Expected a 384-dimension embedding, received ${vector.length}`)
  return vector
}

async function generateJson<T>(system: string, user: string, fallback: T): Promise<T> {
  const env = getServerEnv()
  await limiter.wait()
  const result = await withRetry(() => client().chatCompletion({
    model: env.HF_TEXT_MODEL,
    provider: env.HF_PROVIDER as never,
    temperature: 0.2,
    max_tokens: 1400,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  }))

  const content = result.choices?.[0]?.message?.content
  const text = typeof content === 'string' ? content : ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return fallback
  try {
    return JSON.parse(match[0]) as T
  } catch {
    return fallback
  }
}

export async function extractResumeIntelligence(text: string): Promise<ParsedResume> {
  const fallback = heuristicResumeIntelligence(text)
  return generateJson<ParsedResume>(
    'You extract factual resume information. Return only valid JSON and never invent details.',
    `Return this JSON shape: {"name":"","summary":"","skills":[],"titles":[],"yearsExperience":0,"education":[],"locations":[]}\n\nResume:\n${text.slice(0, 18_000)}`,
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

function heuristicResumeIntelligence(text: string): ParsedResume {
  const commonSkills = ['Power BI', 'Microsoft Fabric', 'SQL', 'Python', 'Azure', 'AWS', 'Tableau', 'Java', 'JavaScript', 'TypeScript', 'React', 'Next.js', 'Supabase', 'PostgreSQL', 'Docker', 'Kubernetes', 'Terraform']
  const skills = commonSkills.filter((skill) => new RegExp(skill.replace('.', '\\.'), 'i').test(text))
  const years = [...text.matchAll(/(\d{1,2})\+?\s+years?/gi)].map((match) => Number(match[1])).filter((value) => value < 50)
  return {
    skills,
    titles: [],
    education: [],
    locations: [],
    yearsExperience: years.length ? Math.max(...years) : undefined,
    summary: text.slice(0, 500)
  }
}
