import { createClient } from '@/lib/supabase/server'
import { ProfileForm } from '@/components/profile-form'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [{ data: profile }, { data: sources }] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', user!.id).single(),
    supabase.from('job_sources').select('*').eq('user_id', user!.id).order('created_at')
  ])
  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm font-bold text-indigo-600">Workspace settings</p>
      <h1 className="mt-1 mb-7 text-3xl font-black tracking-tight">Profile and sources</h1>
      <ProfileForm profile={profile} sources={sources || []} />
    </div>
  )
}
