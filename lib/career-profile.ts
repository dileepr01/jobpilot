import type { SupabaseClient } from '@supabase/supabase-js'
import { generateProfileSuggestions } from '@/lib/hf'
import type { JobPreferences, ParsedResume } from '@/lib/types'

export type CareerProfile = {
  headline: string
  summary: string
  keywords: string
  basedOnMatches: number
}

function textSuggestion(
  suggestions: Array<{ type: string; content: string }>,
  type: string
) {
  return suggestions.find((item) => item.type === type)?.content?.trim() || ''
}

function fallbackHeadline(parsed: ParsedResume, preferences: JobPreferences) {
  return (
    parsed.titles?.[0] ||
    preferences.targetRoles?.[0] ||
    'Open to relevant opportunities'
  )
}

function fallbackSummary(parsed: ParsedResume, resumeText: string) {
  return parsed.summary?.trim() || resumeText.trim().slice(0, 650)
}

function fallbackKeywords(parsed: ParsedResume) {
  return (parsed.skills || []).slice(0, 20).join(', ')
}

export async function refreshCareerProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<CareerProfile> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('resume_text, parsed_resume, preferences')
    .eq('user_id', userId)
    .single()

  if (profileError) throw profileError
  if (!profile?.resume_text) throw new Error('Upload a resume before refreshing Career Insights.')

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

  const generated = await generateProfileSuggestions({
    resumeText: profile.resume_text,
    recentJobs
  })

  const parsed = (profile.parsed_resume || {}) as ParsedResume
  const preferences = (profile.preferences || {}) as JobPreferences

  const careerProfile: CareerProfile = {
    headline:
      textSuggestion(generated.suggestions, 'linkedin_headline') ||
      fallbackHeadline(parsed, preferences),
    summary:
      textSuggestion(generated.suggestions, 'linkedin_about') ||
      fallbackSummary(parsed, profile.resume_text),
    keywords:
      textSuggestion(generated.suggestions, 'naukri_keywords') ||
      fallbackKeywords(parsed),
    basedOnMatches: matches?.length || 0
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
