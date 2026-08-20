import { createClient } from '@/lib/supabase/server'
import { ProfileForm } from '@/components/profile-form'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const [
    { data: profile },
    { data: sources },
    { data: naukriConnection }
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', user!.id).single(),
    supabase.from('job_sources').select('*').eq('user_id', user!.id).order('created_at'),
    supabase
      .from('naukri_connections')
      .select('enabled, status')
      .eq('user_id', user!.id)
      .maybeSingle()
  ])

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm font-bold text-indigo-600">Career Profile</p>
      <h1 className="mt-1 mb-2 text-3xl font-black tracking-tight">Your career source of truth</h1>
      <p className="mb-7 max-w-3xl text-sm leading-6 text-slate-500">
        Edit your real skills, target roles, title and preferences here. Meaningful changes refresh JobPilot matching and, when connected, send only genuine profile deltas to Naukri.
      </p>
      <ProfileForm
        profile={profile}
        sources={sources || []}
        naukriConnection={naukriConnection || null}
      />
    </div>
  )
}
