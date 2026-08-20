import Link from 'next/link'
import { ProductTour } from '@/components/product-tour'

const features = [
  ['Live discovery', 'Search supported job sources on demand instead of waiting for a scheduled batch.'],
  ['Match intelligence', 'Understand experience, skills, seniority, location and resume alignment before you spend time applying.'],
  ['Resume tailoring', 'Create role-specific PDF and DOCX application material while preserving a professional multi-page resume structure.'],
  ['Career pipeline', 'Keep saved roles, applications, interview progress and the resume used for each opportunity in one workspace.']
]

const steps = [
  ['Upload once', 'Add your current PDF or DOCX resume and let JobPilot build your career profile.'],
  ['Search live', 'Choose your target roles and locations, then run discovery whenever you want fresh opportunities.'],
  ['Review the fit', 'See a clear score and the evidence behind it before deciding whether a role deserves your attention.'],
  ['Tailor & apply', 'Generate an application kit, review it, then continue to the original employer listing to apply yourself.']
]

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden">
      <div className="border-b border-white/60 bg-white/70 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-12">
          <Link href="/" className="flex items-center gap-2 text-xl font-black tracking-tight">
            <span className="brand-mark">J</span>
            <span>Job<span className="text-indigo-600">Pilot</span></span>
          </Link>
          <div className="hidden items-center gap-7 text-sm font-semibold text-slate-600 md:flex">
            <a href="#features" className="transition hover:text-slate-950">Features</a>
            <a href="#how-it-works" className="transition hover:text-slate-950">How it works</a>
            <a href="#trust" className="transition hover:text-slate-950">Trust</a>
          </div>
          <div className="flex items-center gap-2">
            <Link className="hidden text-sm font-semibold text-slate-600 sm:inline-flex" href="/login">Sign in</Link>
            <Link className="btn-primary" href="/login">Get started</Link>
          </div>
        </nav>
      </div>

      <section className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[1.02fr_.98fr] lg:px-12 lg:pb-28 lg:pt-24">
        <div className="pointer-events-none absolute left-1/2 top-4 -z-10 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-indigo-300/20 blur-3xl" />
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200/80 bg-white/80 px-3 py-1.5 text-xs font-bold uppercase tracking-[.16em] text-indigo-700 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            AI career copilot · human controlled
          </div>
          <h1 className="max-w-4xl text-5xl font-black leading-[.98] tracking-[-.055em] text-slate-950 sm:text-6xl lg:text-7xl">
            Find better jobs. Build a stronger application. Move faster.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600">
            JobPilot turns your resume into a personal career workspace: live job discovery, explainable matching, role-specific resume tailoring and application tracking in one place.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link className="btn-primary px-6 py-3" href="/login">Start with your resume</Link>
            <ProductTour />
          </div>
          <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-slate-500">
            <span>✓ PDF & DOCX resumes</span>
            <span>✓ Search only when you ask</span>
            <span>✓ You approve every application</span>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-indigo-500/20 via-cyan-300/10 to-transparent blur-2xl" />
          <div className="overflow-hidden rounded-[2rem] border border-white/70 bg-slate-950 p-3 shadow-2xl shadow-indigo-950/20">
            <div className="rounded-[1.55rem] border border-white/10 bg-slate-900 p-5 text-white sm:p-7">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[.16em] text-indigo-300">Career command center</p>
                  <h2 className="mt-2 text-2xl font-black">Your best opportunities, ranked</h2>
                </div>
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-center text-emerald-300">
                  <div className="text-2xl font-black">94%</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider">Match</div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[.04] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-cyan-300">Product company · Hybrid</p>
                    <h3 className="mt-1 text-xl font-black">Senior Platform Engineer</h3>
                  </div>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-300">New</span>
                </div>
                <div className="mt-5 grid gap-2 sm:grid-cols-3">
                  {['Skills 96%', 'Seniority 100%', 'Location 100%'].map((item) => (
                    <div key={item} className="rounded-xl bg-white/[.06] px-3 py-3 text-xs font-bold text-slate-200">{item}</div>
                  ))}
                </div>
                <div className="mt-5 rounded-xl border border-white/10 bg-slate-950/50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">JobPilot insight</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">Strong alignment across required skills, seniority, relevant experience and location preferences.</p>
                </div>
                <div className="mt-5 flex gap-2">
                  <span className="rounded-xl bg-indigo-500 px-4 py-2.5 text-xs font-bold">Tailor resume</span>
                  <span className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-bold text-slate-300">View job</span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  ['18', 'New matches'],
                  ['7', 'Applications'],
                  ['3', 'Interviews']
                ].map(([value, label]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
                    <p className="text-xl font-black">{value}</p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12">
        <div className="max-w-3xl">
          <p className="section-kicker">Built around the job seeker</p>
          <h2 className="section-title">Everything you need between “I should look” and “I’m ready to apply.”</h2>
          <p className="section-copy">Less tab switching, less generic AI output, and more context carried from one opportunity to the next.</p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {features.map(([title, body], index) => (
            <article key={title} className="card card-hover p-6">
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white">0{index + 1}</div>
              <h3 className="text-lg font-black tracking-tight">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="border-y border-slate-200/80 bg-white/70">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[.82fr_1.18fr] lg:px-12 lg:py-24">
          <div>
            <p className="section-kicker">How JobPilot works</p>
            <h2 className="section-title">A simple workflow that gets smarter with your profile.</h2>
            <p className="section-copy">The autoplay product tour behaves like a short explainer while staying interactive, fast on mobile, and always in sync with the product.</p>
            <div className="mt-7"><ProductTour /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {steps.map(([title, body], index) => (
              <article key={title} className="rounded-3xl border border-slate-200 bg-slate-50/80 p-6">
                <p className="text-xs font-black uppercase tracking-[.18em] text-indigo-600">Step {index + 1}</p>
                <h3 className="mt-3 text-xl font-black tracking-tight">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="trust" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-24">
        <div className="overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-10 text-white sm:px-10 lg:grid lg:grid-cols-[1fr_.9fr] lg:items-center lg:gap-12 lg:px-12">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Built for trust</p>
            <h2 className="mt-4 text-3xl font-black tracking-[-.035em] sm:text-4xl">AI helps with the work. You keep control of the career decision.</h2>
          </div>
          <div className="mt-7 grid gap-3 text-sm text-slate-300 lg:mt-0">
            <p className="rounded-2xl border border-white/10 bg-white/[.04] p-4">Job searches run on demand for the signed-in user.</p>
            <p className="rounded-2xl border border-white/10 bg-white/[.04] p-4">JobPilot opens the original listing instead of silently submitting applications.</p>
            <p className="rounded-2xl border border-white/10 bg-white/[.04] p-4">Resume tailoring stays reviewable and exportable before you use it.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 pb-24 text-center sm:px-8">
        <p className="section-kicker">Ready when you are</p>
        <h2 className="mt-3 text-4xl font-black tracking-[-.04em] text-slate-950 sm:text-5xl">Your career deserves better than another job board.</h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600">Create your workspace, upload your resume and let JobPilot organize the next move.</p>
        <Link className="btn-primary mt-8 px-7 py-3.5" href="/login">Create your JobPilot workspace</Link>
      </section>

      <footer className="border-t border-slate-200 bg-white/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-7 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <div className="font-black text-slate-900">Job<span className="text-indigo-600">Pilot</span></div>
          <p>Your AI career copilot · Human-approved applications</p>
        </div>
      </footer>
    </main>
  )
}
