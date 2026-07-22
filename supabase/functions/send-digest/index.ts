import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]!)
}

function configuredSecretKeys() {
  const keys: string[] = []
  const current = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (current) {
    try {
      const parsed = JSON.parse(current) as Record<string, string>
      keys.push(...Object.values(parsed).filter(Boolean))
    } catch {
      console.error('SUPABASE_SECRET_KEYS is not valid JSON')
    }
  }
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) keys.push(legacy)
  return keys
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  try {
    const callerKey = request.headers.get('apikey')
    const validKeys = configuredSecretKeys()
    if (!callerKey || !validKeys.includes(callerKey)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId } = await request.json()
    if (typeof userId !== 'string' || !/^[0-9a-f-]{36}$/i.test(userId)) return Response.json({ error: 'Invalid userId' }, { status: 400 })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabase = createClient(supabaseUrl, callerKey, { auth: { persistSession: false } })
    const { data: userResult, error: userError } = await supabase.auth.admin.getUserById(userId)
    if (userError || !userResult.user?.email) throw userError || new Error('User email not found')

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: matches, error } = await supabase
      .from('matches')
      .select('score, why_fit, jobs!inner(title, company, location, external_url)')
      .eq('user_id', userId)
      .gte('score', 75)
      .gte('updated_at', since)
      .order('score', { ascending: false })
      .limit(5)
    if (error) throw error
    if (!matches?.length) return Response.json({ sent: false, reason: 'no-new-high-matches' })

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) return Response.json({ sent: false, reason: 'RESEND_API_KEY-not-configured' })
    const appUrl = Deno.env.get('APP_URL') || 'http://localhost:3000'
    const cards = matches.map((match: any) => {
      const job = match.jobs
      const bullets = Array.isArray(match.why_fit) ? match.why_fit.slice(0, 3).map((item: string) => `<li>${escapeHtml(item)}</li>`).join('') : ''
      return `<div style="border:1px solid #e2e8f0;border-radius:16px;padding:18px;margin:14px 0"><div style="font-size:12px;color:#64748b;font-weight:700;text-transform:uppercase">${escapeHtml(job.company)} · ${escapeHtml(job.location || 'Flexible')}</div><h2 style="margin:8px 0 4px;font-size:20px">${escapeHtml(job.title)}</h2><div style="font-size:14px;color:#4f46e5;font-weight:800">${Math.round(Number(match.score))}% match</div>${bullets ? `<ul style="color:#475569;line-height:1.6">${bullets}</ul>` : ''}<a href="${escapeHtml(job.external_url)}" style="display:inline-block;margin-top:8px;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 14px;border-radius:10px;font-weight:700">Review original posting</a></div>`
    }).join('')

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: Deno.env.get('RESEND_FROM_EMAIL') || 'JobPilot <jobs@example.com>',
        to: userResult.user.email,
        subject: `JobPilot: ${matches.length} high-match job${matches.length === 1 ? '' : 's'} today`,
        html: `<div style="font-family:Inter,Arial,sans-serif;max-width:680px;margin:auto;color:#0f172a"><h1>Your JobPilot matches</h1><p style="color:#64748b">These are drafts for your review. JobPilot does not submit applications.</p>${cards}<p><a href="${appUrl}/dashboard">Open your dashboard</a></p></div>`
      })
    })
    if (!response.ok) throw new Error(`Resend returned ${response.status}: ${await response.text()}`)
    return Response.json({ sent: true })
  } catch (error) {
    console.error(error)
    return Response.json({ error: error instanceof Error ? error.message : 'Digest failed' }, { status: 500 })
  }
})
