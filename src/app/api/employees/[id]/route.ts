import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function normalizeRole(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, '')
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
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

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const { data: currentEmployee, error: currentEmployeeError } = await supabase
    .from('employees')
    .select('id, auth_id, role, isdeleted')
    .eq('auth_id', user.id)
    .neq('isdeleted', true)
    .maybeSingle()

  if (currentEmployeeError) {
    return NextResponse.json({ error: 'Failed to verify employee access' }, { status: 500 })
  }

  const { id } = await params
  const employeeId = Number(id)
  if (!Number.isFinite(employeeId) || employeeId <= 0) {
    return NextResponse.json({ error: 'Invalid employee ID' }, { status: 400 })
  }

  const { data: targetEmployee, error: targetEmployeeError } = await supabase
    .from('employees')
    .select('id, auth_id, email, employee_name, role, department, isdeleted')
    .eq('id', employeeId)
    .maybeSingle()

  if (targetEmployeeError) {
    return NextResponse.json({ error: 'Failed to find employee' }, { status: 500 })
  }

  if (!targetEmployee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
  }

  if ((targetEmployee as { isdeleted?: boolean | null }).isdeleted === true) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
  }

  if (targetEmployee.auth_id === user.id) {
    return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 403 })
  }

  const actorRole = normalizeRole((currentEmployee as { role?: string } | null)?.role)
  const targetRole = normalizeRole((targetEmployee as { role?: string } | null)?.role)

  const canDelete =
    actorRole === 'superadmin' ||
    (actorRole === 'admin' && targetRole === 'user')

  if (!canDelete) {
    return NextResponse.json({ error: 'You do not have permission to delete this employee' }, { status: 403 })
  }

  const { error: employeeDeleteError } = await supabase
    .from('employees')
    .update({ isdeleted: true })
    .eq('id', employeeId)

  if (employeeDeleteError) {
    return NextResponse.json({ error: employeeDeleteError.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
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

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const { data: currentEmployee, error: currentEmployeeError } = await supabase
    .from('employees')
    .select('id, auth_id, role, isdeleted')
    .eq('auth_id', user.id)
    .neq('isdeleted', true)
    .maybeSingle()

  if (currentEmployeeError) {
    return NextResponse.json({ error: 'Failed to verify employee access' }, { status: 500 })
  }

  const actorRole = normalizeRole((currentEmployee as { role?: string } | null)?.role)
  if (actorRole !== 'superadmin' && actorRole !== 'admin') {
    return NextResponse.json({ error: 'You do not have permission to manage this employee' }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as { action?: string } | null
  const action = body?.action?.trim().toLowerCase()
  if (action !== 'purge' && action !== 'restore') {
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  }

  const { id } = await params
  const employeeId = Number(id)
  if (!Number.isFinite(employeeId) || employeeId <= 0) {
    return NextResponse.json({ error: 'Invalid employee ID' }, { status: 400 })
  }

  const { data: targetEmployee, error: targetEmployeeError } = await supabase
    .from('employees')
    .select('id, auth_id, email, employee_name, role, department, isdeleted')
    .eq('id', employeeId)
    .maybeSingle()

  if (targetEmployeeError || !targetEmployee) {
    return NextResponse.json({ error: targetEmployeeError?.message || 'Employee not found' }, { status: 404 })
  }

  const row = targetEmployee as {
    id: number
    auth_id: string
    email: string
    employee_name: string
    role: string
    department: string
    isdeleted?: boolean | null
  }

  if (row.auth_id === user.id) {
    return NextResponse.json({ error: 'You cannot manage your own archived account this way' }, { status: 403 })
  }

  const targetRole = normalizeRole(row.role)
  const canManage =
    actorRole === 'superadmin' ||
    (actorRole === 'admin' && targetRole === 'user')

  if (!canManage) {
    return NextResponse.json({ error: 'You do not have permission to manage this employee' }, { status: 403 })
  }

  if (row.isdeleted !== true) {
    return NextResponse.json(
      { error: `Only archived employees can be ${action === 'restore' ? 'restored' : 'permanently deleted'}` },
      { status: 409 }
    )
  }

  if (action === 'restore') {
    const { error: restoreError } = await supabase
      .from('employees')
      .update({ isdeleted: false })
      .eq('id', employeeId)

    if (restoreError) {
      return NextResponse.json({ error: restoreError.message || 'Failed to restore employee' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  }

  const { count: invoiceCount, error: invoiceCountError } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('invoice_creator_id', employeeId)

  if (invoiceCountError) {
    return NextResponse.json(
      { error: invoiceCountError.message || 'Failed to validate employee invoices' },
      { status: 500 }
    )
  }

  if ((invoiceCount ?? 0) > 0) {
    return NextResponse.json(
      { error: 'This employee cannot be deleted forever because invoices are still linked to this employee.' },
      { status: 409 }
    )
  }

  // Delete auth user first
  const { error: authDeleteError } = await supabase.auth.admin.deleteUser(row.auth_id)
  if (authDeleteError) {
    return NextResponse.json(
      { error: `Auth user deletion failed: ${authDeleteError.message}` },
      { status: 500 }
    )
  }

  // Only delete employee row if auth deletion succeeded
  const { error: deleteError } = await supabase
    .from('employees')
    .delete()
    .eq('id', employeeId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message || 'Failed to permanently delete employee' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
