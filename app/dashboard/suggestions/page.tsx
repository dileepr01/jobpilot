import { CareerProfileControls } from '@/components/career-profile-controls'
import type { CareerProfile } from '@/lib/career-profile'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function SuggestionsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profile }, { data: latestSearch }] = await Promise.all([
    supabase
      .from('profiles')
      .select('auto_career_profile, career_profile, career_profile_updated_at')
      .eq('user_id', user!.id)
      .single(),
    supabase
      .from('job_search_runs')
      .select('completed_at')
      .eq('user_id', user!.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  ])

  const career = (profile?.career_profile || {}) as Partial<CareerProfile>
  const profileUpdatedAt = profile?.career_profile_updated_at
    ? new Date(profile.career_profile_updated_at).getTime()
    : 0
  const latestSearchAt = latestSearch?.completed_at
    ? new Date(latestSearch.completed_at).getTime()
    : 0
  const autoEnabled = profile?.auto_career_profile !== false
  const refreshOnLoad = autoEnabled && (!profileUpdatedAt || latestSearchAt > profileUpdatedAt)

  const lastUpdated = profile?.career_profile_updated_at
    ? new Date(profile.career_profile_updated_at).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    : 'Not generated yet'

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm font-bold text-indigo-600">Career intelligence</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Your JobPilot Career Profile</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
        JobPilot keeps this profile current using your resume, target preferences and strongest matched roles. LinkedIn and Naukri are optional destinations, not required inputs.
      </p>

      <section className="mt-7 rounded-[1.75rem] border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-5 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[.16em] text-indigo-600">Automatic profile intelligence</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Keep JobPilot updated for me</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              When enabled, JobPilot refreshes this internal profile whenever Career Insights detects a newer completed search. It never changes employers, dates, qualifications or other factual history.
            </p>
          </div>
          <div className="rounded-2xl border border-white bg-white/80 px-4 py-3 text-sm shadow-sm">
            <p className="font-bold text-slate-900">Last updated</p>
            <p className="mt-1 text-xs text-slate-500">{lastUpdated}</p>
          </div>
        </div>
        <CareerProfileControls enabled={autoEnabled} refreshOnLoad={refreshOnLoad} />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <article className="card p-5 sm:p-6 lg:col-span-1">
          <p className="text-xs font-black uppercase tracking-[.15em] text-slate-400">Career headline</p>
          <p className="mt-3 text-lg font-black leading-7 text-slate-950">
            {career.headline || 'Refresh Career Insights to create your JobPilot headline.'}
          </p>
        </article>

        <article className="card p-5 sm:p-6 lg:col-span-2">
          <p className="text-xs font-black uppercase tracking-[.15em] text-slate-400">Professional summary</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
            {career.summary || 'JobPilot will build a concise professional summary from your existing resume facts.'}
          </p>
        </article>

        <article className="card p-5 sm:p-6 lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-[.15em] text-slate-400">Market-aligned keywords</p>
            <p className="text-xs font-semibold text-slate-400">Based on {career.basedOnMatches || 0} strong/relevant matches</p>
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            {career.keywords || 'Refresh after your next job search to identify recurring market keywords already supported by your experience.'}
          </p>
        </article>
      </section>

      <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[.15em] text-slate-400">Optional external profiles</p>
        <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">Use JobPilot insights anywhere you want</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          External profiles are optional. JobPilot cannot silently edit them without provider-approved profile permissions, but you can open them when you want to copy an approved headline, summary or keywords.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <a className="btn-secondary" href="https://www.linkedin.com/in/me/edit/top-card/" target="_blank" rel="noreferrer">Open LinkedIn ↗</a>
          <a className="btn-secondary" href="https://www.naukri.com/mnjuser/profile" target="_blank" rel="noreferrer">Open Naukri ↗</a>
        </div>
      </section>
    </div>
  )
}
