import { NextResponse } from 'next/server'
import { requireAdminOrSuperAdmin } from '@/lib/server-admin-auth'

type RouteParams = { id: string }

export async function POST(
  request: Request,
  { params }: { params: RouteParams | Promise<RouteParams> }
) {
  const auth = await requireAdminOrSuperAdmin(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const resolvedParams = params instanceof Promise ? await params : params
  const requestId = resolvedParams.id ? parseInt(resolvedParams.id, 10) : NaN
  if (!Number.isFinite(requestId) || requestId < 1) {
    return NextResponse.json({ error: 'Invalid request ID' }, { status: 400 })
  }

  const { data: row, error: fetchError } = await auth.supabase
    .from('clients')
    .select('id, status, isdeleted')
    .eq('id', requestId)
    .single()

  if (fetchError || !row || (row as { isdeleted?: boolean | null }).isdeleted === true) {
    return NextResponse.json({ error: fetchError?.message || 'Request not found' }, { status: 404 })
  }

  const { error: updateError } = await auth.supabase
    .from('clients')
    .update({ status: 'approved', isdeleted: false })
    .eq('id', requestId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
