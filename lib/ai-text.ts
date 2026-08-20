import type { ApplicationKit, ParsedResume } from '@/lib/types'
import {
  extractResumeIntelligence as extractResumeIntelligenceWithHf,
  generateApplicationKit as generateApplicationKitWithHf,
  generateProfileSuggestions as generateProfileSuggestionsWithHf
} from '@/lib/hf'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1/chat/completions'
const DEFAULT_GATEWAY_MODEL = 'openai/gpt-5.4-mini'
const DEFAULT_GROQ_APPLICATION_MODEL = 'llama-3.3-70b-versatile'
const DEFAULT_GROQ_FAST_MODEL = 'openai/gpt-oss-20b'

type AiRuntimeOptions = {
  gatewayToken?: string | null
}

type GenerationTask = 'application' | 'fast'

function gatewayToken(options?: AiRuntimeOptions) {
  return (
    options?.gatewayToken ||
    process.env.AI_GATEWAY_API_KEY ||
    process.env.VERCEL_OIDC_TOKEN ||
    ''
  )
}

function extractJson<T>(text: string): T | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null

  try {
    return JSON.parse(match[0]) as T
  } catch {
    return null
  }
}

async function parseCompletion<T>(response: Response): Promise<T | null> {
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>
  }
  const content = payload.choices?.[0]?.message?.content
  return content ? extractJson<T>(content) : null
}

async function generateGroqJson<T>(
  system: string,
  user: string,
  task: GenerationTask
): Promise<T | null> {
  const token = process.env.GROQ_API_KEY || ''
  if (!token) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45_000)

  try {
    const model =
      task === 'application'
        ? process.env.GROQ_APPLICATION_MODEL || DEFAULT_GROQ_APPLICATION_MODEL
        : process.env.GROQ_FAST_MODEL || DEFAULT_GROQ_FAST_MODEL

    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.15,
        stream: false
      }),
      signal: controller.signal
    })

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500)
      throw new Error(`Groq returned ${response.status}: ${detail}`)
    }

    return parseCompletion<T>(response)
  } catch (error) {
    console.error('Groq text generation failed; trying the next provider.', error)
    return null
  } finally {
    clearTimeout(timeout)
  }
}

async function generateGatewayJson<T>(
  system: string,
  user: string,
  options?: AiRuntimeOptions
): Promise<T | null> {
  const token = gatewayToken(options)
  if (!token) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45_000)

  try {
    const response = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.AI_GATEWAY_TEXT_MODEL || DEFAULT_GATEWAY_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature: 0.2,
        stream: false
      }),
      signal: controller.signal
    })

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500)
      throw new Error(`AI Gateway returned ${response.status}: ${detail}`)
    }

    return parseCompletion<T>(response)
  } catch (error) {
    console.error('Vercel AI Gateway text generation failed; trying Hugging Face.', error)
    return null
  } finally {
    clearTimeout(timeout)
  }
}

async function generateJson<T>(
  system: string,
  user: string,
  task: GenerationTask,
  options?: AiRuntimeOptions
): Promise<T | null> {
  return (
    (await generateGroqJson<T>(system, user, task)) ||
    (await generateGatewayJson<T>(system, user, options))
  )
}

function deterministicResumeIntelligence(text: string): ParsedResume {
  return {
    name: '',
    summary: text.trim().slice(0, 650),
    skills: [],
    titles: [],
    yearsExperience: 0,
    education: [],
    locations: [],
    noticePeriod: ''
  }
}

function deterministicApplicationKit(input: {
  resumeText: string
  jobTitle: string
  company: string
}): ApplicationKit {
  return {
    whyFit: [
      `Your source resume is preserved for the ${input.jobTitle} role at ${input.company}.`,
      'JobPilot did not add unsupported skills, achievements, employers, or experience.',
      'Retry AI preparation when a generation provider is available for deeper tailoring.'
    ],
    coverLetter: `I am interested in the ${input.jobTitle} opportunity at ${input.company}. My application is based on the experience and achievements documented in my attached resume. I would welcome the opportunity to discuss how that background could support the needs of this role.`,
    resumeTweaks: [
      'Review the job description and emphasize only skills and outcomes already supported by your source resume.'
    ],
    screeningAnswers: [
      {
        question: 'Why are you interested in this role?',
        answer: `I am interested in the ${input.jobTitle} opportunity at ${input.company} and would like to explore how my documented experience aligns with the role.`
      },
      {
        question: 'Why are you a strong fit?',
        answer: 'Please use the evidence in my attached resume to assess fit; I prefer not to add unsupported claims.'
      },
      {
        question: 'What is your notice period?',
        answer: 'Please enter your current notice period.'
      }
    ],
    tailoredResume: {
      template: 'modern-ats',
      content: input.resumeText
    },
    atsReport: {
      score: 0,
      matchedKeywords: [],
      missingKeywords: [],
      warnings: ['AI generation is temporarily unavailable; JobPilot preserved the source resume without fabricating content.']
    }
  }
}

