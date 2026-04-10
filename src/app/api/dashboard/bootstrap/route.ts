import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

type BootstrapState =
  | 'employee'
  | 'client'
  | 'pending'
  | 'rejected'
  | 'deleted'
  | 'approved_stale'
  | 'none'

function normalizeStatus(value: string | null | undefined) {
  return (value || '').trim().toLowerCase()
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

  const [{ data: employeeRows, error: employeeError }, { data: clientRows, error: clientError }] = await Promise.all([
    setup.serviceClient
      .from('employees')
      .select('id, employee_name, role, department, avatar_url, isdeleted')
      .eq('auth_id', user.id)
      .limit(4),
    setup.serviceClient
      .from('clients')
      .select('id, name, email, handler_id, status, isdeleted, created_date')
      .or(
        [user.id ? `auth_id.eq.${user.id}` : '', user.email ? `email.eq.${user.email}` : '']
          .filter(Boolean)
          .join(',')
      )
      .order('created_date', { ascending: false })
      .limit(12),
  ])

  if (employeeError) {
    return NextResponse.json({ error: employeeError.message || 'Failed to load employee profile' }, { status: 500 })
  }

  if (clientError) {
    return NextResponse.json({ error: clientError.message || 'Failed to load client profile' }, { status: 500 })
  }

  const employeeList =
    ((employeeRows as Array<{
      id?: number | null
      employee_name?: string | null
      role?: string | null
      department?: string | null
      avatar_url?: string | null
      isdeleted?: boolean | null
    }> | null) ?? [])

  const activeEmployee = employeeList.find((row) => row.isdeleted !== true)
  if (activeEmployee) {
    return NextResponse.json({
      state: 'employee' satisfies BootstrapState,
      employee: {
        id: Number(activeEmployee.id ?? 0),
        employeeName: (activeEmployee.employee_name || '').trim(),
        role: (activeEmployee.role || '').trim(),
        department: (activeEmployee.department || '').trim(),
        avatarUrl: (activeEmployee.avatar_url || '').trim(),
      },
    })
  }

  if (employeeList.some((row) => row.isdeleted === true)) {
    return NextResponse.json({ state: 'deleted' satisfies BootstrapState })
  }

  const clientList =
    ((clientRows as Array<{
      id?: number | null
      name?: string | null
      email?: string | null
      handler_id?: string | null
      status?: string | null
      isdeleted?: boolean | null
      created_date?: string | null
    }> | null) ?? [])

  const activeApprovedClient = clientList.find(
    (row) => row.isdeleted !== true && normalizeStatus(row.status) === 'approved'
  )

  if (activeApprovedClient) {
    return NextResponse.json({
      state: 'client' satisfies BootstrapState,
      client: {
        id: Number(activeApprovedClient.id ?? 0),
        name: (activeApprovedClient.name || '').trim(),
        email: (activeApprovedClient.email || '').trim(),
        handlerId: (activeApprovedClient.handler_id || '').trim(),
      },
    })
  }

  const latestNonDeletedClient = clientList.find((row) => row.isdeleted !== true)
  const latestStatus = normalizeStatus(latestNonDeletedClient?.status)

  if (latestStatus === 'pending') {
    return NextResponse.json({ state: 'pending' satisfies BootstrapState })
  }

  if (latestStatus === 'approved') {
    return NextResponse.json({ state: 'approved_stale' satisfies BootstrapState })
  }

  if (latestStatus === 'rejected') {
    return NextResponse.json({ state: 'rejected' satisfies BootstrapState })
  }

  if (clientList.some((row) => row.isdeleted === true)) {
    return NextResponse.json({ state: 'deleted' satisfies BootstrapState })
  }

  return NextResponse.json({ state: 'none' satisfies BootstrapState })
}
