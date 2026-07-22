import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase.from('profiles').select('full_name, resume_url').eq('user_id', user.id).maybeSingle()
  if (!profile?.resume_url) redirect('/onboarding')

  return (
    <div className="min-h-screen">
      <Sidebar name={profile.full_name || user.email || ''} />
      <main className="px-5 py-7 sm:px-8 lg:ml-64 lg:px-10 lg:py-10">{children}</main>
    </div>
  )
}
