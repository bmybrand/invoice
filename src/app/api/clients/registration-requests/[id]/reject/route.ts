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

  const { error } = await auth.supabase
    .from('client_registration_requests')
    .update({ status: 'rejected' })
    .eq('id', reqId)
    .eq('status', 'pending')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
