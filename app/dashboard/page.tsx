import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { JobCard, type MatchView } from '@/components/job-card'
import { EmptyState } from '@/components/empty-state'
import { FindJobsButton } from '@/components/find-jobs-button'
import { buildApplicationInsights } from '@/lib/application-insights'

export const dynamic = 'force-dynamic'

function bucket(match: MatchView) {
  return match.score_breakdown?.bucket || (Number(match.score) >= 85 ? 'apply_now' : Number(match.score) >= 65 ? 'consider' : 'skip')
}

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

  const [
    { data: matches },
    { data: latestSearch },
    { data: profile }
  ] = await Promise.all([
    supabase
      .from('matches')
      .select('id, score, score_breakdown, status, why_fit, cover_letter, resume_tweaks, screening_answers, tailored_resume, ats_report, application_pack, created_at, jobs!inner(title, company, location, work_mode, salary_min, salary_max, salary_currency, external_url, posted_at)')
      .eq('user_id', user!.id)
      .order('score', { ascending: false })
      .limit(100),
    supabase
      .from('job_search_runs')
      .select('metrics, completed_at, trigger')
      .eq('user_id', user!.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user!.id)
      .single()
  ])

  const typed = (matches || []) as unknown as MatchView[]
  const applyNow = typed.filter((match) => bucket(match) === 'apply_now')
  const consider = typed.filter((match) => bucket(match) === 'consider')
  const skipped = typed.filter((match) => bucket(match) === 'skip')
  const activeApplications = typed.filter((match) => ['applied', 'interview', 'offer'].includes(match.status)).length
  const topScore = typed.length ? Math.round(Math.max(...typed.map((match) => Number(match.score) || 0))) : 0
  const insights = buildApplicationInsights(typed)
  const metrics = (latestSearch?.metrics || {}) as Record<string, any>
  const analyzed = Number(metrics.discovered || metrics.selected || typed.length || 0)
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || 'there'
  const worthAttention = applyNow.length + consider.length

  return (
    <div className="mx-auto max-w-6xl">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/90 shadow-card">
        <div className="grid gap-7 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.17em] text-indigo-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Today
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-[-.04em] sm:text-4xl">Good to see you, {firstName}. {worthAttention ? `${worthAttention} opportunities are worth your attention.` : 'Your next strong opportunity starts with a focused search.'}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              JobPilot {analyzed ? `analyzed ${analyzed} recent roles` : 'ranks live roles'} using your Career Profile, seniority, verified skills, preferences and job freshness. It is designed to optimize interviews per application—not application volume.
            </p>
          </div>
          <FindJobsButton />
        </div>

        <div className="grid border-t border-slate-100 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Apply now', String(applyNow.length), '85+ opportunity score'],
            ['Best opportunity', topScore ? String(topScore) : '—', 'Current ranked feed'],
            ['Interview conversion', insights.submitted ? `${insights.conversionRate}%` : '—', insights.submitted ? `${insights.responses}/${insights.submitted} positive outcomes` : 'Record application outcomes'],
            ['Active applications', String(activeApplications), 'Applied or later']
          ].map(([label, value, hint]) => (
            <div key={label} className="border-b border-slate-100 p-5 sm:border-r lg:border-b-0 last:border-r-0">
              <p className="text-xs font-bold uppercase tracking-[.12em] text-slate-400">{label}</p>
              <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">{value}</p>
              <p className="mt-1 text-xs font-medium text-slate-400">{hint}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 p-6 lg:col-span-2">
          <p className="text-xs font-black uppercase tracking-[.16em] text-emerald-700">✦ JobPilot next action</p>
          {applyNow.length ? (
            <>
              <h2 className="mt-3 text-xl font-black tracking-tight">Prepare applications for your {applyNow.length} highest-probability role{applyNow.length === 1 ? '' : 's'}.</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Use Prepare application to generate the truthful tailored resume, ATS gaps, recruiter note, referral request and interview questions. Skip low-priority roles until these are reviewed.</p>
            </>
          ) : (
            <>
              <h2 className="mt-3 text-xl font-black tracking-tight">Refine your Career Profile, then run a fresh search.</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">A current title, verified skills and realistic target roles give JobPilot better information than repeated resume uploads.</p>
            </>
          )}
        </div>
        <Link href="/dashboard/profile" className="group rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white transition hover:-translate-y-0.5 hover:shadow-xl">
          <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-300">Career Profile</p>
          <h2 className="mt-3 text-xl font-black tracking-tight">Update skills or targets →</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Meaningful profile changes can refresh matching and sync genuine deltas to Naukri.</p>
        </Link>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-3xl border border-indigo-100 bg-indigo-50/50 p-6">
          <p className="text-xs font-black uppercase tracking-[.16em] text-indigo-600">Learning loop</p>
          <h2 className="mt-3 text-xl font-black tracking-tight">JobPilot learns from outcomes, not clicks.</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{insights.recommendation}</p>
          {insights.segments.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {insights.segments.map((segment) => (
                <span key={segment.name} className="rounded-full bg-white px-3 py-2 text-xs font-bold text-slate-600">
                  {segment.name}: {segment.rate}% ({segment.responses}/{segment.submitted})
                </span>
              ))}
            </div>
          )}
        </div>
        <Link href="/dashboard/kanban" className="group rounded-3xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
          <p className="text-xs font-black uppercase tracking-[.16em] text-slate-400">Application pipeline</p>
          <h2 className="mt-3 text-xl font-black tracking-tight">Keep outcomes current →</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Move roles through Applied, Interview, Offer or Rejected. Those outcomes power the learning loop.</p>
        </Link>
      </section>

      {typed.length ? (
        <>
          <MatchGroup title="🔥 Apply now" description="High-fit, seniority-aligned and timely opportunities. Spend your application effort here first." matches={applyNow} />
          <MatchGroup title="🧠 Worth considering" description="Relevant opportunities with one or more trade-offs worth checking before you tailor an application." matches={consider} />
          {skipped.length > 0 && (
            <details className="mt-10 rounded-3xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
              <summary className="cursor-pointer text-lg font-black text-slate-700">🚫 Low priority — {skipped.length} roles JobPilot recommends deprioritizing</summary>
              <p className="mt-2 text-sm leading-6 text-slate-500">These remain available for transparency, but they score below the threshold because of fit, seniority, preferences or freshness.</p>
              <div className="mt-5 space-y-4">
                {skipped.slice(0, 20).map((match) => <JobCard key={match.id} initial={match} />)}
              </div>
            </details>
          )}
        </>
      ) : (
        <section className="mt-7">
          <EmptyState title="Your opportunity feed is ready" body="Add or confirm your Career Profile, then use Search for jobs. JobPilot will rank live opportunities into Apply now, Worth considering and Low priority." />
        </section>
      )}
    </div>
  )
}
