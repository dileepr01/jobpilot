import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateApplicationKit } from '@/lib/hf'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile, error: profileError } = await supabase.from('profiles').select('resume_text').eq('user_id', user.id).single()
  if (profileError || !profile?.resume_text) return NextResponse.json({ error: 'Upload a resume first' }, { status: 400 })

  const { data: match, error: matchError } = await supabase
    .from('matches')
    .select('id, jobs!inner(title, company, description)')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()
  if (matchError || !match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

  const jobRelation = match.jobs as unknown as { title: string; company: string; description: string }
  const kit = await generateApplicationKit({
    resumeText: profile.resume_text,
    jobTitle: jobRelation.title,
    company: jobRelation.company,
    jobDescription: jobRelation.description
  })

  const { error } = await supabase.from('matches').update({
    why_fit: kit.whyFit,
    cover_letter: kit.coverLetter,
    resume_tweaks: kit.resumeTweaks,
    screening_answers: kit.screeningAnswers,
    status: 'reviewed'
  }).eq('id', params.id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ kit })
}
