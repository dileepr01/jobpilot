import type { SupabaseClient } from '@supabase/supabase-js'
import { generateProfileSuggestions } from '@/lib/ai-text'
import type {
  CareerProfileData,
  JobPreferences,
  ParsedResume
} from '@/lib/types'

export type CareerProfile = CareerProfileData

function textSuggestion(
  suggestions: Array<{ type: string; content: string }>,
  type: string
) {
  return suggestions.find((item) => item.type === type)?.content?.trim() || ''
}

function csv(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function unique(values: string[]) {
  const seen = new Set<string>()
  return values.filter((value) => {
    const normalized = value.trim().toLowerCase()
    if (!normalized || seen.has(normalized)) return false
    seen.add(normalized)
    return true
  })
}

function fallbackHeadline(parsed: ParsedResume, preferences: JobPreferences) {
  return parsed.titles?.[0] || preferences.targetRoles?.[0] || 'Open to relevant opportunities'
}

function fallbackSummary(parsed: ParsedResume, resumeText: string) {
  return parsed.summary?.trim() || resumeText.trim().slice(0, 650)
}

function fallbackKeywords(parsed: ParsedResume) {
  return (parsed.skills || []).slice(0, 20).join(', ')
}

export function buildMatchingProfileText(input: {
  resumeText?: string | null
  parsedResume?: ParsedResume | null
  careerProfile?: Partial<CareerProfile> | null
  preferences?: JobPreferences | null
}) {
  const parsed = input.parsedResume || ({} as ParsedResume)
  const career = input.careerProfile || {}
  const preferences = input.preferences || ({} as JobPreferences)
  const skills = unique([
    ...(career.skills || []),
    ...csv(career.keywords || ''),
    ...(parsed.skills || [])
  ])

  return [
    input.resumeText || '',
    career.headline || '',
    career.currentTitle || '',
    career.summary || '',
    skills.join(', '),
    `Target roles: ${(preferences.targetRoles || []).join(', ')}`,
    `Preferred locations: ${(preferences.locations || []).join(', ')}`,
    `Work modes: ${(preferences.workModes || []).join(', ')}`,
    preferences.noticePeriod ? `Notice period: ${preferences.noticePeriod}` : ''
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 18_000)
}

export async function refreshCareerProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<CareerProfile> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('resume_text, parsed_resume, preferences, career_profile')
    .eq('user_id', userId)
    .single()

  if (profileError) throw profileError

  const parsed = (profile?.parsed_resume || {}) as ParsedResume
  const preferences = (profile?.preferences || {}) as JobPreferences
  const existing = (profile?.career_profile || {}) as Partial<CareerProfile>
  const resumeText = profile?.resume_text || ''

  if (!resumeText && !(existing.skills || []).length && !existing.headline) {
    throw new Error('Add Career Profile details or upload a resume before refreshing.')
  }

  const { data: matches, error: matchesError } = await supabase
    .from('matches')
    .select('score, jobs!inner(title, description)')
    .eq('user_id', userId)
    .gte('score', 65)
    .order('score', { ascending: false })
    .limit(20)

  if (matchesError) throw matchesError

  const recentJobs = (matches || [])
    .map((match) => {
      const job = match.jobs as unknown as { title: string; description: string }
      return `${job.title}\n${job.description}`
    })
    .join('\n\n')

  const generated = resumeText
    ? await generateProfileSuggestions({ resumeText, recentJobs })
    : { suggestions: [] as Array<{ type: string; content: string }> }

  const generatedKeywords =
    textSuggestion(generated.suggestions, 'naukri_keywords') || fallbackKeywords(parsed)
  const generatedSkills = unique([
    ...(parsed.skills || []),
    ...csv(generatedKeywords)
  ]).slice(0, 40)
  const preserveManual = existing.source === 'user'

  const careerProfile: CareerProfile = {
    headline:
      preserveManual && existing.headline
        ? existing.headline
        : textSuggestion(generated.suggestions, 'linkedin_headline') ||
          existing.headline ||
          fallbackHeadline(parsed, preferences),
    summary:
      preserveManual && existing.summary
        ? existing.summary
        : textSuggestion(generated.suggestions, 'linkedin_about') ||
          existing.summary ||
          fallbackSummary(parsed, resumeText),
    keywords:
      preserveManual && existing.keywords
        ? existing.keywords
        : generatedKeywords || existing.keywords || '',
    skills:
      preserveManual && existing.skills?.length
        ? unique(existing.skills)
        : generatedSkills.length
          ? generatedSkills
          : unique(existing.skills || []),
    currentTitle:
      preserveManual && existing.currentTitle
        ? existing.currentTitle
        : existing.currentTitle || parsed.titles?.[0] || preferences.targetRoles?.[0] || '',
    yearsExperience: existing.yearsExperience ?? parsed.yearsExperience,
    basedOnMatches: matches?.length || 0,
    source: preserveManual ? 'user' : 'ai-assisted',
    updatedAt: new Date().toISOString()
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      career_profile: careerProfile,
      career_profile_updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)

  if (updateError) throw updateError
  return careerProfile
}
