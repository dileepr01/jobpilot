import { createAdminClient } from '@/lib/supabase/admin'
import { generateProfileSuggestions } from '@/lib/hf'

const links: Record<string, string> = {
  linkedin_headline: 'https://www.linkedin.com/in/me/edit/top-card/',
  linkedin_about: 'https://www.linkedin.com/in/me/edit/about/',
  naukri_keywords: 'https://www.naukri.com/mnjuser/profile'
}

async function main() {
  const admin = createAdminClient()
  const { data: run, error: runError } = await admin.from('daily_runs').insert({ run_type: 'weekly_suggestions' }).select('id').single()
  if (runError) throw runError
  let created = 0

  try {
    const { data: profiles, error } = await admin.from('profiles').select('user_id, resume_text, linkedin_last_updated_at, naukri_last_updated_at').not('resume_text', 'is', null)
    if (error) throw error

    for (const profile of profiles || []) {
      const { data: matches } = await admin.from('matches').select('score, jobs!inner(title, description)').eq('user_id', profile.user_id).gte('score', 70).order('score', { ascending: false }).limit(20)
      const recentJobs = (matches || []).map((match: any) => {
        const job = match.jobs as unknown as { title: string; description: string }
        return `${job.title}\n${job.description}`
      }).join('\n\n')
      const generated = await generateProfileSuggestions({ resumeText: profile.resume_text, recentJobs })
      const suggestions = generated.suggestions.map((suggestion) => ({
        user_id: profile.user_id,
        type: suggestion.type,
        content: suggestion.content,
        deep_link: links[suggestion.type] || null
      }))

      const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000
      if (!profile.linkedin_last_updated_at || new Date(profile.linkedin_last_updated_at).getTime() < fourteenDaysAgo) suggestions.push({ user_id: profile.user_id, type: 'linkedin_freshness', content: 'Review your LinkedIn headline, About section, and top skills. Copy only the JobPilot suggestions that accurately reflect your current experience.', deep_link: 'https://www.linkedin.com/in/me/edit/top-card/' })
      if (!profile.naukri_last_updated_at || new Date(profile.naukri_last_updated_at).getTime() < fourteenDaysAgo) suggestions.push({ user_id: profile.user_id, type: 'naukri_freshness', content: 'Review and refresh your Naukri profile manually, including current role, notice period, preferred locations, and truthful key skills.', deep_link: 'https://www.naukri.com/mnjuser/profile' })

      if (suggestions.length) {
        const { error: insertError } = await admin.from('suggestions').insert(suggestions)
        if (insertError) console.error('[weekly-suggestions]', insertError.message)
        else created += suggestions.length
      }
    }

    await admin.from('daily_runs').update({ status: 'completed', completed_at: new Date().toISOString(), metrics: { profiles: profiles?.length || 0, suggestions: created } }).eq('id', run.id)
    console.log('Weekly suggestions completed', { created })
  } catch (error) {
    await admin.from('daily_runs').update({ status: 'failed', completed_at: new Date().toISOString(), error_message: error instanceof Error ? error.message : String(error) }).eq('id', run.id)
    throw error
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
