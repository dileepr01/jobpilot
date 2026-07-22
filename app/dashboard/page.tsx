import { createClient } from '@/lib/supabase/server'
import { JobCard, type MatchView } from '@/components/job-card'
import { EmptyState } from '@/components/empty-state'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: matches } = await supabase
    .from('matches')
    .select('id, score, score_breakdown, status, why_fit, cover_letter, resume_tweaks, screening_answers, created_at, jobs!inner(title, company, location, work_mode, salary_min, salary_max, salary_currency, external_url, posted_at)')
    .eq('user_id', user!.id)
    .order('score', { ascending: false })
    .limit(30)

  const typed = (matches || []) as unknown as MatchView[]
  const highMatches = typed.filter((match) => Number(match.score) >= 75).length
  const applied = typed.filter((match) => ['applied', 'interview', 'offer'].includes(match.status)).length
  const interviews = typed.filter((match) => match.status === 'interview').length

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-indigo-600">Daily digest</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Your strongest matches</h1>
          <p className="mt-2 text-sm text-slate-500">Sorted by combined resume similarity and preferences.</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">Human review required before applying</div>
      </div>

      <section className="mt-7 grid gap-3 sm:grid-cols-3">
        {[['High matches', highMatches], ['Applied', applied], ['Interviews', interviews]].map(([label, value]) => (
          <div key={String(label)} className="card p-5"><p className="text-sm font-semibold text-slate-500">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></div>
        ))}
      </section>

      <section className="mt-7 space-y-4">
        {typed.length ? typed.map((match) => <JobCard key={match.id} initial={match} />) : <EmptyState title="No matches yet" body="The daily GitHub Actions workflow will populate this page after your Supabase and job API secrets are configured. You can also run the workflow manually." />}
      </section>
    </div>
  )
}
