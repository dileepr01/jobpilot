import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function safeNextPath(value: string | null) {
  return value &&
    value.startsWith('/') &&
    !value.startsWith('//')
    ? value
    : '/dashboard'
}

export async function GET(request: Request) {
  const url = new URL(request.url)

  const code =
    url.searchParams.get('code')

  const next = safeNextPath(
    url.searchParams.get('next')
  )

  if (code) {
    const supabase = createClient()

    const { error } =
      await supabase.auth
        .exchangeCodeForSession(code)

    if (!error) {
      const forwardedHost =
        request.headers.get(
          'x-forwarded-host'
        )

      const isLocal =
        process.env.NODE_ENV ===
        'development'

      if (isLocal) {
        return NextResponse.redirect(
          `${url.origin}${next}`
        )
      }

      if (forwardedHost) {
        return NextResponse.redirect(
          `https://${forwardedHost}${next}`
        )
      }

      return NextResponse.redirect(
        `${url.origin}${next}`
      )
    }
  }

  return NextResponse.redirect(
    new URL(
      '/login?error=oauth_callback',
      url.origin
    )
  )
}
