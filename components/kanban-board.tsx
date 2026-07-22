'use client'

import { useState } from 'react'
import type { MatchStatus } from '@/lib/types'

export interface KanbanItem {
  id: string
  score: number
  status: MatchStatus
  jobs: { title: string; company: string; external_url: string }
}

const columns: Array<{ status: MatchStatus; label: string }> = [
  { status: 'new', label: 'New' },
  { status: 'reviewed', label: 'Reviewed' },
  { status: 'applied', label: 'Applied' },
  { status: 'interview', label: 'Interview' },
  { status: 'offer', label: 'Offer' },
  { status: 'rejected', label: 'Rejected' }
]

export function KanbanBoard({ initialItems }: { initialItems: KanbanItem[] }) {
  const [items, setItems] = useState(initialItems)
  const [draggedId, setDraggedId] = useState<string | null>(null)

  async function move(id: string, status: MatchStatus) {
    const previous = items
    setItems((current) => current.map((item) => item.id === id ? { ...item, status } : item))
    const response = await fetch(`/api/matches/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    if (!response.ok) setItems(previous)
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((column) => {
        const columnItems = items.filter((item) => item.status === column.status)
        return (
          <section key={column.status} className="min-h-96 min-w-72 flex-1 rounded-3xl border border-slate-200 bg-slate-100/70 p-3" onDragOver={(event: React.DragEvent<HTMLElement>) => event.preventDefault()} onDrop={() => draggedId && void move(draggedId, column.status)}>
            <div className="flex items-center justify-between px-2 py-2"><h2 className="text-sm font-black">{column.label}</h2><span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-slate-500">{columnItems.length}</span></div>
            <div className="mt-2 space-y-3">
              {columnItems.map((item) => (
                <article key={item.id} draggable onDragStart={() => setDraggedId(item.id)} onDragEnd={() => setDraggedId(null)} className="cursor-grab rounded-2xl border border-slate-200 bg-white p-4 shadow-sm active:cursor-grabbing">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{item.jobs.company}</p>
                  <h3 className="mt-1 font-black leading-snug">{item.jobs.title}</h3>
                  <div className="mt-3 flex items-center justify-between"><span className="rounded-lg bg-indigo-50 px-2 py-1 text-xs font-black text-indigo-700">{Math.round(item.score)} match</span><a href={item.jobs.external_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-slate-500">Open ↗</a></div>
                  <select className="input mt-3 py-2 text-xs sm:hidden" value={item.status} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => void move(item.id, event.target.value as MatchStatus)}>{columns.map((option) => <option key={option.status} value={option.status}>{option.label}</option>)}</select>
                </article>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
