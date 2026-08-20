'use client'

import { useEffect, useState } from 'react'

const steps = [
  {
    eyebrow: '01 · Upload',
    title: 'Start with your real resume',
    body: 'Upload PDF or DOCX once. JobPilot builds a career profile from your experience, skills and seniority.',
    accent: 'Resume ready',
    detail: 'Experience · Skills · Education · Preferences'
  },
  {
    eyebrow: '02 · Discover',
    title: 'Search live jobs when you want',
    body: 'JobPilot checks supported live sources on demand and ranks openings against your profile and preferences.',
    accent: 'Fresh opportunities',
    detail: 'Preferred cities · Remote · Hybrid'
  },
  {
    eyebrow: '03 · Understand',
    title: 'See why every role fits',
    body: 'Match intelligence breaks the score into experience, skills, seniority, location and resume signals.',
    accent: 'Explainable match',
    detail: 'Skills · Seniority · Experience · Location'
  },
  {
    eyebrow: '04 · Tailor',
    title: 'Create a role-specific application kit',
    body: 'Generate a tailored resume, fit bullets, screening answers and interview talking points before you apply.',
    accent: 'Application kit',
    detail: 'Resume · ATS review · Cover letter · Interview prep'
  },
  {
    eyebrow: '05 · Track',
    title: 'Keep your search organized',
    body: 'Move opportunities through your pipeline and keep the job, resume version and notes together in one workspace.',
    accent: 'Career pipeline',
    detail: 'Saved → Applied → Interview → Offer'
  }
]

export function ProductTour({ label = 'Interactive walkthrough' }: { label?: string }) {
  const [open, setOpen] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!open || !playing) return
    const timer = window.setInterval(() => {
      setStep((current) => {
        if (current >= steps.length - 1) {
          setPlaying(false)
          return current
        }
        return current + 1
      })
    }, 4200)

    return () => window.clearInterval(timer)
  }, [open, playing])

  function startTour() {
    setStep(0)
    setOpen(true)
    setPlaying(true)
  }

  function closeTour() {
    setOpen(false)
    setPlaying(false)
  }

  const current = steps[step]

  return (
    <>
      <button type="button" className="btn-secondary px-5 py-3" onClick={startTour}>
        <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-950 text-[10px] text-white">▶</span>
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="JobPilot interactive walkthrough">
          <div className="w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.2em] text-indigo-300">Interactive walkthrough</p>
                <p className="mt-1 text-sm text-slate-400">Resume to application in five steps</p>
              </div>
              <button type="button" onClick={closeTour} className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white" aria-label="Close walkthrough">
                Close
              </button>
            </div>

            <div className="grid min-h-[430px] lg:grid-cols-[.9fr_1.1fr]">
              <div className="flex flex-col justify-between p-6 sm:p-8">
                <div>
                  <p className="text-sm font-bold text-indigo-300">{current.eyebrow}</p>
                  <h3 className="mt-3 text-3xl font-black tracking-[-.03em] sm:text-4xl">{current.title}</h3>
                  <p className="mt-4 max-w-lg text-base leading-7 text-slate-300">{current.body}</p>
                </div>

                <div className="mt-8">
                  <div className="flex gap-2">
                    {steps.map((item, index) => (
                      <button
                        type="button"
                        key={item.title}
                        onClick={() => { setStep(index); setPlaying(false) }}
                        className={`h-1.5 flex-1 rounded-full transition ${index <= step ? 'bg-indigo-400' : 'bg-white/15'}`}
                        aria-label={`Show step ${index + 1}`}
                      />
                    ))}
                  </div>
                  <div className="mt-5 flex items-center gap-3">
                    <button type="button" className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-950" onClick={() => {
                      if (step === steps.length - 1) setStep(0)
                      setPlaying((value) => step === steps.length - 1 ? true : !value)
                    }}>
                      {playing ? 'Pause' : step === steps.length - 1 ? 'Replay' : 'Play'}
                    </button>
                    <button type="button" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-200 disabled:opacity-40" disabled={step === steps.length - 1} onClick={() => { setStep((value) => Math.min(value + 1, steps.length - 1)); setPlaying(false) }}>
                      Next
                    </button>
                  </div>
                </div>
              </div>

              <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600/30 via-slate-900 to-cyan-500/10 p-6 sm:p-8">
                <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
                <div className="absolute -bottom-24 left-10 h-64 w-64 rounded-full bg-indigo-500/25 blur-3xl" />
                <div className="relative mx-auto mt-5 max-w-lg rounded-[1.75rem] border border-white/10 bg-white/[.07] p-5 shadow-2xl backdrop-blur-xl sm:p-6">
                  <div className="flex items-center gap-2 border-b border-white/10 pb-4">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    <span className="ml-3 text-xs font-semibold text-slate-400">JobPilot</span>
                  </div>
                  <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/45 p-5">
                    <p className="text-xs font-bold uppercase tracking-[.18em] text-slate-400">{current.accent}</p>
                    <p className="mt-3 text-2xl font-black text-white">{current.detail}</p>
                    <div className="mt-5 space-y-2">
                      <div className="h-2 rounded-full bg-white/10"><div className="h-2 w-[88%] rounded-full bg-indigo-400" /></div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="h-16 rounded-xl bg-white/[.06]" />
                        <div className="h-16 rounded-xl bg-white/[.06]" />
                        <div className="h-16 rounded-xl bg-white/[.06]" />
                      </div>
                      <div className="h-24 rounded-xl bg-white/[.06]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
