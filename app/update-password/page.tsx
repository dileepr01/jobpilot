'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] =
    useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] =
    useState(true)
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    async function checkSession() {
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()

      setHasSession(Boolean(data.user))
      setCheckingSession(false)
    }

    checkSession()
  }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setMessage('')

    if (password.length < 8) {
      setMessage(
        'Your password must contain at least 8 characters.'
      )
      return
    }

    if (password !== confirmPassword) {
      setMessage('The passwords do not match.')
      return
    }

    setLoading(true)

    const supabase = createClient()

    const { error } = await supabase.auth.updateUser({
      password
    })

    setLoading(false)

    if (error) {
      setMessage(
        'The reset link may be invalid or expired. Please request another link.'
      )
      return
    }

    await supabase.auth.signOut()

    setPassword('')
    setConfirmPassword('')
    setHasSession(false)
    setMessage(
      'Password updated successfully. You can now sign in.'
    )
  }

  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <div className="w-full max-w-md">
        <Link
          href="/login"
          className="mx-auto mb-8 block w-fit text-xl font-black"
        >
          Job<span className="text-indigo-600">Pilot</span>
        </Link>

        <div className="card p-7 sm:p-9">
          <h1 className="text-3xl font-black tracking-tight">
            Choose a new password
          </h1>

          {checkingSession ? (
            <p className="mt-5 text-sm text-slate-600">
              Verifying your reset link…
            </p>
          ) : hasSession ? (
            <form
              onSubmit={submit}
              className="mt-7 space-y-4"
            >
              <div>
                <label
                  className="label"
                  htmlFor="password"
                >
                  New password
                </label>

                <input
                  className="input"
                  id="password"
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                />
              </div>

              <div>
                <label
                  className="label"
                  htmlFor="confirmPassword"
                >
                  Confirm new password
                </label>

                <input
                  className="input"
                  id="confirmPassword"
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(
                      event.target.value
                    )
                  }
                />
              </div>

              {message && (
                <p
                  aria-live="polite"
                  className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700"
                >
                  {message}
                </p>
              )}

              <button
                className="btn-primary w-full"
                disabled={loading}
              >
                {loading
                  ? 'Updating…'
                  : 'Update password'}
              </button>
            </form>
          ) : (
            <div className="mt-5">
              <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
                {message ||
                  'This password-reset link is invalid or has expired.'}
              </p>

              <Link
                href="/forgot-password"
                className="mt-5 block text-center text-sm font-semibold text-indigo-700"
              >
                Request another reset link
              </Link>
            </div>
          )}

          <Link
            href="/login"
            className="mt-5 block text-center text-sm font-semibold text-indigo-700"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </main>
  )
}
