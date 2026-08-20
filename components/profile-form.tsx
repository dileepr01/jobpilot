'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type {
  CareerProfileData,
  JobPreferences,
  ParsedResume
} from '@/lib/types'

function csv(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function unique(values: string[]) {
  const seen = new Set<string>()
  return values.filter((value) => {
    const key = value.trim().toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

type NaukriState = {
  enabled: boolean
  status: string
} | null

export function ProfileForm({
  profile,
  sources,
  naukriConnection
}: {
  profile: any
  sources: any[]
  naukriConnection: NaukriState
}) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [currentSources, setCurrentSources] = useState(sources)
  const [skillDraft, setSkillDraft] = useState('')

  const preferences = (profile.preferences || {}) as JobPreferences
  const parsed = (profile.parsed_resume || {}) as ParsedResume
  const career = (profile.career_profile || {}) as Partial<CareerProfileData>
  const initialSkills = useMemo(
    () => unique(career.skills?.length ? career.skills : parsed.skills || []),
    [career.skills, parsed.skills]
  )
  const [skills, setSkills] = useState(initialSkills)

  function addSkill() {
    const additions = csv(skillDraft)
    if (!additions.length) return
    setSkills((current) => unique([...current, ...additions]).slice(0, 60))
    setSkillDraft('')
  }

  function removeSkill(skill: string) {
    setSkills((current) => current.filter((item) => item !== skill))
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage('Saving Career Profile…')

    const form = new FormData(event.currentTarget)
    const yearsText = String(form.get('yearsExperience') || '').trim()
    const updatedPreferences: JobPreferences = {
      targetRoles: csv(String(form.get('targetRoles') || '')),
      locations: csv(String(form.get('locations') || '')),
      workModes: form.getAll('workModes') as JobPreferences['workModes'],
      minSalary: Number(form.get('minSalary') || 0) || undefined,
      noticePeriod: String(form.get('noticePeriod') || ''),
      followedCompanies: csv(String(form.get('followedCompanies') || ''))
    }

    const response = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fullName: String(form.get('fullName') || ''),
        preferences: updatedPreferences,
        careerProfile: {
          headline: String(form.get('headline') || ''),
          summary: String(form.get('summary') || ''),
          skills,
          currentTitle: String(form.get('currentTitle') || ''),
          ...(yearsText ? { yearsExperience: Number(yearsText) } : {})
        },
        emailDigestEnabled: form.get('emailDigest') === 'on',
        telegramEnabled: form.get('telegramEnabled') === 'on',
        telegramChatId: String(form.get('telegramChatId') || '') || null
      })
    })

    const data = await response.json().catch(() => ({})) as {
      error?: string
      matchingChanged?: boolean
      searchMessage?: string
    }

    if (!response.ok) {
      setBusy(false)
      setMessage(data.error || 'Could not save Career Profile.')
      return
    }

    let naukriMessage = ''
    if (data.matchingChanged && naukriConnection?.enabled) {
      const syncResponse = await fetch('/api/naukri', { method: 'PUT' })
      const syncData = await syncResponse.json().catch(() => ({})) as {
        error?: string
        syncMessage?: string
        changedFields?: string[]
      }

      if (syncResponse.ok) {
        naukriMessage = syncData.changedFields?.length
          ? ` Naukri updated: ${syncData.changedFields.join(', ')}.`
          : ` ${syncData.syncMessage || 'Naukri was already aligned.'}`
      } else {
        naukriMessage = ` Profile saved, but Naukri needs attention: ${syncData.error || 'sync failed'}`
      }
    }

    setBusy(false)
    setMessage(`${data.searchMessage || 'Career Profile saved.'}${naukriMessage}`)
    router.refresh()
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[.15em] text-indigo-600">Verified Career Profile</p>
            <h2 className="mt-2 text-xl font-black">Edit what is true about your career</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Adding or removing a skill is a real profile event. JobPilot rebuilds matching from this profile, refreshes relevant jobs, and can mirror genuine headline/skill changes to Naukri without re-uploading your resume.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
            <p className="font-bold text-slate-800">Naukri</p>
            <p>{naukriConnection?.enabled ? `Connected · ${naukriConnection.status}` : 'Not connected / paused'}</p>
          </div>
        </div>

        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label">Full name</label>
            <input className="input" name="fullName" defaultValue={profile.full_name} />
          </div>
          <div>
            <label className="label">Current title</label>
            <input className="input" name="currentTitle" defaultValue={career.currentTitle || parsed.titles?.[0] || ''} placeholder="Senior Platform Engineer" />
          </div>
          <div>
            <label className="label">Years of experience</label>
            <input className="input" name="yearsExperience" type="number" min="0" max="70" step="0.5" defaultValue={career.yearsExperience ?? parsed.yearsExperience ?? ''} />
          </div>
          <div>
            <label className="label">Notice period</label>
            <input className="input" name="noticePeriod" defaultValue={preferences.noticePeriod || ''} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Career headline</label>
            <input className="input" name="headline" maxLength={250} defaultValue={career.headline || ''} placeholder="Enterprise BI / Fabric Platform Engineer | Governance, Capacity & Automation" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Professional summary</label>
            <textarea className="input min-h-32 leading-6" name="summary" maxLength={3000} defaultValue={career.summary || parsed.summary || ''} />
          </div>

          <div className="sm:col-span-2">
            <div className="flex items-end justify-between gap-3">
              <div>
                <label className="label">Skills</label>
                <p className="text-xs text-slate-400">These skills drive JobPilot matching and the Naukri Key Skills delta.</p>
              </div>
              <span className="text-xs font-bold text-slate-400">{skills.length}/60</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {skills.map((skill) => (
                <span key={skill} className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-800">
                  {skill}
                  <button type="button" className="text-indigo-400 hover:text-rose-600" onClick={() => removeSkill(skill)} aria-label={`Remove ${skill}`}>×</button>
                </span>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                className="input"
                value={skillDraft}
                onChange={(event) => setSkillDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addSkill()
                  }
                }}
                placeholder="Add a skill, or comma-separate several"
              />
              <button className="btn-secondary shrink-0" type="button" onClick={addSkill}>+ Add skill</button>
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="label">Target roles</label>
            <input className="input" name="targetRoles" defaultValue={(preferences.targetRoles || []).join(', ')} />
          </div>
          <div>
            <label className="label">Preferred locations</label>
            <input className="input" name="locations" defaultValue={(preferences.locations || []).join(', ')} />
          </div>
          <div>
            <label className="label">Minimum annual salary</label>
            <input className="input" name="minSalary" type="number" defaultValue={preferences.minSalary || ''} />
          </div>
          <fieldset className="sm:col-span-2">
            <legend className="label">Work modes</legend>
            <div className="flex flex-wrap gap-3">
              {['remote', 'hybrid', 'onsite'].map((mode) => (
                <label key={mode} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold capitalize">
                  <input className="mr-2" type="checkbox" name="workModes" value={mode} defaultChecked={(preferences.workModes || []).includes(mode as any)} />
                  {mode}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="sm:col-span-2">
            <label className="label">Companies to follow</label>
            <input className="input" name="followedCompanies" defaultValue={(preferences.followedCompanies || []).join(', ')} />
          </div>
        </div>

        <div className="mt-7 grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2">
          <label className="text-sm font-semibold"><input className="mr-2" type="checkbox" name="emailDigest" defaultChecked={profile.email_digest_enabled} />Email Apply Now matches after each search</label>
          <label className="text-sm font-semibold"><input className="mr-2" type="checkbox" name="telegramEnabled" defaultChecked={profile.telegram_enabled} />Telegram Apply Now matches after each search</label>
          <div className="sm:col-span-2"><label className="label">Telegram chat ID</label><input className="input" name="telegramChatId" defaultValue={profile.telegram_chat_id || ''} /></div>
        </div>

        {message && <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">{message}</p>}
        <div className="mt-6 flex flex-wrap gap-2">
          <button className="btn-primary" disabled={busy}>{busy ? 'Saving & refreshing…' : 'Save Career Profile'}</button>
          <a className="btn-secondary" href="/onboarding">Replace resume</a>
        </div>
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
        <div className="mt-5 space-y-2">
          {currentSources.map((source) => (
            <div key={source.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm">
              <div><span className="font-bold">{source.label}</span><span className="ml-2 text-slate-400">{source.source_type}</span></div>
              <button className="font-semibold text-rose-600" onClick={() => void removeSource(source.id)}>Remove</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
