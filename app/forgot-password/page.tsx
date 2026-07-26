'use client'

import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    const supabase = createClient()

    const redirectTo =
      `${window.location.origin}` +
      `/auth/callback?next=/update-password`

    const { error } =
      await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo }
      )

    setLoading(false)

    if (error) {
      setMessage(
        'Unable to send the reset email. Please try again shortly.'
      )
      return
    }

    setMessage(
      'If an account exists for this email, a password-reset link has been sent.'
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
            Reset password
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Enter your account email to receive a password-reset link.
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>

              <input
                className="input"
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
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
                ? 'Sending…'
                : 'Send reset link'}
            </button>
          </form>

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
