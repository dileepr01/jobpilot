import { createClient } from '@/lib/supabase/server'
import { JobCard, type MatchView } from '@/components/job-card'
import { EmptyState } from '@/components/empty-state'

export const dynamic = 'force-dynamic'

function MatchGroup({
  title,
  description,
  matches
}: {
  title: string
  description: string
  matches: MatchView[]
}) {
  if (!matches.length) return null

  return (
    <section className="mt-9">
      <div className="mb-4">
        <h2 className="text-2xl font-black tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>

      <div className="space-y-4">
        {matches.map((match) => (
          <JobCard key={match.id} initial={match} />
        ))}
      </div>
    </section>
  )
}

export default async function DashboardPage() {
  const supabase = createClient()

  const {
    data: { user }
  } = await supabase.auth.getUser()

  const { data: matches } = await supabase
    .from('matches')
    .select(
      'id, score, score_breakdown, status, why_fit, cover_letter, resume_tweaks, screening_answers, tailored_resume, ats_report, created_at, jobs!inner(title, company, location, work_mode, salary_min, salary_max, salary_currency, external_url, posted_at)'
    )
    .eq('user_id', user!.id)
    .order('score', { ascending: false })
    .limit(100)

  const typed = (matches || []) as unknown as MatchView[]

  const strongMatches = typed.filter(
    (match) => Number(match.score) >= 80
  )

  const potentialMatches = typed.filter(
    (match) =>
      Number(match.score) >= 50 &&
      Number(match.score) < 80
  )

  const stretchMatches = typed.filter(
    (match) => Number(match.score) < 50
  )

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-indigo-600">
            Personalized results
          </p>

          <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
            Your job matches
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Ranked using your resume and matching preferences.
          </p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
          Review every role before applying
        </div>
      </div>

      <section className="mt-7 grid gap-3 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm font-semibold text-slate-500">
            Strong matches
          </p>
          <p className="mt-2 text-3xl font-black">
            {strongMatches.length}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            80% and above
          </p>
        </div>

        <div className="card p-5">
          <p className="text-sm font-semibold text-slate-500">
            Potential matches
          </p>
          <p className="mt-2 text-3xl font-black">
            {potentialMatches.length}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            50% to 79%
          </p>
        </div>

        <div className="card p-5">
          <p className="text-sm font-semibold text-slate-500">
            Stretch matches
          </p>
          <p className="mt-2 text-3xl font-black">
            {stretchMatches.length}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Below 50%
          </p>
        </div>
      </section>

      {typed.length ? (
        <>
          <MatchGroup
            title="Strong matches"
            description="Roles closely aligned with your resume and preferences."
            matches={strongMatches}
          />

          <MatchGroup
            title="Potential matches"
            description="Relevant roles that may require reviewing a few gaps."
            matches={potentialMatches}
          />

          <MatchGroup
            title="Stretch matches"
            description="Roles with partial alignment that may still be worth exploring."
            matches={stretchMatches}
          />
        </>
      ) : (
        <section className="mt-7">
          <EmptyState
            title="No matches found"
            body="Review your target roles and locations, then try matching again."
          />
        </section>
      )}
    </div>
  )
}
