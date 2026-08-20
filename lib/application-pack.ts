import type { ApplicationKit, ApplicationPack } from '@/lib/types'

const STOP_WORDS = new Set([
  'with', 'from', 'that', 'this', 'your', 'you', 'will', 'have', 'into', 'using',
  'work', 'role', 'team', 'years', 'experience', 'skills', 'strong', 'about',
  'their', 'they', 'them', 'what', 'when', 'where', 'which', 'responsible',
  'requirements', 'preferred', 'required', 'including', 'across', 'within'
])

function topKeywords(text: string, limit = 6) {
  const counts = new Map<string, number>()
  for (const token of text.toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) || []) {
    if (STOP_WORDS.has(token)) continue
    counts.set(token, (counts.get(token) || 0) + 1)
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([token]) => token)
}

function sentence(value: string) {
  const trimmed = value.trim().replace(/^[-•\s]+/, '')
  if (!trimmed) return ''
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

export function buildApplicationPack(input: {
  jobTitle: string
  company: string
  jobDescription: string
  kit: ApplicationKit
}): ApplicationPack {
  const fit = (input.kit.whyFit || []).filter(Boolean).slice(0, 2).map(sentence)
  const missing = (input.kit.atsReport?.missingKeywords || []).filter(Boolean).slice(0, 10)
  const themes = topKeywords(input.jobDescription)

  const recruiterMessage = [
    `Hi, I’m interested in the ${input.jobTitle} opportunity at ${input.company}.`,
    fit[0] || 'My background aligns with several of the role’s core requirements.',
    'I would be glad to share a concise, role-specific resume and discuss the fit.'
  ].join(' ')

  const referralMessage = [
    `Hi — I’m exploring the ${input.jobTitle} role at ${input.company}.`,
    fit[0] || 'The position appears closely aligned with my background.',
    'If you feel my experience is relevant, would you be comfortable referring me or pointing me to the right hiring contact? No worries if not.'
  ].join(' ')

  const companySummary = themes.length
    ? `${input.company} is hiring this role around themes such as ${themes.join(', ')}. Use the original job posting and company sources for deeper company research before an interview.`
    : `${input.company} is hiring for ${input.jobTitle}. Review the original posting and official company information before the interview.`

  const interviewQuestions = [
    `Walk me through the experience that best prepares you for this ${input.jobTitle} role.`,
    `Which achievement from your background is most relevant to ${input.company}, and why?`,
    ...themes.slice(0, 4).map((theme) => `Tell me about a time you used or owned ${theme} in a real production or business context.`),
    ...missing.slice(0, 2).map((keyword) => `The job mentions ${keyword}. What directly relevant experience do you have, and where is the gap?`)
  ].slice(0, 8)

  return {
    recruiterMessage,
    referralMessage,
    companySummary,
    missingRequirements: missing,
    interviewQuestions
  }
}
