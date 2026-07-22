import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseResume } from '@/lib/resume-parser'
import { extractResumeIntelligence } from '@/lib/hf'

export const runtime = 'nodejs'
export const maxDuration = 60

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

    const form = await request.formData()
    const file = form.get('resume')

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Resume file is required' },
        { status: 400 }
      )
    }

    const resumeText = await parseResume(file)
    const parsedResume = await extractResumeIntelligence(resumeText)

    return NextResponse.json({ parsedResume })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not read the resume'

    return NextResponse.json({ error: message }, { status: 400 })
  }
}
