import type { ApplicationKit, ParsedResume } from '@/lib/types'
import {
  extractResumeIntelligence as extractResumeIntelligenceWithHf,
  generateApplicationKit as generateApplicationKitWithHf,
  generateProfileSuggestions as generateProfileSuggestionsWithHf
} from '@/lib/hf'

const GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1/chat/completions'
const DEFAULT_GATEWAY_MODEL = 'openai/gpt-5.4-mini'

function gatewayToken() {
  return process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || ''
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

async function generateGatewayJson<T>(system: string, user: string): Promise<T | null> {
  const token = gatewayToken()
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

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>
    }
    const content = payload.choices?.[0]?.message?.content
    if (!content) return null

    return extractJson<T>(content)
  } catch (error) {
    console.error('Vercel AI Gateway text generation failed; falling back to Hugging Face.', error)
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export async function extractResumeIntelligence(text: string): Promise<ParsedResume> {
  const generated = await generateGatewayJson<ParsedResume>(
    'You extract factual resume information. Return only valid JSON and never invent details.',
    `Return this JSON shape: {"name":"","summary":"","skills":[],"titles":[],"yearsExperience":0,"education":[],"locations":[],"noticePeriod":""}\n\nResume:\n${text.slice(0, 18_000)}`
  )

  return generated || extractResumeIntelligenceWithHf(text)
}

export async function generateApplicationKit(input: {
  resumeText: string
  jobTitle: string
  company: string
  jobDescription: string
}): Promise<ApplicationKit> {
  const generated = await generateGatewayJson<ApplicationKit>(
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
Missing keywords must not be inserted as candidate skills unless the original resume supports them.
For senior candidates, prioritize depth, scope, ownership, and measurable evidence over artificial brevity. The tailored resume should normally contain enough supported detail to fill 2-3 professional pages without repetition or fabricated content.

ORIGINAL RESUME:
${input.resumeText.slice(0, 18_000)}

TARGET JOB:
${input.jobTitle} at ${input.company}

JOB DESCRIPTION:
${input.jobDescription.slice(0, 14_000)}`
  )

  return generated || generateApplicationKitWithHf(input)
}

export async function generateProfileSuggestions(input: {
  resumeText: string
  recentJobs: string
}) {
  const generated = await generateGatewayJson<{
    suggestions: Array<{ type: string; content: string }>
  }>(
    'You suggest truthful LinkedIn and Naukri profile improvements. Return only JSON. Never invent experience.',
    `Return {"suggestions":[{"type":"linkedin_headline","content":"..."},{"type":"linkedin_about","content":"..."},{"type":"naukri_keywords","content":"..."}]}. Base suggestions on the resume and recurring keywords in recent matched jobs.\n\nRESUME:\n${input.resumeText.slice(0, 12_000)}\n\nRECENT JOB TEXT:\n${input.recentJobs.slice(0, 10_000)}`
  )

  return generated || generateProfileSuggestionsWithHf(input)
}
