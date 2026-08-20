'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function CareerProfileControls({ enabled }: { enabled: boolean }) {
  const [autoUpdate, setAutoUpdate] = useState(enabled)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  async function toggleAutoUpdate() {
    const next = !autoUpdate
    setSaving(true)
    setMessage('')

    const response = await fetch('/api/career-profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: next })
    })

    const data = await response.json().catch(() => ({})) as { error?: string }
    setSaving(false)

    if (!response.ok) {
      setMessage(data.error || 'Could not update this setting.')
      return
    }

    setAutoUpdate(next)
    setMessage(next ? 'Automatic JobPilot profile updates are on.' : 'Automatic updates are off.')
  }

  async function refreshNow() {
    setRefreshing(true)
    setMessage('')

    const response = await fetch('/api/career-profile', { method: 'POST' })
    const data = await response.json().catch(() => ({})) as { error?: string }
    setRefreshing(false)

    if (!response.ok) {
      setMessage(data.error || 'Could not refresh Career Insights.')
      return
    }

    setMessage('Career Profile refreshed from your latest JobPilot data.')
    router.refresh()
  }

  return (
    <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
      <button type="button" className="btn-primary" onClick={refreshNow} disabled={refreshing}>
        {refreshing ? 'Refreshing…' : 'Refresh now'}
      </button>
      <button type="button" className="btn-secondary" onClick={toggleAutoUpdate} disabled={saving}>
        {saving ? 'Saving…' : autoUpdate ? 'Auto-update: On' : 'Auto-update: Off'}
      </button>
      {message && <p className="text-sm text-slate-500 sm:ml-2">{message}</p>}
    </div>
  )
}
