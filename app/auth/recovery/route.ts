import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function redirectUrl(request: NextRequest, path: string) {
  const forwardedHost = request.headers.get('x-forwarded-host')
  const isLocal = process.env.NODE_ENV === 'development'
  const origin =
    !isLocal && forwardedHost
      ? `https://${forwardedHost}`
      : request.nextUrl.origin

  return new URL(path, origin)
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash')
  const type =
    request.nextUrl.searchParams.get('type') as EmailOtpType | null

  if (tokenHash && type) {
    const supabase = createClient()

    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type
    })

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
