import { NextResponse } from 'next/server'
import { requireAdminOrSuperAdmin } from '@/lib/server-admin-auth'

type ClientRequestRow = {
  id: number
  name: string
  email: string
  handler_id: string | null
  status: string | null
  created_date: string | null
}

export async function GET(request: Request) {
  const auth = await requireAdminOrSuperAdmin(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const scope = (searchParams.get('scope') || '').trim().toLowerCase()
  const includeAllStatuses = scope === 'all'

  let query = auth.supabase
    .from('clients')
    .select('id, name, email, handler_id, status, created_date, isdeleted')
    .neq('isdeleted', true)
    .order('created_date', { ascending: false })

  if (!includeAllStatuses) {
    query = query.eq('status', 'pending')
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const requests = ((data as ClientRequestRow[] | null) ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    auth_id: row.handler_id,
    status: (row.status || '').trim().toLowerCase(),
    created_at: row.created_date,
  }))

  return NextResponse.json({ requests })
}
