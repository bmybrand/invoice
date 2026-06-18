import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function normalizeRole(value: string | null | undefined) {
  return (value || '').trim().toLowerCase().replace(/\s+/g, '')
}

export async function GET(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()

  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return NextResponse.json({ error: 'Server is not configured for invoice access' }, { status: 503 })
  }

  if (!token) {
    return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 })
  }

  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser(token)

  if (userError || !user) {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
  }

  const [{ data: employee, error: employeeError }, { data: clientRows, error: clientError }] = await Promise.all([
    serviceClient
      .from('employees')
      .select('id, role')
      .eq('auth_id', user.id)
      .neq('isdeleted', true)
      .maybeSingle(),
    serviceClient
      .from('clients')
      .select('id, status, isdeleted, created_date')
      .or(
        [user.id ? `auth_id.eq.${user.id}` : '', user.email ? `email.eq.${user.email}` : '']
          .filter(Boolean)
          .join(',')
      )
      .order('created_date', { ascending: false })
      .limit(12),
  ])

  if (employeeError || clientError) {
    return NextResponse.json(
      { error: employeeError?.message || clientError?.message || 'Failed to verify invoice access' },
      { status: 500 }
    )
  }

  const employeeRow = employee as { id?: number | null; role?: string | null } | null
  const role = normalizeRole(employeeRow?.role)
  const canViewAll = role === 'admin' || role === 'superadmin'
  const clientRow = ((clientRows as Array<{
    id?: number | null
    status?: string | null
    isdeleted?: boolean | null
  }> | null) ?? []).find(
    (row) => row.isdeleted !== true && (row.status || '').trim().toLowerCase() === 'approved'
  )

  if (!employeeRow && !clientRow) {
    return NextResponse.json({ error: 'You do not have permission to view invoices' }, { status: 403 })
  }

  const requestedClientId = Number(new URL(request.url).searchParams.get('clientId'))
  const invoiceSelectWithBrandIdAndCurrency = `
    id, invoice_date, invoice_creator_id, client_id, brand_id, client_name, brand_name, email, service, phone, amount, status, payable_amount, invoice_type, currency, created_at,
    employees!invoice_creator_id(employee_name),
    clients!client_id(name)
  `
  const invoiceSelectWithBrandId = `
    id, invoice_date, invoice_creator_id, client_id, brand_id, client_name, brand_name, email, service, phone, amount, status, payable_amount, invoice_type, created_at,
    employees!invoice_creator_id(employee_name),
    clients!client_id(name)
  `
  const invoiceSelectWithCurrency = `
    id, invoice_date, invoice_creator_id, client_id, client_name, brand_name, email, service, phone, amount, status, payable_amount, invoice_type, currency, created_at,
    employees!invoice_creator_id(employee_name),
    clients!client_id(name)
  `
  const invoiceSelectLegacy = `
    id, invoice_date, invoice_creator_id, client_id, client_name, brand_name, email, service, phone, amount, status, payable_amount, invoice_type, created_at,
    employees!invoice_creator_id(employee_name),
    clients!client_id(name)
  `

  const applyAccessFilter = <T,>(query: T) => {
    let filtered = query as T & { eq: (column: string, value: unknown) => typeof filtered }
    if (clientRow?.id) {
      filtered = filtered.eq('client_id', clientRow.id)
    } else if (canViewAll && Number.isFinite(requestedClientId) && requestedClientId > 0) {
      filtered = filtered.eq('client_id', requestedClientId)
    } else if (!canViewAll && employeeRow?.id) {
      filtered = filtered.eq('invoice_creator_id', employeeRow.id)
    }
    return filtered
  }

  const firstResult = await applyAccessFilter(
    serviceClient.from('invoices').select(invoiceSelectWithBrandIdAndCurrency).order('created_at', { ascending: false })
  )
  let data = firstResult.data as Record<string, unknown>[] | null
  let error = firstResult.error as { message: string } | null

  if (error && error.message.toLowerCase().includes('brand_id') && error.message.toLowerCase().includes('does not exist')) {
    const currencyResult = await applyAccessFilter(
      serviceClient.from('invoices').select(invoiceSelectWithCurrency).order('created_at', { ascending: false })
    )
    data = currencyResult.data as Record<string, unknown>[] | null
    error = currencyResult.error as { message: string } | null
  }

  if (error && error.message.toLowerCase().includes('currency') && error.message.toLowerCase().includes('does not exist')) {
    const brandResult = await applyAccessFilter(
      serviceClient.from('invoices').select(invoiceSelectWithBrandId).order('created_at', { ascending: false })
    )
    data = brandResult.data as Record<string, unknown>[] | null
    error = brandResult.error as { message: string } | null
  }

  if (
    error &&
    (error.message.toLowerCase().includes('brand_id') || error.message.toLowerCase().includes('currency')) &&
    error.message.toLowerCase().includes('does not exist')
  ) {
    const legacyResult = await applyAccessFilter(
      serviceClient.from('invoices').select(invoiceSelectLegacy).order('created_at', { ascending: false })
    )
    data = legacyResult.data as Record<string, unknown>[] | null
    error = legacyResult.error as { message: string } | null
  }

  if (error) {
    return NextResponse.json({ error: error.message || 'Failed to load invoices' }, { status: 500 })
  }

  return NextResponse.json({ invoices: data ?? [] })
}
