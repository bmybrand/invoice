import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applyRateLimit, getRateLimitIdentity } from '@/lib/rate-limit'

type PushSubscriptionPayload = {
  endpoint?: string
  keys?: {
    p256dh?: string
    auth?: string
  }
}

function buildClients(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return {
      ok: false as const,
      status: 503,
      error:
        'Server not configured. Add NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY, and SUPABASE_SERVICE_ROLE_KEY to .env.local',
    }
  }

  if (!token) {
    return { ok: false as const, status: 401, error: 'Missing authorization token' }
  }

  return {
    ok: true as const,
    token,
    authClient: createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    serviceClient: createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  }
}

async function requireEmployee(request: Request) {
  const setup = buildClients(request)
  if (!setup.ok) return setup

  const {
    data: { user },
    error: userError,
  } = await setup.authClient.auth.getUser(setup.token)

  if (userError || !user) {
    return { ok: false as const, status: 401, error: 'Authentication failed' }
  }

  const { data: employee, error: employeeError } = await setup.serviceClient
    .from('employees')
    .select('auth_id')
    .eq('auth_id', user.id)
    .neq('isdeleted', true)
    .maybeSingle()

  if (employeeError || !employee) {
    return { ok: false as const, status: 403, error: 'Only employees can register push notifications' }
  }

  return {
    ok: true as const,
    user,
    supabase: setup.serviceClient,
  }
}

export async function POST(request: Request) {
  const auth = await requireEmployee(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const rateLimit = applyRateLimit({
    key: `push-subscriptions-post:${auth.user.id}:${getRateLimitIdentity(request)}`,
    limit: 30,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json({ error: 'Too many push subscription requests. Please try again shortly.' }, { status: 429 })
  }

  const body = (await request.json().catch(() => null)) as { subscription?: PushSubscriptionPayload } | null
  const subscription = body?.subscription
  const endpoint = String(subscription?.endpoint ?? '').trim()
  const p256dh = String(subscription?.keys?.p256dh ?? '').trim()
  const authKey = String(subscription?.keys?.auth ?? '').trim()

  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json({ error: 'Invalid push subscription' }, { status: 400 })
  }

  const { error } = await auth.supabase
    .from('push_subscriptions')
    .upsert(
      {
        auth_id: auth.user.id,
        endpoint,
        p256dh,
        auth: authKey,
        user_agent: request.headers.get('user-agent') || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    )

  if (error) {
    return NextResponse.json({ error: error.message || 'Failed to save push subscription' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const auth = await requireEmployee(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const rateLimit = applyRateLimit({
    key: `push-subscriptions-delete:${auth.user.id}:${getRateLimitIdentity(request)}`,
    limit: 30,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json({ error: 'Too many push subscription requests. Please try again shortly.' }, { status: 429 })
  }

  const body = (await request.json().catch(() => null)) as { endpoint?: string } | null
  const endpoint = String(body?.endpoint ?? '').trim()

  if (!endpoint) {
    return NextResponse.json({ error: 'Endpoint is required' }, { status: 400 })
  }

  const { error } = await auth.supabase
    .from('push_subscriptions')
    .delete()
    .eq('auth_id', auth.user.id)
    .eq('endpoint', endpoint)

  if (error) {
    return NextResponse.json({ error: error.message || 'Failed to remove push subscription' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
