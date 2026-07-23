'use client'

import { useState } from 'react'
import { MatchScore } from '@/components/match-score'
import type {
  AtsReport,
  MatchStatus,
  ScoreBreakdown,
  TailoredResume
} from '@/lib/types'

export interface MatchView {
  id: string
  score: number
  score_breakdown: ScoreBreakdown
  status: MatchStatus
  why_fit: string[]
  cover_letter: string | null
  resume_tweaks: string[]
  screening_answers: Array<{
    question: string
    answer: string
  }>
  tailored_resume: TailoredResume | null
  ats_report: AtsReport | null
  jobs: {
    title: string
    company: string
    location: string | null
    work_mode: string | null
    salary_min: number | null
    salary_max: number | null
    salary_currency: string | null
    external_url: string
    posted_at: string | null
  }
}

function salaryText(job: MatchView['jobs']) {
  if (!job.salary_min && !job.salary_max) return 'Salary not listed'
  const formatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
  return `${job.salary_currency || ''} ${formatter.format(job.salary_min || 0)}–${formatter.format(job.salary_max || job.salary_min || 0)}`.trim()
}

export function JobCard({ initial }: { initial: MatchView }) {
  const [match, setMatch] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  async function patch(payload: Record<string, unknown>) {
    setBusy(true)
    setMessage('')
    const response = await fetch(`/api/matches/${match.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await response.json()
    setBusy(false)
    if (!response.ok) return setMessage(data.error || 'Update failed')
    setMatch((current) => ({ ...current, ...data.match }))
  }

  async function generateKit() {
    setBusy(true)
    setMessage('')
    const response = await fetch(`/api/matches/${match.id}/kit`, { method: 'POST' })
    const data = await response.json()
    setBusy(false)
    if (!response.ok) return setMessage(data.error || 'Generation failed')
    setMatch((current) => ({
      ...current,
      why_fit: data.kit.whyFit,
      cover_letter: data.kit.coverLetter,
      resume_tweaks: data.kit.resumeTweaks,
      screening_answers: data.kit.screeningAnswers,
      tailored_resume: data.kit.tailoredResume,
      ats_report: data.kit.atsReport,
      status: 'reviewed'
    }))
  }

  const breakdown = match.score_breakdown || {} as ScoreBreakdown

  return (
    <article className="card p-5 sm:p-6">
      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            <span>{match.jobs.company}</span><span>•</span><span>{match.jobs.location || 'Location flexible'}</span>
          </div>
          <h2 className="mt-2 text-xl font-black leading-tight text-slate-950">{match.jobs.title}</h2>
          <p className="mt-2 text-sm text-slate-500">{salaryText(match.jobs)} {match.jobs.work_mode ? `• ${match.jobs.work_mode}` : ''}</p>
        </div>
        <MatchScore score={match.score} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[['Semantic', breakdown.semantic], ['Role', breakdown.role], ['Location', breakdown.location], ['Mode', breakdown.workMode], ['Salary', breakdown.salary]].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-[10px] font-bold uppercase text-slate-400">{label}</p><p className="mt-1 text-sm font-black">{Number(value || 0).toFixed(1)}</p></div>
        ))}
      </div>

      {match.why_fit?.length > 0 && <ul className="mt-5 space-y-2 text-sm leading-6 text-slate-700">{match.why_fit.map((item) => <li key={item}>• {item}</li>)}</ul>}

      <div className="mt-6 flex flex-wrap gap-2">
        <a className="btn-primary" href={match.jobs.external_url} target="_blank" rel="noreferrer" onClick={() => void patch({ status: 'reviewed' })}>Apply on original site ↗</a>
        {!match.tailored_resume?.content && (
          <button
            className="btn-secondary"
            disabled={busy}
            onClick={generateKit}
          >
            {busy
              ? 'Generating…'
              : 'Create ATS resume & application kit'}
          </button>
        )}
        <select className="input w-auto py-2" value={match.status} disabled={busy} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => void patch({ status: event.target.value })}>
          {['new', 'reviewed', 'applied', 'interview', 'offer', 'rejected'].map((status) => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}
        </select>
      </div>

      {message && <p className="mt-3 text-sm text-rose-600">{message}</p>}

      {match.tailored_resume?.content && (
        <details
          open
          className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4"
        >
          <summary className="cursor-pointer text-sm font-black">
            ATS Resume Studio
          </summary>

          <div className="mt-4 flex items-center gap-4">
            <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
              <p className="text-[10px] font-bold uppercase text-slate-400">
                ATS readiness
              </p>
              <p className="mt-1 text-2xl font-black text-indigo-700">
                {Math.round(match.ats_report?.score || 0)}%
              </p>
            </div>

            <p className="text-xs leading-5 text-slate-500">
              Review every statement before applying.
              The score is only an estimate.
            </p>
          </div>

          <label
            className="label mt-5"
            htmlFor={`resume-${match.id}`}
          >
            Editable job-specific resume
          </label>

          <textarea
            id={`resume-${match.id}`}
            className="input min-h-[36rem] whitespace-pre-wrap font-mono text-sm leading-6"
            value={match.tailored_resume.content}
            onChange={(event) =>
              setMatch((current) => ({
                ...current,
                tailored_resume: {
                  template: 'modern-ats',
                  content: event.target.value
                }
              }))
            }
          />

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="btn-primary"
              disabled={busy}
              onClick={() =>
                void patch({
                  tailored_resume: match.tailored_resume
                })
              }
            >
              Save resume
            </button>

            <a
              className="btn-secondary"
              href={`/api/matches/${match.id}/resume?format=docx`}
            >
              Download DOCX
            </a>

            <a
              className="btn-secondary"
              href={`/api/matches/${match.id}/resume?format=pdf`}
            >
              Download PDF
            </a>
          </div>
        </details>
      )}

      {match.cover_letter && (
        <details className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <summary className="cursor-pointer text-sm font-black">Review application kit</summary>
          <label className="label mt-5" htmlFor={`cover-${match.id}`}>Cover letter</label>
          <textarea id={`cover-${match.id}`} className="input min-h-72 leading-6" value={match.cover_letter} onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => setMatch((current) => ({ ...current, cover_letter: event.target.value }))} onBlur={() => void patch({ cover_letter: match.cover_letter })} />
          {match.resume_tweaks?.length > 0 && <div className="mt-5"><p className="text-sm font-black">Resume keywords to review</p><ul className="mt-2 space-y-1 text-sm text-slate-600">{match.resume_tweaks.map((item) => <li key={item}>• {item}</li>)}</ul></div>}
          {match.screening_answers?.length > 0 && <div className="mt-5 space-y-4">{match.screening_answers.map((item) => <div key={item.question}><p className="text-sm font-black">{item.question}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.answer}</p></div>)}</div>}
        </details>
      )}
    </article>
  )
}
