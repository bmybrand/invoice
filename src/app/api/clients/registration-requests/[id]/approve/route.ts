import { NextResponse } from 'next/server'
import { requireAdminOrSuperAdmin } from '@/lib/server-admin-auth'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminOrSuperAdmin(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const reqId = id ? parseInt(id, 10) : NaN
  if (!Number.isFinite(reqId)) {
    return NextResponse.json({ error: 'Invalid request ID' }, { status: 400 })
  }

  const { data: reqRow, error: fetchError } = await auth.supabase
    .from('client_registration_requests')
    .select('id, name, email, brand_id, auth_id')
    .eq('id', reqId)
    .eq('status', 'pending')
    .single()

  if (fetchError || !reqRow) {
    return NextResponse.json(
      { error: fetchError?.message || 'Request not found or already processed' },
      { status: 404 }
    )
  }

  const row = reqRow as { name: string; email: string; brand_id: number; auth_id: string }

  const { error: insertError } = await auth.supabase.from('clients').insert({
    name: row.name,
    email: row.email,
    brand_id: row.brand_id,
    handler_id: row.auth_id,
  })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  const { error: updateError } = await auth.supabase
    .from('client_registration_requests')
    .update({ status: 'approved' })
    .eq('id', reqId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
