import { createClient } from '@/lib/supabase/server'
import { KanbanBoard, type KanbanItem } from '@/components/kanban-board'

export const dynamic = 'force-dynamic'

export default async function KanbanPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data } = await supabase.from('matches').select('id, score, status, jobs!inner(title, company, external_url)').eq('user_id', user!.id).order('updated_at', { ascending: false })
  return (
    <div className="mx-auto max-w-[1500px]">
      <p className="text-sm font-bold text-indigo-600">Application pipeline</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight">Kanban board</h1>
      <p className="mt-2 mb-7 text-sm text-slate-500">Drag cards between stages on desktop, or use the status selector on mobile.</p>
      <KanbanBoard initialItems={(data || []) as unknown as KanbanItem[]} />
    </div>
  )
}
