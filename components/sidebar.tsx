import Link from 'next/link'
import { SignOutButton } from '@/components/sign-out-button'

const nav = [
  ['Overview', '/dashboard'],
  ['Pipeline', '/dashboard/kanban'],
  ['Profile suggestions', '/dashboard/suggestions'],
  ['Settings', '/dashboard/profile']
]

export function Sidebar({ name }: { name: string }) {
  return (
    <aside className="border-b border-slate-200 bg-white px-4 py-4 lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:border-b-0 lg:border-r lg:px-5 lg:py-7">
      <div className="flex items-center justify-between lg:block">
        <Link href="/dashboard" className="text-xl font-black tracking-tight">Job<span className="text-indigo-600">Pilot</span></Link>
        <div className="text-right lg:mt-8 lg:text-left">
          <p className="max-w-40 truncate text-sm font-bold text-slate-900">{name || 'Your workspace'}</p>
          <p className="hidden text-xs text-slate-500 lg:block">Human-in-the-loop job search</p>
        </div>
      </div>
      <nav className="mt-4 flex gap-1 overflow-x-auto lg:mt-8 lg:block lg:space-y-1">
        {nav.map(([label, href]) => (
          <Link key={href} href={href} className="whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 lg:block">{label}</Link>
        ))}
      </nav>
      <div className="hidden lg:absolute lg:inset-x-5 lg:bottom-5 lg:block"><SignOutButton /></div>
    </aside>
  )
}
