import { Suspense } from 'react'
import Link from 'next/link'
import { AuthForm } from '@/components/auth-form'

const benefits = [
  'Upload your resume once and reuse the profile',
  'Run live job discovery whenever you want',
  'See explainable match scores before applying',
  'Tailor senior resumes and track every opportunity'
]

export default function LoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden px-5 py-7 sm:px-8 lg:px-12">
      <div className="pointer-events-none absolute -left-32 top-12 h-96 w-96 rounded-full bg-indigo-300/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-10 h-96 w-96 rounded-full bg-cyan-300/20 blur-3xl" />

      <div className="relative mx-auto flex max-w-7xl items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-xl font-black tracking-tight">
          <span className="brand-mark">J</span>
          <span>Job<span className="text-indigo-600">Pilot</span></span>
        </Link>
        <Link href="/" className="text-sm font-semibold text-slate-500 transition hover:text-slate-950">← Back to home</Link>
      </div>

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 py-10 lg:min-h-[calc(100vh-92px)] lg:grid-cols-[1fr_.9fr] lg:py-14">
        <section className="hidden lg:block">
          <div className="inline-flex rounded-full border border-indigo-200 bg-white/70 px-3 py-1.5 text-xs font-black uppercase tracking-[.16em] text-indigo-700">Built for serious job searches</div>
          <h1 className="mt-6 max-w-2xl text-5xl font-black leading-[1.02] tracking-[-.05em] text-slate-950">One login. Your entire career search in one workspace.</h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">JobPilot remembers the context that generic job boards lose: your resume, target roles, match reasoning, tailored versions and application progress.</p>
          <div className="mt-8 grid max-w-xl gap-3">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/65 p-4 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">✓</span>
                {benefit}
              </div>
            ))}
          </div>
        </section>

        <section className="flex justify-center lg:justify-end">
          <Suspense fallback={<div className="card w-full max-w-md p-7 text-sm text-slate-500">Loading secure sign in…</div>}>
            <AuthForm />
          </Suspense>
        </section>
      </div>
    </main>
  )
}
