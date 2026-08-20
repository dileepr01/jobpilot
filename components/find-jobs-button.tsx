'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface SearchResult {
  discovered?: number
  matches?: number
  strong?: number
  error?: string
  retryAfterSeconds?: number
}

export function FindJobsButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

  async function search() {
    setBusy(true)
    setMessage('Searching live job sources…')
    setIsError(false)

    try {
      const response = await fetch('/api/matches/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'manual' })
      })
      const data = await response.json().catch(() => ({})) as SearchResult

      if (!response.ok) {
        throw new Error(data.error || 'Could not search for jobs.')
      }

      setMessage(
        `Found ${data.discovered || 0} live jobs and refreshed ${data.matches || 0} matches.`
      )
      router.refresh()
    } catch (error) {
      setIsError(true)
      setMessage(
        error instanceof Error ? error.message : 'Could not search for jobs.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        type="button"
        className="btn-primary min-w-40"
        disabled={busy}
        onClick={() => void search()}
      >
        {busy ? 'Searching…' : 'Search for jobs'}
      </button>
      {message && (
        <p
          className={`max-w-sm text-xs ${
            isError ? 'text-rose-600' : 'text-slate-500'
          }`}
        >
          {message}
        </p>
      )}
    </div>
  )
}
