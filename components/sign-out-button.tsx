'use client'

import { createClient } from '@/lib/supabase/client'

export function SignOutButton() {
  async function signOut() {
    await createClient().auth.signOut()
    window.location.href = '/login'
  }
  return <button onClick={signOut} className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900">Sign out</button>
}
