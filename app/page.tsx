import Link from 'next/link'

const features = [
  ['Daily discovery', 'Pulls from public APIs, RSS feeds, and public Greenhouse/Lever boards.'],
  ['Explainable matching', 'Combines resume similarity with role, location, work-mode, and salary preferences.'],
  ['Application kits', 'Drafts fit bullets, cover letters, resume keyword gaps, and screening answers.'],
  ['Human controlled', 'Every application opens the original job listing. JobPilot never logs in or applies for you.']
]

export default function HomePage() {
  return (
    <main className="min-h-screen px-5 py-8 sm:px-8 lg:px-12">
      <nav className="mx-auto flex max-w-7xl items-center justify-between">
        <Link href="/" className="text-xl font-black tracking-tight">Job<span className="text-indigo-600">Pilot</span></Link>
        <Link className="btn-secondary" href="/login">Sign in</Link>
      </nav>

      <section className="mx-auto grid max-w-7xl items-center gap-12 py-20 lg:grid-cols-[1.1fr_.9fr] lg:py-28">
        <div>
          <div className="mb-5 inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-[.18em] text-indigo-700">
            AI-assisted, human-approved
          </div>
          <h1 className="max-w-4xl text-5xl font-black leading-[1.02] tracking-[-.05em] text-slate-950 sm:text-6xl lg:text-7xl">
            Wake up to jobs that actually fit your resume.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600">
            JobPilot finds legitimate openings, scores them against your experience, prepares tailored application drafts, and leaves the final review and apply action with you.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link className="btn-primary px-6 py-3" href="/login">Create your workspace</Link>
            <a className="btn-secondary px-6 py-3" href="#how-it-works">See how it works</a>
          </div>
          <p className="mt-5 text-sm text-slate-500">No LinkedIn or Naukri credentials. No hidden scraping. No auto-submit.</p>
        </div>

        <div className="card relative overflow-hidden p-5 sm:p-7">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500">Today’s top match</p>
              <h2 className="mt-1 text-2xl font-black">Senior BI Platform Engineer</h2>
            </div>
            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-center text-emerald-700">
              <div className="text-2xl font-black">91</div><div className="text-[10px] font-bold uppercase">Match</div>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {['Resume 68/75', 'Role 10/10', 'Location 6/6'].map((item) => <div key={item} className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">{item}</div>)}
          </div>
          <div className="mt-6 rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Why you fit</p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
              <li>• Enterprise Power BI and Fabric administration at large scale.</li>
              <li>• Strong gateway, governance, capacity, and automation experience.</li>
              <li>• Direct ownership of incident response and platform reliability.</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl pb-24">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {features.map(([title, body], index) => (
            <article key={title} className="card p-6">
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-sm font-black text-indigo-700">0{index + 1}</div>
              <h3 className="text-lg font-black">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
