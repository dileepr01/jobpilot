'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

function splitCsv(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

export function OnboardingForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    const form = new FormData(event.currentTarget)
    const preferences = {
      targetRoles: splitCsv(String(form.get('targetRoles') || '')),
      locations: splitCsv(String(form.get('locations') || '')),
      workModes: form.getAll('workModes'),
      minSalary: Number(form.get('minSalary') || 0) || undefined,
      noticePeriod: String(form.get('noticePeriod') || ''),
      followedCompanies: splitCsv(String(form.get('followedCompanies') || ''))
    }
    form.set('preferences', JSON.stringify(preferences))

    const response = await fetch('/api/resume/upload', { method: 'POST', body: form })
    const data = await response.json().catch(() => ({}))
    setLoading(false)
    if (!response.ok) {
      setMessage(data.error || 'Could not process the resume.')
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="card mx-auto max-w-3xl p-6 sm:p-9">
      <div className="mb-8">
        <p className="text-sm font-bold text-indigo-600">Step 1 of 1</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Build your matching profile</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Upload a PDF or DOCX resume. JobPilot extracts structured experience and creates a private embedding for matching.</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="resume">Resume</label>
          <input className="input file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:font-semibold file:text-indigo-700" id="resume" name="resume" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required />
          <p className="mt-1.5 text-xs text-slate-500">Maximum 4 MB. Stored in a private Supabase Storage bucket.</p>
        </div>
        <div>
          <label className="label" htmlFor="fullName">Full name</label>
          <input className="input" id="fullName" name="fullName" placeholder="Dileep Palety" required />
        </div>
        <div>
          <label className="label" htmlFor="noticePeriod">Notice period</label>
          <input className="input" id="noticePeriod" name="noticePeriod" placeholder="30 days" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="targetRoles">Target roles</label>
          <input className="input" id="targetRoles" name="targetRoles" placeholder="Power BI Admin, Fabric Admin, BI Platform Engineer" required />
        </div>
        <div>
          <label className="label" htmlFor="locations">Locations</label>
          <input className="input" id="locations" name="locations" placeholder="Hyderabad, Bengaluru, India" required />
        </div>
        <div>
          <label className="label" htmlFor="minSalary">Minimum annual salary</label>
          <input className="input" id="minSalary" name="minSalary" type="number" min="0" step="100000" placeholder="5000000" />
        </div>
        <fieldset className="sm:col-span-2">
          <legend className="label">Preferred work modes</legend>
          <div className="flex flex-wrap gap-3">
            {['remote', 'hybrid', 'onsite'].map((mode) => (
              <label key={mode} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold capitalize">
                <input type="checkbox" name="workModes" value={mode} defaultChecked={mode !== 'onsite'} /> {mode}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="followedCompanies">Companies to follow</label>
          <input className="input" id="followedCompanies" name="followedCompanies" placeholder="Microsoft, Google, NVIDIA" />
        </div>
      </div>

      {message && <p className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{message}</p>}
      <button className="btn-primary mt-8 w-full sm:w-auto" disabled={loading}>{loading ? 'Parsing and embedding…' : 'Finish setup'}</button>
    </form>
  )
}
