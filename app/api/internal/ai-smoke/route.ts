import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

const EXPECTED_HASH = '1c59f30a0e026cb4af9ecf6827a20e13a589ae03674c75c057708f28f3ce4d39'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token') || ''
  const actualHash = createHash('sha256').update(token).digest('hex')

  if (actualHash !== EXPECTED_HASH) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const gatewayToken =
    request.headers.get('x-vercel-oidc-token') ||
    process.env.AI_GATEWAY_API_KEY ||
    process.env.VERCEL_OIDC_TOKEN

  if (!gatewayToken) {
    return NextResponse.json({ ok: false, error: 'Gateway auth unavailable' }, { status: 500 })
  }

  const response = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${gatewayToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'openai/gpt-5.4-mini',
      messages: [
        { role: 'system', content: 'Return only compact valid JSON.' },
        { role: 'user', content: 'Return {"ok":true,"provider":"openai"}.' }
      ],
      stream: false
    })
  })

  const text = await response.text()
  return NextResponse.json({
    ok: response.ok,
    status: response.status,
    response: text.slice(0, 1000)
  }, { status: response.ok ? 200 : 502 })
}
