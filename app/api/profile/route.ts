import { NextResponse } from 'next/server'
import { z } from 'zod'
import { buildMatchingProfileText } from '@/lib/career-profile'
import { embedText } from '@/lib/hf'
import { createClient } from '@/lib/supabase/server'
import {
  SearchCooldownError,
  searchAndMatchForUser
} from '@/lib/user-job-search'
import type {
  CareerProfileData,
  JobPreferences,
  ParsedResume
} from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60

const preferenceSchema = z.object({
  targetRoles: z.array(z.string().trim().min(1).max(150)).max(20),
  locations: z.array(z.string().trim().min(1).max(150)).max(20),
  workModes: z.array(z.enum(['remote', 'hybrid', 'onsite'])).max(3),
  minSalary: z.number().nonnegative().optional(),
  noticePeriod: z.string().trim().max(150).optional().default(''),
  followedCompanies: z.array(z.string().trim().min(1).max(150)).max(50).optional().default([])
})

const careerSchema = z.object({
  headline: z.string().trim().max(250).default(''),
  summary: z.string().trim().max(3000).default(''),
  skills: z.array(z.string().trim().min(1).max(100)).max(60),
  currentTitle: z.string().trim().max(200).default(''),
  yearsExperience: z.number().min(0).max(70).optional()
})

const bodySchema = z.object({
  fullName: z.string().trim().max(200),
  preferences: preferenceSchema,
  careerProfile: careerSchema,
  emailDigestEnabled: z.boolean(),
  telegramEnabled: z.boolean(),
  telegramChatId: z.string().trim().max(200).nullable().optional()
})

function stable(value: unknown) {
  return JSON.stringify(value, Object.keys((value || {}) as object).sort())
}

function uniqueSkills(values: string[]) {
  const seen = new Set<string>()
  return values.filter((value) => {
    const key = value.trim().toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = bodySchema.parse(await request.json())
    const { data: existing, error: existingError } = await supabase
      .from('profiles')
      .select('resume_text, parsed_resume, preferences, career_profile')
      .eq('user_id', user.id)
      .single()

    if (existingError) throw existingError

    const previousPreferences = (existing.preferences || {}) as JobPreferences
    const previousCareer = (existing.career_profile || {}) as Partial<CareerProfileData>
    const careerProfile: CareerProfileData = {
      headline: body.careerProfile.headline,
      summary: body.careerProfile.summary,
      keywords: uniqueSkills(body.careerProfile.skills).join(', '),
      skills: uniqueSkills(body.careerProfile.skills),
      currentTitle: body.careerProfile.currentTitle,
      yearsExperience: body.careerProfile.yearsExperience,
      basedOnMatches: previousCareer.basedOnMatches || 0,
      source: 'user',
      updatedAt: new Date().toISOString()
    }

    const matchingChanged =
      stable(previousPreferences) !== stable(body.preferences) ||
      stable({
        headline: previousCareer.headline || '',
        summary: previousCareer.summary || '',
        skills: previousCareer.skills || [],
        currentTitle: previousCareer.currentTitle || '',
        yearsExperience: previousCareer.yearsExperience
      }) !== stable({
        headline: careerProfile.headline,
        summary: careerProfile.summary,
        skills: careerProfile.skills,
        currentTitle: careerProfile.currentTitle,
        yearsExperience: careerProfile.yearsExperience
      })

    const matchingText = buildMatchingProfileText({
      resumeText: existing.resume_text,
      parsedResume: (existing.parsed_resume || {}) as ParsedResume,
      careerProfile,
      preferences: body.preferences
    })

    if (!matchingText.trim()) {
      return NextResponse.json(
        { error: 'Add at least a target role, skill, headline, or resume before saving.' },
        { status: 400 }
      )
    }

    const matchingEmbedding = matchingChanged
      ? await embedText(matchingText)
      : undefined

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: body.fullName,
        preferences: body.preferences,
        career_profile: careerProfile,
        career_profile_updated_at: new Date().toISOString(),
        ...(matchingEmbedding ? { resume_embedding: matchingEmbedding } : {}),
        email_digest_enabled: body.emailDigestEnabled,
        telegram_enabled: body.telegramEnabled,
        telegram_chat_id: body.telegramChatId || null
      })
      .eq('user_id', user.id)

    if (updateError) throw updateError

    let search: Record<string, unknown> | null = null
    let searchMessage = 'No matching inputs changed.'

    if (matchingChanged) {
      try {
        search = await searchAndMatchForUser(supabase, user.id, 'profile_change')
        searchMessage = 'Job discovery and ranking refreshed from your Career Profile.'
      } catch (error) {
        if (error instanceof SearchCooldownError) {
          searchMessage = `Profile saved. Matching refresh was skipped because a search ran ${error.retryAfterSeconds}s too recently.`
        } else {
          console.error('[profile-search-refresh]', error)
          searchMessage = 'Profile saved. Live job refresh could not complete; you can run Search for jobs manually.'
        }
      }
    }

    return NextResponse.json({
      ok: true,
      matchingChanged,
      careerProfile,
      search,
      searchMessage
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save Career Profile.'
    console.error('[profile-update]', error)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
