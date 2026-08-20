import Link from 'next/link'
import { SignOutButton } from '@/components/sign-out-button'

const nav = [
  ['⌂', 'Discover', '/dashboard'],
  ['▤', 'Applications', '/dashboard/kanban'],
  ['✦', 'Career insights', '/dashboard/suggestions'],
  ['⚙', 'Profile', '/dashboard/profile']
]

export function Sidebar({ name }: { name: string }) {
  const initial = (name || 'J').trim().charAt(0).toUpperCase()

  return (
    <aside className="border-b border-slate-200/80 bg-white/90 px-4 py-4 backdrop-blur-xl lg:fixed lg:inset-y-0 lg:left-0 lg:z-20 lg:w-72 lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
      <div className="flex items-center justify-between lg:block">
        <Link href="/dashboard" className="flex items-center gap-2 text-xl font-black tracking-tight">
          <span className="brand-mark">J</span>
          <span>Job<span className="text-indigo-600">Pilot</span></span>
        </Link>
        <div className="flex items-center gap-2 lg:mt-8 lg:rounded-2xl lg:border lg:border-slate-200 lg:bg-slate-50 lg:p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xs font-black text-white">{initial}</span>
          <div className="hidden min-w-0 lg:block">
            <p className="max-w-40 truncate text-sm font-bold text-slate-900">{name || 'Your workspace'}</p>
            <p className="text-[11px] font-medium text-slate-500">Career workspace</p>
          </div>
        </div>
      </div>

      <nav className="mt-4 flex gap-1 overflow-x-auto pb-1 lg:mt-7 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
        {nav.map(([icon, label, href]) => (
          <Link key={href} href={href} className="group flex whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-700 lg:items-center lg:gap-3">
            <span className="mr-2 text-sm text-slate-400 transition group-hover:text-indigo-600 lg:mr-0 lg:flex lg:h-7 lg:w-7 lg:items-center lg:justify-center lg:rounded-lg lg:bg-white">{icon}</span>
            {label}
          </Link>
        ))}
      </nav>

      <div className="mt-3 hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-cyan-50 p-4 lg:block">
        <p className="text-xs font-black uppercase tracking-[.15em] text-indigo-600">JobPilot tip</p>
        <p className="mt-2 text-xs leading-5 text-slate-600">Refresh discovery when your target role or location changes so your next match score uses the latest profile.</p>
      </div>

      <div className="mt-3 border-t border-slate-100 pt-3 lg:absolute lg:inset-x-5 lg:bottom-5 lg:mt-0 lg:border-0 lg:pt-0">
        <SignOutButton />
      </div>
    </aside>
  )
}
