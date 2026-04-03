import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type EmployeeRole = 'user' | 'admin' | 'superadmin'

function normalizeRole(value: string | null | undefined): EmployeeRole {
  const normalized = (value || '').trim().toLowerCase().replace(/\s+/g, '')
  if (normalized === 'superadmin') return 'superadmin'
  if (normalized === 'admin') return 'admin'
  return 'user'
}

function buildServerClients(request: Request) {
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

  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return {
    ok: true as const,
    authClient,
    serviceClient,
    token,
  }
}

export async function GET(request: Request) {
  const setup = buildServerClients(request)
  if (!setup.ok) {
    return NextResponse.json({ error: setup.error }, { status: setup.status })
  }

  const {
    data: { user },
    error: userError,
  } = await setup.authClient.auth.getUser(setup.token)

  if (userError || !user) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
  }

  const { data: employeeRow, error: employeeError } = await setup.serviceClient
    .from('employees')
    .select('role')
    .eq('auth_id', user.id)
    .neq('isdeleted', true)
    .maybeSingle()

  if (employeeError) {
    return NextResponse.json({ error: 'Failed to verify access' }, { status: 500 })
  }

  if (!employeeRow) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 403 })
  }

  normalizeRole((employeeRow as { role?: string | null }).role)
  const clientsQuery = setup.serviceClient
    .from('clients')
    .select('id, name, email, handler_id')
    .neq('isdeleted', true)
    .eq('handler_id', user.id)

  const { data: handledClients, error: clientsError } = await clientsQuery

  if (clientsError) {
    return NextResponse.json({ error: clientsError.message || 'Failed to load clients' }, { status: 500 })
  }

  const clientRows = ((handledClients as Array<{ id?: number | null; name?: string | null; email?: string | null; handler_id?: string | null }> | null) ?? [])
    .map((row) => ({
      id: Number(row.id ?? 0),
      name: (row.name || '').trim(),
      email: (row.email || '').trim(),
      handlerId: (row.handler_id || '').trim(),
    }))
    .filter((row) => Number.isFinite(row.id) && row.id > 0)

  if (clientRows.length === 0) {
    return NextResponse.json({ items: [], count: 0 })
  }

  const clientIdList = clientRows.map((client) => client.id)
  const clientById = new Map(clientRows.map((client) => [client.id, client]))

  const { data: unreadMessages, error: unreadError } = await setup.serviceClient
    .from('client_chat_messages')
    .select('id, client_id, message, attachment_name, created_at')
    .in('client_id', clientIdList)
    .eq('isdeleted', false)
    .or('read_by_employee.is.null,read_by_employee.eq.false')
    .neq('sender_auth_id', user.id)
    .order('created_at', { ascending: false })

  if (unreadError) {
    return NextResponse.json({ error: unreadError.message || 'Failed to load message notifications' }, { status: 500 })
  }

  const unreadRows =
    ((unreadMessages as Array<{
      id?: number | null
      client_id?: number | null
      message?: string | null
      attachment_name?: string | null
      created_at?: string | null
    }> | null) ?? [])

  const totalCount = unreadRows.length
  const grouped = new Map<
    number,
    {
      clientId: number
      clientName: string
      clientEmail: string
      handlerId: string
      count: number
      latestMessage: string
      latestMessageId: number
      createdAt: string
    }
  >()

  for (const row of unreadRows) {
    const clientId = Number(row.client_id ?? 0)
    if (!clientId || !clientById.has(clientId)) continue

    const client = clientById.get(clientId)!
    const preview = (row.message || '').trim() || (row.attachment_name ? `Attachment: ${row.attachment_name}` : 'New message')
    const createdAt = row.created_at || ''
    const existing = grouped.get(clientId)

    if (!existing) {
      grouped.set(clientId, {
        clientId,
        clientName: client.name || client.email || 'Client',
        clientEmail: client.email,
        handlerId: client.handlerId,
        count: 1,
        latestMessage: preview,
        latestMessageId: Number(row.id ?? 0),
        createdAt,
      })
      continue
    }

    existing.count += 1
  }

  const items = Array.from(grouped.values()).sort((a, b) => {
    const aTime = Date.parse(a.createdAt || '')
    const bTime = Date.parse(b.createdAt || '')
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0)
  })

  return NextResponse.json({
    items,
    count: totalCount,
  })
}
