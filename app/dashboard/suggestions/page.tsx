import Link from 'next/link'
import { CareerProfileControls } from '@/components/career-profile-controls'
import {
  NaukriAutoRefresh,
  type NaukriConnectionView
} from '@/components/naukri-auto-refresh'
import type { CareerProfile } from '@/lib/career-profile'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function SuggestionsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: profile },
    { data: latestSearch },
    { data: naukriConnection }
  ] = await Promise.all([
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
      .maybeSingle(),
    supabase
      .from('naukri_connections')
      .select('enabled, status, profile_id, last_attempt_at, last_sync_at, last_error')
      .eq('user_id', user!.id)
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
  const refreshOnLoad = autoEnabled && career.source !== 'user' && (!profileUpdatedAt || latestSearchAt > profileUpdatedAt)

  const lastUpdated = profile?.career_profile_updated_at
    ? new Date(profile.career_profile_updated_at).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    : 'Not generated yet'

  const connection: NaukriConnectionView = naukriConnection
    ? {
        enabled: naukriConnection.enabled,
        status: naukriConnection.status,
        profileId: naukriConnection.profile_id,
        lastAttemptAt: naukriConnection.last_attempt_at,
        lastSyncAt: naukriConnection.last_sync_at,
        lastError: naukriConnection.last_error
      }
    : null

  const skillCount = career.skills?.length || 0
  const profileStrength = [
    Boolean(career.headline),
    Boolean(career.summary),
    skillCount >= 5,
    Boolean(career.currentTitle),
    Boolean(career.yearsExperience)
  ].filter(Boolean).length
  const strengthPercent = Math.round((profileStrength / 5) * 100)

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm font-bold text-indigo-600">Career Presence</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Keep your market profile accurate and discoverable</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
        Your editable Career Profile is the source of truth. JobPilot can use market signals to suggest improvements, mirror genuine changes to a connected Naukri profile, and keep LinkedIn edits fully under your control.
      </p>

      <section className="mt-7 grid gap-4 sm:grid-cols-3">
        <article className="card p-5">
          <p className="text-xs font-black uppercase tracking-[.14em] text-slate-400">JobPilot profile</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{strengthPercent}%</p>
          <p className="mt-1 text-xs text-slate-500">{skillCount} verified skill{skillCount === 1 ? '' : 's'} · last changed {lastUpdated}</p>
        </article>
        <article className="card p-5">
          <p className="text-xs font-black uppercase tracking-[.14em] text-slate-400">Naukri</p>
          <p className="mt-2 text-xl font-black text-slate-950">{connection?.enabled ? 'Connected' : 'Manual / not connected'}</p>
          <p className="mt-1 text-xs text-slate-500">{connection?.enabled ? 'Genuine profile deltas can sync after Career Profile changes.' : 'Connect below if you want profile delta sync.'}</p>
        </article>
        <article className="card p-5">
          <p className="text-xs font-black uppercase tracking-[.14em] text-slate-400">LinkedIn</p>
          <p className="mt-2 text-xl font-black text-slate-950">Manual by design</p>
          <p className="mt-1 text-xs text-slate-500">JobPilot suggests wording; you decide what is published.</p>
        </article>
      </section>

      <section className="mt-6 rounded-[1.75rem] border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-cyan-50 p-5 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[.16em] text-indigo-600">AI-assisted profile intelligence</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Use market signals without overwriting your facts</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              JobPilot can refresh suggested headline, summary and keywords from your source resume and relevant jobs. Once you manually edit the Career Profile, those user-verified fields remain authoritative instead of being silently overwritten.
            </p>
          </div>
          <div className="rounded-2xl border border-white bg-white/80 px-4 py-3 text-sm shadow-sm">
            <p className="font-bold text-slate-900">Last intelligence refresh</p>
            <p className="mt-1 text-xs text-slate-500">{lastUpdated}</p>
          </div>
        </div>
        <CareerProfileControls enabled={autoEnabled} refreshOnLoad={refreshOnLoad} />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <article className="card p-5 sm:p-6">
          <p className="text-xs font-black uppercase tracking-[.15em] text-slate-400">Current title</p>
          <p className="mt-3 text-lg font-black leading-7 text-slate-950">{career.currentTitle || 'Add your current title in Career Profile.'}</p>
        </article>
        <article className="card p-5 sm:p-6 lg:col-span-2">
          <p className="text-xs font-black uppercase tracking-[.15em] text-slate-400">Career headline</p>
          <p className="mt-3 text-lg font-black leading-7 text-slate-950">{career.headline || 'Add a concise professional headline.'}</p>
        </article>
        <article className="card p-5 sm:p-6 lg:col-span-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-[.15em] text-slate-400">Verified skills</p>
            <Link href="/dashboard/profile" className="text-xs font-black text-indigo-600">Edit skills →</Link>
          </div>
          {career.skills?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {career.skills.map((skill) => <span key={skill} className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-800">{skill}</span>)}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Add your real skills to drive opportunity scoring and Naukri Key Skills sync.</p>
          )}
        </article>
        <article className="card p-5 sm:p-6 lg:col-span-3">
          <p className="text-xs font-black uppercase tracking-[.15em] text-slate-400">Professional summary</p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{career.summary || 'Add or generate a factual professional summary.'}</p>
        </article>
      </section>

      <NaukriAutoRefresh connection={connection} />

      <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[.15em] text-slate-400">LinkedIn presence</p>
        <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">LinkedIn stays under your control</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          JobPilot does not automate LinkedIn profile edits or activity. Use the verified headline, summary and skills above as a reviewable source, then publish only what you choose.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <a className="btn-secondary" href="https://www.linkedin.com/in/me/edit/top-card/" target="_blank" rel="noreferrer">Open LinkedIn ↗</a>
          <a className="btn-secondary" href="https://www.naukri.com/mnjuser/profile" target="_blank" rel="noreferrer">Open Naukri ↗</a>
        </div>
      </section>
    </div>
  )
}
