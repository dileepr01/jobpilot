import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const patchSchema = z.object({
  status: z.enum(['new', 'reviewed', 'applied', 'interview', 'offer', 'rejected']).optional(),
  cover_letter: z.string().max(20_000).optional(),
  notes: z.string().max(10_000).optional()
})

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const patch = patchSchema.parse(await request.json())
    const payload = {
      ...patch,
      ...(patch.status === 'applied' ? { applied_at: new Date().toISOString() } : {})
    }
    const { data, error } = await supabase.from('matches').update(payload).eq('id', params.id).eq('user_id', user.id).select().single()
    if (error) throw error
    return NextResponse.json({ match: data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Update failed' }, { status: 400 })
  }
}
