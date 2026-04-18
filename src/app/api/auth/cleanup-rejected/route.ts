import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { applyRateLimit, getRateLimitIdentity } from '@/lib/rate-limit'

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return NextResponse.json(
      {
        error:
          'Server not configured. Add NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY, and SUPABASE_SERVICE_ROLE_KEY to .env.local',
      },
      { status: 503 }
    )
  }

  if (!token) {
    return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 })
  }

  const rateLimit = applyRateLimit({
    key: `cleanup-rejected:${getRateLimitIdentity(request)}`,
    limit: 10,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json({ error: 'Too many cleanup requests. Please try again shortly.' }, { status: 429 })
  }

  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser(token)

  if (userError || !user) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const normalizedEmail = (user.email ?? '').trim()
  const { data: latestByAuthId, error: authRequestError } = await adminClient
    .from('clients')
    .select('status, auth_id, handler_id, isdeleted')
    .neq('isdeleted', true)
    .eq('auth_id', user.id)
    .order('created_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (authRequestError) {
    return NextResponse.json({ error: authRequestError.message }, { status: 500 })
  }

  const { data: latestByEmail, error: emailRequestError } = normalizedEmail
    ? await adminClient
        .from('clients')
        .select('status, auth_id, handler_id, isdeleted')
        .neq('isdeleted', true)
        .eq('email', normalizedEmail)
        .order('created_date', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null, error: null }

  if (emailRequestError) {
    return NextResponse.json({ error: emailRequestError.message }, { status: 500 })
  }

  const authRow = latestByAuthId as { status?: string | null; auth_id?: string | null; created_date?: string | null } | null
  const emailRow = latestByEmail as { status?: string | null; auth_id?: string | null; created_date?: string | null } | null
  const requestRow =
    !authRow ? emailRow :
    !emailRow ? authRow :
    new Date(emailRow.created_date || 0).getTime() > new Date(authRow.created_date || 0).getTime()
      ? emailRow
      : authRow
  const requestStatus = requestRow?.status?.trim().toLowerCase()
  const requestAuthId = (requestRow?.auth_id || '').trim()

  if (requestStatus !== 'rejected' || (requestAuthId && requestAuthId !== user.id)) {
    return NextResponse.json({ error: 'Account is not rejected' }, { status: 403 })
  }

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id)
  const deleteMessage = deleteError?.message?.toLowerCase() || ''

  if (deleteError && !deleteMessage.includes('user not found')) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}





