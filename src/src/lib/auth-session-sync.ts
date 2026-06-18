import type { Session } from '@supabase/supabase-js'

type SessionPayload = Pick<Session, 'access_token' | 'refresh_token'>

export async function syncServerAuthSession(session: SessionPayload | null) {
  const response = await fetch('/api/auth/session', {
    method: session ? 'POST' : 'DELETE',
    headers: session ? { 'Content-Type': 'application/json' } : undefined,
    body: session
      ? JSON.stringify({
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
        })
      : undefined,
    cache: 'no-store',
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw new Error(`Failed to sync auth session (${response.status})`)
  }
}
