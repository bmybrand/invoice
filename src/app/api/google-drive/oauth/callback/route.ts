import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()
  const setupSecret = process.env.GOOGLE_OAUTH_SETUP_SECRET?.trim()
  const url = new URL(request.url)
  const code = url.searchParams.get('code')?.trim()
  const state = url.searchParams.get('state')?.trim()
  const error = url.searchParams.get('error')?.trim()

  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }

  if (!clientId || !clientSecret || !setupSecret) {
    return NextResponse.json(
      { error: 'Add GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and GOOGLE_OAUTH_SETUP_SECRET.' },
      { status: 503 }
    )
  }

  if (!state || state !== setupSecret) {
    return NextResponse.json({ error: 'Invalid setup state.' }, { status: 403 })
  }

  if (!code) {
    return NextResponse.json({ error: 'Missing authorization code.' }, { status: 400 })
  }

  const redirectUri = new URL('/api/google-drive/oauth/callback', url.origin).toString()
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  const tokenPayload = (await tokenResponse.json().catch(() => null)) as
    | { refresh_token?: string; access_token?: string; error?: string; error_description?: string }
    | null

  if (!tokenResponse.ok || !tokenPayload?.refresh_token) {
    return NextResponse.json(
      {
        error:
          tokenPayload?.error_description ||
          tokenPayload?.error ||
          'Google did not return a refresh token. Reopen the start URL and approve consent again.',
      },
      { status: 500 }
    )
  }

  return new NextResponse(
    `Add this to .env.local:\n\nGOOGLE_OAUTH_REFRESH_TOKEN="${tokenPayload.refresh_token}"\n\nThen restart the server.`,
    {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    }
  )
}
