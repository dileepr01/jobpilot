import { Suspense } from 'react'
import Link from 'next/link'
import { AuthForm } from '@/components/auth-form'

export default function LoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-50 px-4 py-5 sm:px-6 sm:py-7">
      <div className="pointer-events-none absolute -left-40 top-10 h-96 w-96 rounded-full bg-indigo-300/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-cyan-300/15 blur-3xl" />

      <nav className="relative mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-xl font-black tracking-tight text-slate-950">
          <span className="brand-mark">J</span>
          <span>Job<span className="text-indigo-600">Pilot</span></span>
        </Link>
        <Link href="/" className="rounded-lg px-2 py-2 text-sm font-semibold text-slate-500 transition hover:text-slate-950">
          Back
        </Link>
      </nav>

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 py-8 lg:min-h-[calc(100vh-76px)] lg:grid-cols-[.9fr_1.1fr] lg:py-12">
        <section className="order-2 mx-auto max-w-lg text-center lg:order-1 lg:mx-0 lg:text-left">
          <p className="text-xs font-black uppercase tracking-[.18em] text-indigo-600">Your AI career copilot</p>
          <h2 className="mt-4 text-4xl font-black leading-[1.02] tracking-[-.045em] text-slate-950 sm:text-5xl">
            One account for your entire job search.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Your resume, matched roles, tailored versions and application progress stay together in one private workspace.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-semibold text-slate-500 lg:justify-start">
            <span>✓ Resume-first setup</span>
            <span>✓ On-demand search</span>
            <span>✓ You control every application</span>
          </div>
        </section>

        <section className="order-1 flex justify-center lg:order-2 lg:justify-end">
          <Suspense fallback={<div className="w-full max-w-[440px] rounded-3xl border border-slate-200 bg-white p-7 text-sm text-slate-500 shadow-xl">Loading secure sign in…</div>}>
            <AuthForm />
          </Suspense>
        </section>
      </div>
    </main>
  )
}
