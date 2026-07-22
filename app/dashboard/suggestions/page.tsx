import { createClient } from '@/lib/supabase/server'
import { SuggestionCard } from '@/components/suggestion-card'
import { EmptyState } from '@/components/empty-state'

export const dynamic = 'force-dynamic'

export default async function SuggestionsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data } = await supabase.from('suggestions').select('id, type, content, deep_link').eq('user_id', user!.id).eq('dismissed', false).order('created_at', { ascending: false })
  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm font-bold text-indigo-600">Profile freshness</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight">Weekly suggestions</h1>
      <p className="mt-2 mb-7 text-sm leading-6 text-slate-500">Copy the wording you approve, then update LinkedIn or Naukri yourself. JobPilot never edits either profile.</p>
      <div className="space-y-4">
        {data?.length ? data.map((suggestion: { id: string; type: string; content: string; deep_link: string | null }) => <SuggestionCard key={suggestion.id} suggestion={suggestion} />) : <EmptyState title="No active suggestions" body="The weekly workflow looks for recurring keywords in your strongest recent matches and prepares truthful profile updates." />}
      </div>
    </div>
  )
}
