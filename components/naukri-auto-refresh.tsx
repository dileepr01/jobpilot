'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type NaukriConnectionView = {
  enabled: boolean
  status: string
  profileId: string | null
  lastAttemptAt: string | null
  lastSyncAt: string | null
  lastError: string | null
} | null

function statusLabel(status?: string) {
  switch (status) {
    case 'connected':
      return 'Connected'
    case 'needs_reconnect':
      return 'Reconnect required'
    case 'error':
      return 'Needs attention'
    case 'disabled':
      return 'Paused'
    default:
      return 'Not tested yet'
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'No Naukri change yet'
  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

export function NaukriAutoRefresh({ connection }: { connection: NaukriConnectionView }) {
  const router = useRouter()
  const [showConnect, setShowConnect] = useState(!connection || connection.status === 'needs_reconnect')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [profileId, setProfileId] = useState(connection?.profileId || '')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  async function parse(response: Response) {
    return (await response.json().catch(() => ({}))) as {
      error?: string
      syncOk?: boolean
      syncError?: string | null
      syncMessage?: string | null
      changedFields?: string[]
    }
  }

  async function connect() {
    setBusy('connect')
    setMessage('')
    const response = await fetch('/api/naukri', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password, profileId, consent })
    })
    const data = await parse(response)
    setBusy(null)

    if (!response.ok) {
      setMessage(data.error || 'Could not connect Naukri.')
      return
    }

    setPassword('')
    setShowConnect(false)
    setMessage(
      data.syncOk
        ? data.syncMessage || 'Naukri connected and aligned with your Career Profile.'
        : data.syncError || 'Connection saved. Naukri needs attention before automatic profile sync can run.'
    )
    router.refresh()
  }

  async function syncNow() {
    setBusy('sync')
    setMessage('')
    const response = await fetch('/api/naukri', { method: 'PUT' })
    const data = await parse(response)
    setBusy(null)

    if (!response.ok) {
      setMessage(data.error || 'Naukri profile sync failed.')
      router.refresh()
      return
    }

    setMessage(data.syncMessage || 'Naukri profile checked successfully.')
    router.refresh()
  }

  async function toggle() {
    if (!connection) return
    setBusy('toggle')
    setMessage('')
    const response = await fetch('/api/naukri', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: !connection.enabled })
    })
    const data = await parse(response)
    setBusy(null)

    if (!response.ok) {
      setMessage(data.error || 'Could not update Naukri Profile Sync.')
      return
    }

    setMessage(connection.enabled ? 'Automatic Naukri profile sync paused.' : 'Automatic Naukri profile sync enabled.')
    router.refresh()
  }

  async function disconnect() {
    if (!confirm('Disconnect Naukri and remove the stored connection?')) return
    setBusy('disconnect')
    setMessage('')
    const response = await fetch('/api/naukri', { method: 'DELETE' })
    const data = await parse(response)
    setBusy(null)

    if (!response.ok) {
      setMessage(data.error || 'Could not disconnect Naukri.')
      return
    }

    setUsername('')
    setPassword('')
    setProfileId('')
    setShowConnect(true)
    setMessage('Naukri disconnected.')
    router.refresh()
  }

  return (
    <section className="mt-7 rounded-3xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-black uppercase tracking-[.15em] text-blue-600">Naukri Profile Sync</p>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
              {statusLabel(connection?.status)}
            </span>
          </div>
          <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">Mirror genuine Career Profile changes to Naukri</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            When you add or remove a skill, edit your JobPilot headline, or change your professional summary, JobPilot compares the desired profile with Naukri and writes only the real delta. A resume upload by itself is not used as a fake profile-refresh event.
          </p>
        </div>

        {connection && (
          <div className="min-w-44 rounded-2xl bg-slate-50 px-4 py-3 text-xs">
            <p className="font-bold text-slate-800">Last real Naukri change</p>
            <p className="mt-1 text-slate-500">{formatDate(connection.lastSyncAt)}</p>
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-[.12em] text-slate-400">Key skills</p>
          <p className="mt-2 text-sm font-semibold text-slate-700">Adding or removing a skill in JobPilot changes the desired Naukri Key Skills set.</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-[.12em] text-slate-400">Headline & summary</p>
          <p className="mt-2 text-sm font-semibold text-slate-700">Only user-verified Career Profile text is mirrored when it genuinely differs.</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-xs font-black uppercase tracking-[.12em] text-slate-400">No artificial activity</p>
          <p className="mt-2 text-sm font-semibold text-slate-700">No punctuation toggles, scheduled fake edits, or re-uploads just to manufacture freshness.</p>
        </div>
      </div>

      {connection && !showConnect && (
        <div className="mt-5 flex flex-wrap gap-2">
          <button className="btn-primary" type="button" onClick={syncNow} disabled={busy !== null}>
            {busy === 'sync' ? 'Checking…' : 'Sync Career Profile now'}
          </button>
          <button className="btn-secondary" type="button" onClick={toggle} disabled={busy !== null}>
            {busy === 'toggle' ? 'Saving…' : connection.enabled ? 'Pause automatic sync' : 'Enable automatic sync'}
          </button>
          <button className="btn-secondary" type="button" onClick={() => setShowConnect(true)} disabled={busy !== null}>
            Reconnect
          </button>
          <button className="px-3 py-2 text-sm font-semibold text-slate-400 hover:text-red-600" type="button" onClick={disconnect} disabled={busy !== null}>
            {busy === 'disconnect' ? 'Disconnecting…' : 'Disconnect'}
          </button>
        </div>
      )}

      {showConnect && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold text-slate-700">
              Naukri email / username
              <input className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-medium outline-none ring-indigo-500 transition focus:ring-2" type="text" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="you@example.com" />
            </label>
            <label className="text-sm font-bold text-slate-700">
              Naukri password
              <input className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-medium outline-none ring-indigo-500 transition focus:ring-2" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your Naukri password" />
            </label>
          </div>

          <label className="mt-4 block text-sm font-bold text-slate-700">
            Naukri profile ID <span className="font-medium text-slate-400">(optional — JobPilot will try to detect it)</span>
            <input className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 font-medium outline-none ring-indigo-500 transition focus:ring-2" type="text" value={profileId} onChange={(event) => setProfileId(event.target.value)} placeholder="Only enter this if auto-detection fails" />
          </label>

          <label className="mt-4 flex items-start gap-3 rounded-xl bg-white p-3 text-xs leading-5 text-slate-600">
            <input className="mt-1" type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            <span>
              I want JobPilot to use an unofficial Naukri integration to read my profile and mirror genuine changes I make to my JobPilot Career Profile. I understand Naukri can change its login/profile flow and CAPTCHA or MFA may require me to reconnect.
            </span>
          </label>

          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-primary" type="button" disabled={busy !== null || !username || !password || !consent} onClick={connect}>
              {busy === 'connect' ? 'Connecting & testing…' : 'Connect & test Naukri'}
            </button>
            {connection && <button className="btn-secondary" type="button" onClick={() => setShowConnect(false)} disabled={busy !== null}>Cancel</button>}
          </div>
        </div>
      )}

      {(connection?.lastError || message) && (
        <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
          {message || connection?.lastError}
        </div>
      )}

      <div className="mt-5 grid gap-3 text-xs leading-5 text-slate-500 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <strong className="text-slate-700">Credential security:</strong> the Naukri password is encrypted in Supabase Vault and is never returned to the browser after you connect.
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <strong className="text-slate-700">No bypasses:</strong> if Naukri presents CAPTCHA, MFA or blocks the automated login, JobPilot stops and asks you to reconnect instead of attempting to bypass it.
        </div>
      </div>
    </section>
  )
}
