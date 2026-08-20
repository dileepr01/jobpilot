import Link from 'next/link'
import { HowItWorksChoices } from '@/components/how-it-works-choices'

const pillars = [
  ['Discover', 'Run a fresh job search when you want and bring supported sources into one ranked feed.'],
  ['Understand', 'See why a role fits before you spend time tailoring or applying.'],
  ['Apply stronger', 'Create a role-specific resume, keep the application context, and track what happens next.']
]

const demoVideoUrl = 'https://resource2.heygen.ai/aws_pacific/avatar_tmp/014bf5fa519a45ceb89f17b0e58060e2/v12d3a58a8c3d468a907bf1c8599048a7/caption_931e9f936c3a4633bb1ea174058f14ad.mp4'

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-slate-50">
      <header className="border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-12">
          <Link href="/" className="flex items-center gap-2 text-xl font-black tracking-tight text-slate-950">
            <span className="brand-mark">J</span>
            <span>Job<span className="text-indigo-600">Pilot</span></span>
          </Link>
          <div className="hidden items-center gap-7 text-sm font-semibold text-slate-600 md:flex">
            <a href="#what-it-does" className="transition hover:text-slate-950">What it does</a>
            <a href="#how-it-works" className="transition hover:text-slate-950">How it works</a>
          </div>
          <div className="flex items-center gap-2">
            <Link className="hidden rounded-xl px-3 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-100 sm:inline-flex" href="/login">Sign in</Link>
            <Link className="btn-primary" href="/login">Get started</Link>
          </div>
        </nav>
      </header>

      <section className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-14 sm:px-8 lg:grid-cols-[1.02fr_.98fr] lg:px-12 lg:pb-24 lg:pt-20">
        <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[480px] w-[760px] -translate-x-1/2 rounded-full bg-indigo-300/20 blur-3xl" />
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[.15em] text-indigo-700 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            AI career copilot
          </div>
          <h1 className="max-w-3xl text-5xl font-black leading-[.98] tracking-[-.055em] text-slate-950 sm:text-6xl lg:text-7xl">
            Turn your resume into a smarter job search.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            JobPilot finds relevant roles, explains the fit, helps tailor your resume, and keeps every application organized in one workspace.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="btn-primary px-6 py-3" href="/login">Start with your resume</Link>
            <a className="btn-secondary px-6 py-3" href="#how-it-works">See how it works</a>
          </div>
          <p className="mt-5 text-sm font-medium text-slate-500">Searches run when you ask. You decide what to apply to.</p>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-indigo-500/20 via-cyan-300/10 to-transparent blur-2xl" />
          <div className="overflow-hidden rounded-[2rem] border border-white/80 bg-slate-950 p-3 shadow-2xl shadow-indigo-950/20">
            <div className="rounded-[1.55rem] border border-white/10 bg-slate-900 p-5 text-white sm:p-7">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[.16em] text-indigo-300">Best match</p>
                  <h2 className="mt-2 text-2xl font-black">Senior Product Analyst</h2>
                  <p className="mt-1 text-sm text-slate-400">Product company · Hybrid</p>
                </div>
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-center text-emerald-300">
                  <div className="text-2xl font-black">92%</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider">Match</div>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {['Experience', 'Skills', 'Location'].map((item, index) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/[.04] p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{item}</p>
                    <p className="mt-2 text-lg font-black">{[95, 91, 100][index]}%</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[.04] p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">Why it fits</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">Strong alignment with your recent experience and target seniority. Review two weaker keywords before applying.</p>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-xl bg-indigo-500 px-4 py-2.5 text-xs font-bold">Tailor resume</span>
                <span className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-bold text-slate-300">View original job</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="what-it-does" className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-12 lg:py-16">
        <div className="max-w-2xl">
          <p className="section-kicker">Three things that matter</p>
          <h2 className="section-title">Less searching. Better decisions.</h2>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {pillars.map(([title, body], index) => (
            <article key={title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-xs font-black text-white">0{index + 1}</div>
              <h3 className="mt-5 text-xl font-black tracking-tight text-slate-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="border-y border-slate-200 bg-white/70">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
          <div className="grid gap-8 lg:grid-cols-[.7fr_1.3fr] lg:items-start">
            <div>
              <p className="section-kicker">How it works</p>
              <h2 className="section-title">Watch it or explore it.</h2>
              <p className="section-copy">Choose the quick video when you want the overview, or open the interactive walkthrough when you want to move step by step.</p>
            </div>
            <HowItWorksChoices videoUrl={demoVideoUrl} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-12 lg:py-16">
        <div className="flex flex-col gap-5 rounded-[2rem] bg-slate-950 px-6 py-8 text-white sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-cyan-300">Human-controlled by design</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">AI helps prepare. You make the career decision.</h2>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-slate-300">
            <span>✓ On-demand search</span>
            <span>✓ Review before export</span>
            <span>✓ No silent applications</span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-20 pt-4 text-center sm:px-8 lg:pb-24">
        <h2 className="text-4xl font-black tracking-[-.04em] text-slate-950 sm:text-5xl">Ready to make the next search count?</h2>
        <Link className="btn-primary mt-7 px-7 py-3.5" href="/login">Create your JobPilot workspace</Link>
      </section>

      <footer className="border-t border-slate-200 bg-white/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 text-sm text-slate-500 sm:px-8 lg:px-12">
          <div className="font-black text-slate-900">Job<span className="text-indigo-600">Pilot</span></div>
          <p>Your AI career copilot</p>
        </div>
      </footer>
    </main>
  )
}
