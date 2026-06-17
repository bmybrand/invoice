import { NextResponse } from 'next/server'

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim()
  const setupSecret = process.env.GOOGLE_OAUTH_SETUP_SECRET?.trim()
  const { searchParams, origin } = new URL(request.url)
  const providedSecret = searchParams.get('secret')?.trim()

  if (!clientId || !setupSecret) {
    return NextResponse.json(
      { error: 'Add GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_SETUP_SECRET before starting OAuth setup.' },
      { status: 503 }
    )
  }

  if (!providedSecret || providedSecret !== setupSecret) {
    return NextResponse.json({ error: 'Invalid setup secret.' }, { status: 403 })
  }

  const callbackUrl = new URL('/api/google-drive/oauth/callback', origin)
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', callbackUrl.toString())
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', DRIVE_SCOPE)
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')
  authUrl.searchParams.set('state', setupSecret)

  return NextResponse.redirect(authUrl)
}
