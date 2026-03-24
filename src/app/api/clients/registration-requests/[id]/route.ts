import { NextResponse } from 'next/server'
import { requireAdminOrSuperAdmin } from '@/lib/server-admin-auth'

export async function DELETE(
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
    .select('id, status')
    .eq('id', reqId)
    .single()

  if (fetchError || !reqRow) {
    return NextResponse.json({ error: fetchError?.message || 'Request not found' }, { status: 404 })
  }

  const row = reqRow as { status?: string | null }
  const status = (row.status || '').trim().toLowerCase()

  if (status !== 'rejected') {
    return NextResponse.json({ error: 'Only rejected requests can be deleted' }, { status: 409 })
  }

  const { error: deleteError } = await auth.supabase
    .from('client_registration_requests')
    .delete()
    .eq('id', reqId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
