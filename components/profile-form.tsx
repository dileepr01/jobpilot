'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { JobPreferences } from '@/lib/types'

function csv(value: string) { return value.split(',').map((item) => item.trim()).filter(Boolean) }

export function ProfileForm({ profile, sources }: { profile: any; sources: any[] }) {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [currentSources, setCurrentSources] = useState(sources)
  const preferences = profile.preferences as JobPreferences

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    const form = new FormData(event.currentTarget)
    const updatedPreferences = {
      targetRoles: csv(String(form.get('targetRoles') || '')),
      locations: csv(String(form.get('locations') || '')),
      workModes: form.getAll('workModes'),
      minSalary: Number(form.get('minSalary') || 0) || undefined,
      noticePeriod: String(form.get('noticePeriod') || ''),
      followedCompanies: csv(String(form.get('followedCompanies') || ''))
    }
    const { error } = await createClient().from('profiles').update({
      full_name: String(form.get('fullName') || ''),
      preferences: updatedPreferences,
      email_digest_enabled: form.get('emailDigest') === 'on',
      telegram_enabled: form.get('telegramEnabled') === 'on',
      telegram_chat_id: String(form.get('telegramChatId') || '') || null
    }).eq('user_id', profile.user_id)
    setBusy(false)
    setMessage(error ? error.message : 'Settings saved.')
  }

  async function addSource(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const sourceType = String(form.get('sourceType'))
    const value = String(form.get('sourceValue') || '').trim()
    if (!value) return
    if (sourceType === 'rss') {
      try {
        const url = new URL(value)
        if (url.protocol !== 'https:') throw new Error('HTTPS required')
      } catch {
        return setMessage('RSS feeds must be valid HTTPS URLs.')
      }
    } else if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(value)) {
      return setMessage('Board tokens and company slugs may contain only letters, numbers, underscores, and hyphens.')
    }
    const payload = {
      user_id: profile.user_id,
      source_type: sourceType,
      label: String(form.get('sourceLabel') || value),
      identifier: sourceType === 'rss' ? null : value,
      feed_url: sourceType === 'rss' ? value : null
    }
    const { data, error } = await createClient().from('job_sources').insert(payload).select().single()
    if (error) return setMessage(error.message)
    setCurrentSources((current) => [...current, data])
    event.currentTarget.reset()
  }

  async function removeSource(id: string) {
    const { error } = await createClient().from('job_sources').delete().eq('id', id).eq('user_id', profile.user_id)
    if (!error) setCurrentSources((current) => current.filter((source) => source.id !== id))
  }

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="card p-6 sm:p-8">
        <h2 className="text-xl font-black">Matching preferences</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div><label className="label">Full name</label><input className="input" name="fullName" defaultValue={profile.full_name} /></div>
          <div><label className="label">Notice period</label><input className="input" name="noticePeriod" defaultValue={preferences.noticePeriod || ''} /></div>
          <div className="sm:col-span-2"><label className="label">Target roles</label><input className="input" name="targetRoles" defaultValue={(preferences.targetRoles || []).join(', ')} /></div>
          <div><label className="label">Locations</label><input className="input" name="locations" defaultValue={(preferences.locations || []).join(', ')} /></div>
          <div><label className="label">Minimum annual salary</label><input className="input" name="minSalary" type="number" defaultValue={preferences.minSalary || ''} /></div>
          <fieldset className="sm:col-span-2"><legend className="label">Work modes</legend><div className="flex flex-wrap gap-3">{['remote', 'hybrid', 'onsite'].map((mode) => <label key={mode} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold capitalize"><input className="mr-2" type="checkbox" name="workModes" value={mode} defaultChecked={(preferences.workModes || []).includes(mode as any)} />{mode}</label>)}</div></fieldset>
          <div className="sm:col-span-2"><label className="label">Companies to follow</label><input className="input" name="followedCompanies" defaultValue={(preferences.followedCompanies || []).join(', ')} /></div>
        </div>
        <div className="mt-7 grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2">
          <label className="text-sm font-semibold"><input className="mr-2" type="checkbox" name="emailDigest" defaultChecked={profile.email_digest_enabled} />Daily email digest</label>
          <label className="text-sm font-semibold"><input className="mr-2" type="checkbox" name="telegramEnabled" defaultChecked={profile.telegram_enabled} />Telegram alerts above 85</label>
          <div className="sm:col-span-2"><label className="label">Telegram chat ID</label><input className="input" name="telegramChatId" defaultValue={profile.telegram_chat_id || ''} /></div>
        </div>
        {message && <p className="mt-4 text-sm text-slate-600">{message}</p>}
        <div className="mt-6 flex flex-wrap gap-2"><button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button><a className="btn-secondary" href="/onboarding">Replace resume</a></div>
      </form>

      <section className="card p-6 sm:p-8">
        <h2 className="text-xl font-black">Public company feeds</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">Add a Greenhouse board token, Lever company slug, or public RSS URL. These are public endpoints only.</p>
        <form onSubmit={addSource} className="mt-5 grid gap-3 sm:grid-cols-[160px_1fr_1fr_auto]">
          <select className="input" name="sourceType"><option value="greenhouse">Greenhouse</option><option value="lever">Lever</option><option value="rss">RSS</option></select>
          <input className="input" name="sourceLabel" placeholder="Company label" />
          <input className="input" name="sourceValue" placeholder="Board token, company slug, or feed URL" required />
          <button className="btn-secondary">Add</button>
        </form>
        <div className="mt-5 space-y-2">{currentSources.map((source) => <div key={source.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm"><div><span className="font-bold">{source.label}</span><span className="ml-2 text-slate-400">{source.source_type}</span></div><button className="font-semibold text-rose-600" onClick={() => void removeSource(source.id)}>Remove</button></div>)}</div>
      </section>
    </div>
  )
}
