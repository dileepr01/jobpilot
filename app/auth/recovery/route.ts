import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function redirectUrl(request: Request, path: string) {
  const url = new URL(request.url)
  const forwardedHost = request.headers.get('x-forwarded-host')
  const isLocal = process.env.NODE_ENV === 'development'

  if (!isLocal && forwardedHost) {
    return `https://${forwardedHost}${path}`
  }

  return `${url.origin}${path}`
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(
        redirectUrl(request, '/update-password')
      )
    }
  }

  return NextResponse.redirect(
    redirectUrl(request, '/login?error=recovery_callback')
  )
}