export async function extractResumeIntelligence(
  text: string,
  options?: AiRuntimeOptions
): Promise<ParsedResume> {
  const system =
    'You extract factual resume information. Return only valid JSON and never invent details.'
  const user = `Return this JSON shape: {"name":"","summary":"","skills":[],"titles":[],"yearsExperience":0,"education":[],"locations":[],"noticePeriod":""}\n\nResume:\n${text.slice(0, 12_000)}`

  const generated = await generateJson<ParsedResume>(system, user, 'fast', options)
  if (generated) return generated

  try {
    return await extractResumeIntelligenceWithHf(text)
  } catch (error) {
    console.error('Hugging Face resume extraction failed; using safe local fallback.', error)
    return deterministicResumeIntelligence(text)
  }
}

export async function generateApplicationKit(
  input: {
    resumeText: string
    jobTitle: string
    company: string
    jobDescription: string
  },
  options?: AiRuntimeOptions
): Promise<ApplicationKit> {
  const system = `You are a truthful senior-level ATS resume editor.

Use only facts explicitly supported by the original resume.
Never invent employers, dates, qualifications, tools, certifications, achievements, responsibilities, metrics, or years of experience.

Create a complete professional ATS-safe resume designed to render to approximately 2-3 pages when the source resume supports a senior candidate with substantial career history:
- use a single column and reverse-chronological experience
- preserve supported employment history, education, certifications, achievements, scale, ownership, governance, reliability, automation, stakeholder influence, and leadership evidence
- write a focused 3-5 sentence summary without exaggeration
- target 6-10 distinct achievement-oriented bullets for the current role when evidence supports them
- target 4-7 distinct bullets for earlier major roles when supported
- use strong natural verbs, concise bullets, and blank lines between sections
- never add page labels, tables, graphics, columns, photos, demographic details, or unsupported keywords
- if evidence is insufficient for 2-3 pages, remain truthful and shorter

Return only valid JSON.`

  const user = `Return this exact JSON structure:
{
  "whyFit": ["three factual concise bullets"],
  "coverLetter": "220-320 word factual draft",
  "resumeTweaks": ["truthful improvements"],
  "screeningAnswers": [
    {"question":"Why are you interested in this role?","answer":""},
    {"question":"Why are you a strong fit?","answer":""},
    {"question":"What is your notice period?","answer":""}
  ],
  "tailoredResume": {"template":"modern-ats","content":"Complete ATS resume in plain text with real line breaks"},
  "atsReport": {"score":0,"matchedKeywords":[],"missingKeywords":[],"warnings":[]}
}
ATS score must be 0-100. Never insert missing keywords as candidate skills unless the original resume supports them.

ORIGINAL RESUME:
${input.resumeText.slice(0, 10_000)}

TARGET JOB:
${input.jobTitle} at ${input.company}

JOB DESCRIPTION:
${input.jobDescription.slice(0, 7_000)}`

  const generated = await generateJson<ApplicationKit>(system, user, 'application', options)
  if (generated) return generated

  try {
    return await generateApplicationKitWithHf(input)
  } catch (error) {
    console.error('Hugging Face application generation failed; preserving source resume.', error)
    return deterministicApplicationKit(input)
  }
}

export async function generateProfileSuggestions(
  input: {
    resumeText: string
    recentJobs: string
  },
  options?: AiRuntimeOptions
) {
  const system =
    'You suggest truthful LinkedIn and Naukri profile improvements. Return only JSON. Never invent experience.'
  const user = `Return {"suggestions":[{"type":"linkedin_headline","content":"..."},{"type":"linkedin_about","content":"..."},{"type":"naukri_keywords","content":"..."}]}. Base suggestions on the resume and recurring keywords in recent matched jobs.\n\nRESUME:\n${input.resumeText.slice(0, 8_000)}\n\nRECENT JOB TEXT:\n${input.recentJobs.slice(0, 6_000)}`

  const generated = await generateJson<{
    suggestions: Array<{ type: string; content: string }>
  }>(system, user, 'fast', options)
  if (generated) return generated

  try {
    return await generateProfileSuggestionsWithHf(input)
  } catch (error) {
    console.error('Hugging Face profile generation failed; using profile fallbacks.', error)
    return { suggestions: [] as Array<{ type: string; content: string }> }
  }
}
