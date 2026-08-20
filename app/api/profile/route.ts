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

function uniqueStrings(values: string[]) {
  const seen = new Set<string>()
  return values
    .map((value) => value.trim())
    .filter((value) => {
      const key = value.toLowerCase()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function normalizedStrings(values: string[] | undefined) {
  return uniqueStrings(values || []).map((value) => value.toLowerCase()).sort()
}

function sameStrings(left: string[] | undefined, right: string[] | undefined) {
  return JSON.stringify(normalizedStrings(left)) === JSON.stringify(normalizedStrings(right))
}

function sameText(left: unknown, right: unknown) {
  return String(left ?? '').trim() === String(right ?? '').trim()
}

function sameNumber(left: unknown, right: unknown) {
  const leftNumber = left === undefined || left === null || left === '' ? undefined : Number(left)
  const rightNumber = right === undefined || right === null || right === '' ? undefined : Number(right)
  return leftNumber === rightNumber
}

function changedFields(
  previousPreferences: JobPreferences,
  nextPreferences: JobPreferences,
  previousCareer: Partial<CareerProfileData>,
  nextCareer: CareerProfileData
) {
  const changes: string[] = []

  if (!sameText(previousCareer.headline, nextCareer.headline)) changes.push('headline')
  if (!sameText(previousCareer.summary, nextCareer.summary)) changes.push('summary')
  if (!sameStrings(previousCareer.skills, nextCareer.skills)) changes.push('skills')
  if (!sameText(previousCareer.currentTitle, nextCareer.currentTitle)) changes.push('current_title')
  if (!sameNumber(previousCareer.yearsExperience, nextCareer.yearsExperience)) changes.push('years_experience')
  if (!sameStrings(previousPreferences.targetRoles, nextPreferences.targetRoles)) changes.push('target_roles')
  if (!sameStrings(previousPreferences.locations, nextPreferences.locations)) changes.push('locations')
  if (!sameStrings(previousPreferences.workModes, nextPreferences.workModes)) changes.push('work_modes')
  if (!sameNumber(previousPreferences.minSalary, nextPreferences.minSalary)) changes.push('minimum_salary')
  if (!sameText(previousPreferences.noticePeriod, nextPreferences.noticePeriod)) changes.push('notice_period')
  if (!sameStrings(previousPreferences.followedCompanies, nextPreferences.followedCompanies)) changes.push('followed_companies')

  return changes
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
    const skills = uniqueStrings(body.careerProfile.skills)
    const careerProfile: CareerProfileData = {
      headline: body.careerProfile.headline,
      summary: body.careerProfile.summary,
      keywords: skills.join(', '),
      skills,
      currentTitle: body.careerProfile.currentTitle,
      yearsExperience: body.careerProfile.yearsExperience,
      basedOnMatches: previousCareer.basedOnMatches || 0,
      source: 'user',
      updatedAt: new Date().toISOString()
    }

    const changes = changedFields(
      previousPreferences,
      body.preferences,
      previousCareer,
      careerProfile
    )
    const matchingChanged = changes.length > 0

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
    let searchMessage = 'Career Profile saved. No matching inputs changed.'
    let searchTriggered = false

    if (matchingChanged) {
      try {
        search = await searchAndMatchForUser(supabase, user.id, 'profile_change')
        searchTriggered = true
        searchMessage = 'Career Profile saved. Job discovery and ranking refreshed from your changes.'
      } catch (error) {
        if (error instanceof SearchCooldownError) {
          searchMessage = `Career Profile saved. Matching refresh was skipped because a search ran ${error.retryAfterSeconds}s too recently.`
        } else {
          console.error('[profile-search-refresh]', error)
          searchMessage = 'Career Profile saved. Live job refresh could not complete; you can run Search for jobs manually.'
        }
      }

      const { error: eventError } = await supabase
        .from('career_profile_events')
        .insert({
          user_id: user.id,
          event_type: 'profile_change',
          changed_fields: changes,
          search_triggered: searchTriggered
        })

      if (eventError) {
        console.error('[career-profile-event]', eventError.message)
      }
    }

    return NextResponse.json({
      ok: true,
      matchingChanged,
      changedFields: changes,
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
