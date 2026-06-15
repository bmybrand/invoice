import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/server-superadmin-auth'

type RouteParams = { id: string }

export async function DELETE(
  request: Request,
  { params }: { params: RouteParams | Promise<RouteParams> }
) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const resolvedParams = params instanceof Promise ? await params : params
  const leadId = resolvedParams.id ? Number.parseInt(resolvedParams.id, 10) : NaN
  if (!Number.isFinite(leadId) || leadId < 1) {
    return NextResponse.json({ error: 'Invalid lead ID' }, { status: 400 })
  }

  const { data: lead, error: fetchError } = await auth.supabase
    .from('leads')
    .select('id')
    .eq('id', leadId)
    .single()

  if (fetchError || !lead) {
    return NextResponse.json({ error: fetchError?.message || 'Lead not found' }, { status: 404 })
  }

  const { error } = await auth.supabase
    .from('leads')
    .delete()
    .eq('id', leadId)

  if (error) {
    return NextResponse.json({ error: error.message || 'Failed to delete lead' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
