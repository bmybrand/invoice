import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY

  if (!url || !key) {
    return null
  }

  return { url, key }
}

async function createSupabaseRouteClient(response: NextResponse) {
  const config = getSupabaseConfig()
  if (!config) {
    return null
  }

  const cookieStore = await cookies()

  return createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })
}

export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true })
  const supabase = await createSupabaseRouteClient(response)

  if (!supabase) {
    return NextResponse.json({ error: 'Supabase auth is not configured' }, { status: 503 })
  }

  const body = (await request.json().catch(() => null)) as
    | { accessToken?: string; refreshToken?: string }
    | null

  const accessToken = body?.accessToken?.trim() || ''
  const refreshToken = body?.refreshToken?.trim() || ''

  if (!accessToken || !refreshToken) {
    return NextResponse.json({ error: 'Missing access or refresh token' }, { status: 400 })
  }

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  })

  if (error) {
    return NextResponse.json({ error: 'Failed to persist auth session' }, { status: 401 })
  }

  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  const supabase = await createSupabaseRouteClient(response)

  if (!supabase) {
    return NextResponse.json({ error: 'Supabase auth is not configured' }, { status: 503 })
  }

  await supabase.auth.signOut()
  return response
}
