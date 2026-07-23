import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { parseResume } from '@/lib/resume-parser'
import { embedText, heuristicResumeIntelligence } from '@/lib/hf'

export const runtime = 'nodejs'
export const maxDuration = 60

const preferencesSchema = z.object({
  targetRoles: z.array(z.string()).default([]),
  locations: z.array(z.string()).default([]),
  workModes: z.array(z.enum(['remote', 'hybrid', 'onsite'])).default([]),
  minSalary: z.number().positive().optional(),
  noticePeriod: z.string().optional(),
  followedCompanies: z.array(z.string()).optional()
})

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const form = await request.formData()
    const file = form.get('resume')
    if (!(file instanceof File)) return NextResponse.json({ error: 'Resume file is required' }, { status: 400 })

    const fullName = String(form.get('fullName') || '').trim()
    const preferencesJson = String(form.get('preferences') || '{}')
    const preferences = preferencesSchema.parse(JSON.parse(preferencesJson))
    const resumeText = await parseResume(file)

    const heuristic = heuristicResumeIntelligence(resumeText)

    const parsedResume = {
      ...heuristic,
      name: fullName || heuristic.name,
      titles: preferences.targetRoles.length
        ? preferences.targetRoles
        : heuristic.titles,
      locations: preferences.locations.length
        ? preferences.locations
        : heuristic.locations,
      noticePeriod:
        preferences.noticePeriod || heuristic.noticePeriod
    }

    const embedding = await embedText(resumeText)

    const extension = file.name.toLowerCase().endsWith('.docx') ? 'docx' : 'pdf'
    const path = `${user.id}/${crypto.randomUUID()}.${extension}`
    const { error: uploadError } = await supabase.storage.from('resumes').upload(path, file, {
      contentType: file.type,
      upsert: false
    })
    if (uploadError) throw uploadError

    const { data: previous } = await supabase.from('profiles').select('resume_url').eq('user_id', user.id).maybeSingle()
    const { error: profileError } = await supabase.from('profiles').upsert({
      user_id: user.id,
      full_name: fullName,
      preferences,
      resume_url: path,
      resume_filename: file.name,
      resume_text: resumeText,
      parsed_resume: parsedResume,
      resume_embedding: embedding
    }, { onConflict: 'user_id' })

    if (profileError) {
      await supabase.storage.from('resumes').remove([path])
      throw profileError
    }

    if (previous?.resume_url && previous.resume_url !== path) {
      await supabase.storage.from('resumes').remove([previous.resume_url])
    }

    return NextResponse.json({ ok: true, parsedResume })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Resume processing failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
