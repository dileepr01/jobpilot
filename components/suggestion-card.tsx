'use client'

import { useState } from 'react'

export function SuggestionCard({ suggestion }: { suggestion: { id: string; type: string; content: string; deep_link: string | null } }) {
  const [dismissed, setDismissed] = useState(false)
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(suggestion.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  async function dismiss() {
    const response = await fetch(`/api/suggestions/${suggestion.id}`, { method: 'PATCH' })
    if (response.ok) setDismissed(true)
  }

  if (dismissed) return null
  return (
    <article className="card p-5 sm:p-6">
      <p className="text-xs font-black uppercase tracking-[.16em] text-indigo-600">{suggestion.type.replaceAll('_', ' ')}</p>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{suggestion.content}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <button className="btn-primary" onClick={copy}>{copied ? 'Copied' : 'Copy suggestion'}</button>
        {suggestion.deep_link && <a className="btn-secondary" href={suggestion.deep_link} target="_blank" rel="noreferrer">Open profile editor ↗</a>}
        <button className="px-3 py-2 text-sm font-semibold text-slate-400 hover:text-slate-700" onClick={dismiss}>Dismiss</button>
      </div>
    </article>
  )
}
