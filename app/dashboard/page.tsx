import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { JobCard, type MatchView } from '@/components/job-card'
import { EmptyState } from '@/components/empty-state'
import { FindJobsButton } from '@/components/find-jobs-button'

export const dynamic = 'force-dynamic'

function MatchGroup({ title, description, matches }: { title: string; description: string; matches: MatchView[] }) {
  if (!matches.length) return null

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-[-.025em]">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">{matches.length} roles</span>
      </div>
      <div className="space-y-4">
        {matches.map((match) => <JobCard key={match.id} initial={match} />)}
      </div>
    </section>
  )
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: matches } = await supabase
    .from('matches')
    .select('id, score, score_breakdown, status, why_fit, cover_letter, resume_tweaks, screening_answers, tailored_resume, ats_report, created_at, jobs!inner(title, company, location, work_mode, salary_min, salary_max, salary_currency, external_url, posted_at)')
    .eq('user_id', user!.id)
    .order('score', { ascending: false })
    .limit(100)

  const typed = (matches || []) as unknown as MatchView[]
  const strongMatches = typed.filter((match) => Number(match.score) >= 80)
  const potentialMatches = typed.filter((match) => Number(match.score) >= 50 && Number(match.score) < 80)
  const stretchMatches = typed.filter((match) => Number(match.score) < 50)
  const activeApplications = typed.filter((match) => ['applied', 'interview', 'offer'].includes(match.status)).length
  const interviews = typed.filter((match) => match.status === 'interview').length
  const topScore = typed.length ? Math.round(Math.max(...typed.map((match) => Number(match.score) || 0))) : 0

  return (
    <div className="mx-auto max-w-6xl">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/90 shadow-card">
        <div className="grid gap-7 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.17em] text-indigo-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Career command center
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-[-.04em] sm:text-4xl">Discover opportunities worth your time.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">Run a fresh search whenever you want. JobPilot ranks live results against your resume and preferences, then keeps every role connected to your application workflow.</p>
          </div>
          <FindJobsButton />
        </div>

        <div className="grid border-t border-slate-100 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Strong matches', String(strongMatches.length), '80%+ fit'],
            ['Best match', topScore ? `${topScore}%` : '—', 'Current search'],
            ['Active applications', String(activeApplications), 'Applied or later'],
            ['Interviews', String(interviews), 'In progress']
          ].map(([label, value, hint]) => (
            <div key={label} className="border-b border-slate-100 p-5 sm:border-r lg:border-b-0 last:border-r-0">
              <p className="text-xs font-bold uppercase tracking-[.12em] text-slate-400">{label}</p>
              <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">{value}</p>
              <p className="mt-1 text-xs font-medium text-slate-400">{hint}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-6">
          <p className="text-xs font-black uppercase tracking-[.16em] text-indigo-600">✦ JobPilot next action</p>
          {strongMatches.length ? (
            <>
              <h2 className="mt-3 text-xl font-black tracking-tight">Review your strongest matches before running another broad search.</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">You already have {strongMatches.length} role{strongMatches.length === 1 ? '' : 's'} above 80%. Open the fit reasoning, tailor the resume only for the best opportunities, and move promising roles into your pipeline.</p>
            </>
          ) : (
            <>
              <h2 className="mt-3 text-xl font-black tracking-tight">Run discovery against your latest profile.</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">JobPilot searches only when you ask, so starting a search now will fetch fresh opportunities using your current resume and preferences.</p>
            </>
          )}
        </div>
        <Link href="/dashboard/kanban" className="group rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white transition hover:-translate-y-0.5 hover:shadow-xl">
          <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-300">Application pipeline</p>
          <h2 className="mt-3 text-xl font-black tracking-tight">Keep every opportunity moving →</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Track reviewed, applied, interview, offer and rejected roles without losing the original job context.</p>
        </Link>
      </section>

      {typed.length ? (
        <>
          <MatchGroup title="Strong matches" description="Start here. These roles align most closely with your resume and search preferences." matches={strongMatches} />
          <MatchGroup title="Potential matches" description="Relevant roles with a few gaps worth reviewing before you tailor an application." matches={potentialMatches} />
          <MatchGroup title="Stretch matches" description="Partial alignment. Keep these visible without letting them distract from higher-probability roles." matches={stretchMatches} />
        </>
      ) : (
        <section className="mt-7">
          <EmptyState title="Your discovery feed is ready" body="Use Search for jobs to query live sources using your resume, target roles and locations. Results will appear here ranked by fit." />
        </section>
      )}
    </div>
  )
}
