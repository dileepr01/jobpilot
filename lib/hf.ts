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
  fallback: T,
  maxTokens = 1400
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
            max_tokens: maxTokens,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user }
            ]
          }),
        { retries: 0 }
      ),
      35_000,
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

export async function generateApplicationKit(input: {
  resumeText: string
  jobTitle: string
  company: string
  jobDescription: string
}): Promise<ApplicationKit> {
  const fallback: ApplicationKit = {
    whyFit: [
      'Relevant experience aligns with the role requirements.',
      'Transferable skills match the job description.',
      'The resume shows evidence of ownership and delivery.'
    ],
    coverLetter: `Dear Hiring Team,

I am interested in the ${input.jobTitle} role at ${input.company}. My background aligns with the position's core responsibilities, and I would welcome the opportunity to discuss how I can contribute.

Sincerely,`,
    resumeTweaks: [],
    screeningAnswers: [],
    tailoredResume: {
      template: 'modern-ats',
      content: input.resumeText
    },
    atsReport: {
      score: 60,
      matchedKeywords: [],
      missingKeywords: [],
      warnings: [
        'Review every statement before applying.'
      ]
    }
  }

  return generateJson<ApplicationKit>(
    `You are a truthful senior-level ATS resume editor.

Use only facts explicitly supported by the original resume.
Never invent employers, dates, qualifications, tools,
certifications, achievements, responsibilities, metrics,
or years of experience.

Create a complete professional ATS-safe resume designed to render to approximately 2-3 pages when the source resume supports a senior candidate with substantial career history:
- use a single column with clear visual hierarchy and reverse-chronological experience
- preserve all supported employment history, education, certifications, meaningful achievements, and enterprise-scale responsibilities
- first line must contain the candidate name only
- second line must contain the professional headline/title only
- third line must contain contact information only
- put every standard section heading on its own line
- put each employer/role and its dates/location on separate lines
- write a focused 3-5 sentence professional summary that reflects seniority and the target role without exaggeration
- target 6-10 materially distinct achievement-oriented bullets for the current role when the source resume provides enough evidence
- target 4-7 materially distinct bullets for earlier major roles when supported; use fewer bullets for older or less relevant roles
- retain quantified impact, platform scale, ownership, governance, reliability, automation, stakeholder influence, and leadership evidence when present in the source
- prefer strong natural verbs and specific outcomes over generic phrases such as "responsible for"
- keep bullets concise and non-repetitive; never pad length by restating the same claim
- use blank lines between major sections so PDF/DOCX exporters preserve structure
- never compress the resume into a single paragraph
- never add Page 1, Page 2, or other page labels inside the resume content
- no tables, icons, graphics, sidebars, text boxes, columns, photos, or demographic details
- include job keywords naturally only when the original resume supports them
- do not remove relevant career history merely to shorten the resume
- if the source does not contain enough factual material for 2-3 pages, stay truthful and shorter rather than inventing filler

Return only valid JSON.`,
    `Return this exact JSON structure:

{
  "whyFit": ["three factual concise bullets"],
  "coverLetter": "220-320 word factual draft",
  "resumeTweaks": ["truthful improvements"],
  "screeningAnswers": [
    {
      "question": "Why are you interested in this role?",
      "answer": ""
    },
    {
      "question": "Why are you a strong fit?",
      "answer": ""
    },
    {
      "question": "What is your notice period?",
      "answer": ""
    }
  ],
  "tailoredResume": {
    "template": "modern-ats",
    "content": "Complete ATS resume in plain text with real line breaks between header lines, sections, roles, and bullets"
  },
  "atsReport": {
    "score": 0,
    "matchedKeywords": [],
    "missingKeywords": [],
    "warnings": []
  }
}

ATS score must be between 0 and 100.

Missing keywords must not be inserted as candidate skills
unless the original resume supports them.

For senior candidates, prioritize depth, scope, ownership,
and measurable evidence over artificial brevity. The tailored
resume should normally contain enough supported detail to fill
2-3 professional pages without repetition or fabricated content.

ORIGINAL RESUME:
${input.resumeText.slice(0, 18_000)}

TARGET JOB:
${input.jobTitle} at ${input.company}

JOB DESCRIPTION:
${input.jobDescription.slice(0, 14_000)}`,
    fallback,
    5200
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
