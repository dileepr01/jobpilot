'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function safeNextPath(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : null
}

type SocialProvider = 'google' | 'azure' | 'linkedin_oidc'

const socialProviders: Array<{ provider: SocialProvider; label: string; mark: string }> = [
  { provider: 'google', label: 'Google', mark: 'G' },
  { provider: 'azure', label: 'Microsoft', mark: 'M' },
  { provider: 'linkedin_oidc', label: 'LinkedIn', mark: 'in' }
]

export function AuthForm() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [method, setMethod] = useState<'magic' | 'password'>('magic')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  const nextPath = safeNextPath(searchParams.get('next')) || (mode === 'signup' ? '/onboarding' : '/dashboard')

  async function signInWithSocial(provider: SocialProvider) {
    setSocialLoading(provider)
    setMessage('')
    const supabase = createClient()
    const options: { redirectTo: string; scopes?: string } = {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
    }
    if (provider === 'azure') options.scopes = 'email'

    const { error } = await supabase.auth.signInWithOAuth({ provider, options })
    if (error) {
      setMessage(`${socialProviders.find((item) => item.provider === provider)?.label || 'Social'} sign-in is not available yet. You can continue with email instead.`)
      setSocialLoading(null)
    }
  }

  async function submitMagicLink(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
      }
    })
    setLoading(false)
    if (error) {
      setMessage(error.message)
      return
    }
    setMessage('Check your email for your secure JobPilot sign-in link.')
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
          options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/onboarding')}` }
        })

    setLoading(false)
    if (result.error) {
      setMessage(result.error.message)
      return
    }

    if (mode === 'signup' && !result.data.session) {
      setMessage('Check your email to confirm your account, then sign in.')
      return
    }

    router.push(nextPath)
    router.refresh()
  }

  return (
    <div className="w-full max-w-md rounded-[2rem] border border-white/80 bg-white/95 p-6 shadow-2xl shadow-indigo-950/10 backdrop-blur-xl sm:p-8">
      <div className="mb-6">
        <div className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">Your AI career copilot</div>
        <h1 className="mt-4 text-3xl font-black tracking-[-.04em] text-slate-950">{mode === 'signin' ? 'Welcome back' : 'Create your workspace'}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{mode === 'signin' ? 'Continue your job search with your saved profile and application history.' : 'Start with the fastest sign-in method. Your resume becomes your profile after login.'}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {socialProviders.map(({ provider, label, mark }) => (
          <button
            type="button"
            key={provider}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 disabled:opacity-50"
            onClick={() => signInWithSocial(provider)}
            disabled={Boolean(socialLoading)}
            aria-label={`Continue with ${label}`}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-[11px] font-black text-slate-800">{mark}</span>
            <span className="hidden sm:inline">{socialLoading === provider ? 'Opening…' : label}</span>
          </button>
        ))}
      </div>

      <div className="my-6 flex items-center gap-3 text-xs font-semibold text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        or continue with email
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      {method === 'magic' ? (
        <form onSubmit={submitMagicLink} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input className="input" id="email" type="email" autoComplete="email" required placeholder="you@example.com" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} />
          </div>
          {message && <p className="rounded-xl bg-slate-100 p-3 text-sm leading-6 text-slate-700">{message}</p>}
          <button className="btn-primary w-full py-3" disabled={loading}>{loading ? 'Sending secure link…' : 'Email me a sign-in link'}</button>
          <p className="text-center text-xs leading-5 text-slate-400">No password to remember. The link signs you in securely.</p>
        </form>
      ) : (
        <form onSubmit={submitPassword} className="space-y-4">
          <div>
            <label className="label" htmlFor="password-email">Email</label>
            <input className="input" id="password-email" type="email" autoComplete="email" required value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input className="input" id="password" type="password" minLength={8} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} />
            {mode === 'signin' && <Link href="/forgot-password" className="mt-2 block text-right text-sm font-semibold text-indigo-700">Forgot password?</Link>}
          </div>
          {message && <p className="rounded-xl bg-slate-100 p-3 text-sm leading-6 text-slate-700">{message}</p>}
          <button className="btn-primary w-full py-3" disabled={loading}>{loading ? 'Please wait…' : mode === 'signin' ? 'Sign in with password' : 'Create account'}</button>
        </form>
      )}

      <div className="mt-6 grid gap-2 border-t border-slate-100 pt-5 text-center text-sm">
        <button type="button" className="font-semibold text-slate-600 hover:text-indigo-700" onClick={() => { setMethod(method === 'magic' ? 'password' : 'magic'); setMessage('') }}>
          {method === 'magic' ? 'Use password instead' : 'Use passwordless email instead'}
        </button>
        {method === 'password' && (
          <button type="button" className="font-semibold text-indigo-700" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage('') }}>
            {mode === 'signin' ? 'New here? Create an account' : 'Already registered? Sign in'}
          </button>
        )}
      </div>
    </div>
  )
}
