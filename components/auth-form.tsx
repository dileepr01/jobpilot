'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function safeNextPath(value: string | null) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : null
}

export function AuthForm() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    const supabase = createClient()

    const result = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
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

    router.push(safeNextPath(searchParams.get('next')) || (mode === 'signup' ? '/onboarding' : '/dashboard'))
    router.refresh()
  }


  return (
    <div className="card w-full max-w-md p-7 sm:p-9">
      <div className="mb-7">
        <p className="text-sm font-bold text-indigo-600">Welcome to JobPilot</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">{mode === 'signin' ? 'Sign in' : 'Create an account'}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Your resume and application drafts stay in your Supabase project.</p>
      </div>


      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" type="email" autoComplete="email" required value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input className="input" id="password" type="password" minLength={8} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} />
        </div>
        {message && <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{message}</p>}
        <button className="btn-primary w-full" disabled={loading}>{loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
      </form>

      <button type="button" className="mt-5 w-full text-sm font-semibold text-indigo-700" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage('') }}>
        {mode === 'signin' ? 'New here? Create an account' : 'Already registered? Sign in'}
      </button>
    </div>
  )
}
