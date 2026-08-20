'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function safeNextPath(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : null
}

type SocialProvider = 'google' | 'azure' | 'linkedin_oidc'
type ProviderState = Record<SocialProvider, boolean>

const socialProviders: Array<{
  provider: SocialProvider
  label: string
  mark: string
}> = [
  { provider: 'google', label: 'Google', mark: 'G' },
  { provider: 'azure', label: 'Microsoft', mark: 'M' },
  { provider: 'linkedin_oidc', label: 'LinkedIn', mark: 'in' }
]

const emptyProviders: ProviderState = {
  google: false,
  azure: false,
  linkedin_oidc: false
}

export function AuthForm() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null)
  const [providerState, setProviderState] = useState<ProviderState>(emptyProviders)
  const router = useRouter()
  const searchParams = useSearchParams()

  const nextPath = safeNextPath(searchParams.get('next')) || (mode === 'signup' ? '/onboarding' : '/dashboard')

  useEffect(() => {
    if (searchParams.get('error') === 'oauth_callback') {
      setMessage('We could not complete that sign-in. Please try email or another available method.')
    }
  }, [searchParams])

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

    if (!url || !key) return

    let cancelled = false

    fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key }
    })
      .then((response) => response.ok ? response.json() : null)
      .then((settings: { external?: Record<string, boolean> } | null) => {
        if (cancelled || !settings?.external) return
        setProviderState({
          google: Boolean(settings.external.google),
          azure: Boolean(settings.external.azure),
          linkedin_oidc: Boolean(settings.external.linkedin_oidc)
        })
      })
      .catch(() => undefined)

    return () => { cancelled = true }
  }, [])

  const enabledSocial = useMemo(
    () => socialProviders.filter(({ provider }) => providerState[provider]),
    [providerState]
  )

  async function signInWithSocial(provider: SocialProvider) {
    if (!providerState[provider]) return

    setSocialLoading(provider)
    setMessage('')
    const supabase = createClient()
    const options: { redirectTo: string; scopes?: string } = {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
    }

    if (provider === 'azure') options.scopes = 'openid profile email'

    const { error } = await supabase.auth.signInWithOAuth({ provider, options })

    if (error) {
      setMessage(error.message)
      setSocialLoading(null)
    }
  }

  async function submitEmailLink(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    const supabase = createClient()
    const destination = mode === 'signup' ? '/onboarding' : nextPath

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: mode === 'signup',
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(destination)}`
      }
    })

    setLoading(false)
    if (error) {
      setMessage(error.message)
      return
    }

    setMessage(mode === 'signup'
      ? 'Check your email to finish creating your JobPilot account.'
      : 'Check your email for your secure JobPilot sign-in link.')
  }

  async function submitPassword(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    const supabase = createClient()

    const result = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/onboarding')}`
          }
        })

    setLoading(false)
    if (result.error) {
      setMessage(result.error.message)
      return
    }

    if (mode === 'signup' && !result.data.session) {
      setMessage('Check your email to confirm your account, then continue to JobPilot.')
      return
    }

    router.push(mode === 'signup' ? '/onboarding' : nextPath)
    router.refresh()
  }

  function changeMode(nextMode: 'signin' | 'signup') {
    setMode(nextMode)
    setMessage('')
    setPassword('')
    setShowPassword(false)
  }

  return (
    <div className="w-full max-w-[440px] rounded-[1.75rem] border border-slate-200/80 bg-white p-5 shadow-2xl shadow-slate-950/10 sm:p-7">
      <div className="flex rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => changeMode('signin')}
          className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition ${mode === 'signin' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => changeMode('signup')}
          className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition ${mode === 'signup' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}
        >
          Create account
        </button>
      </div>

      <div className="mt-6">
        <h1 className="text-3xl font-black tracking-[-.04em] text-slate-950">
          {mode === 'signin' ? 'Welcome back' : 'Start your JobPilot workspace'}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {mode === 'signin'
            ? 'Pick up where you left off.'
            : 'Create your account, then upload your resume to build your career profile.'}
        </p>
      </div>

      {enabledSocial.length > 0 && (
        <div className="mt-6 space-y-2.5">
          {enabledSocial.map(({ provider, label, mark }) => (
            <button
              type="button"
              key={provider}
              onClick={() => signInWithSocial(provider)}
              disabled={Boolean(socialLoading)}
              className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-[12px] font-black text-slate-800">{mark}</span>
              {socialLoading === provider ? `Opening ${label}…` : `Continue with ${label}`}
            </button>
          ))}
        </div>
      )}

      {enabledSocial.length > 0 && (
        <div className="my-5 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.13em] text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          or
          <span className="h-px flex-1 bg-slate-200" />
        </div>
      )}

      <form onSubmit={showPassword ? submitPassword : submitEmailLink} className={enabledSocial.length ? '' : 'mt-6'}>
        <label className="label" htmlFor="email">Email address</label>
        <input
          className="input mt-1"
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
        />

        {showPassword && (
          <div className="mt-4">
            <div className="flex items-center justify-between gap-3">
              <label className="label" htmlFor="password">Password</label>
              {mode === 'signin' && (
                <Link href="/forgot-password" className="text-xs font-bold text-indigo-700">Forgot password?</Link>
              )}
            </div>
            <input
              className="input mt-1"
              id="password"
              type="password"
              minLength={8}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
            />
          </div>
        )}

        {message && (
          <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">{message}</p>
        )}

        <button className="btn-primary mt-4 w-full py-3" disabled={loading}>
          {loading
            ? 'Please wait…'
            : showPassword
              ? mode === 'signin' ? 'Sign in' : 'Create account'
              : mode === 'signin' ? 'Email me a sign-in link' : 'Create account with email'}
        </button>
      </form>

      <button
        type="button"
        className="mt-4 w-full text-center text-sm font-semibold text-slate-500 transition hover:text-indigo-700"
        onClick={() => { setShowPassword((value) => !value); setMessage('') }}
      >
        {showPassword ? 'Use a secure email link instead' : mode === 'signin' ? 'Use password instead' : 'Create account with a password instead'}
      </button>

      <p className="mt-5 text-center text-[11px] leading-5 text-slate-400">
        By continuing, you agree to use JobPilot responsibly. JobPilot never applies to a role without your action.
      </p>
    </div>
  )
}
