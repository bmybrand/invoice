import { createClient, type User } from '@supabase/supabase-js'

type UploadAuthSuccess = {
  ok: true
  user: User
}

type UploadAuthFailure = {
  ok: false
  status: number
  error: string
}

export type UploadAuthResult = UploadAuthSuccess | UploadAuthFailure

export async function requireUploadAuth(request: Request): Promise<UploadAuthResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!supabaseUrl || !publishableKey) {
    return {
      ok: false,
      status: 503,
      error: 'Server auth is not configured.',
    }
  }

  if (!token) {
    return { ok: false, status: 401, error: 'Missing authorization token' }
  }

  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token)

  if (error || !user) {
    return { ok: false, status: 401, error: 'Authentication failed' }
  }

  return { ok: true, user }
}
