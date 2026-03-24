import { NextResponse } from 'next/server'
import { requireAdminOrSuperAdmin } from '@/lib/server-admin-auth'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminOrSuperAdmin(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const clientId = id ? parseInt(id, 10) : NaN
  if (!Number.isFinite(clientId) || clientId < 1) {
    return NextResponse.json({ error: 'Invalid client ID' }, { status: 400 })
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const name = body?.name != null ? String(body.name).trim() : null
  const email = body?.email != null ? String(body.email).trim().toLowerCase() : null
  const brandId = body?.brand_id != null ? Number(body.brand_id) : NaN
  const password = typeof body?.password === 'string' ? body.password.trim() : ''

  if (password.length > 0 && password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 })
  }

  const { data: client, error: fetchError } = await auth.supabase
    .from('clients')
    .select('id, name, email, brand_id, handler_id')
    .eq('id', clientId)
    .eq('status', true)
    .single()

  if (fetchError || !client) {
    return NextResponse.json({ error: fetchError?.message || 'Client not found' }, { status: 404 })
  }

  const row = client as { name: string; email: string; brand_id: number; handler_id: string }
  const updates: Record<string, unknown> = {}

  if (name !== null) updates.name = name
  if (email !== null) updates.email = email
  if (Number.isFinite(brandId) && brandId > 0) updates.brand_id = brandId

  if (Object.keys(updates).length === 0 && !password) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await auth.supabase
      .from('clients')
      .update(updates)
      .eq('id', clientId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }
  }

  if (row.handler_id) {
    const authUpdates: { email?: string; password?: string } = {}
    if (email !== null && email !== row.email) authUpdates.email = email
    if (password) authUpdates.password = password

    if (Object.keys(authUpdates).length > 0) {
      const { error: authError } = await auth.supabase.auth.admin.updateUserById(row.handler_id, authUpdates)
      if (authError) {
        return NextResponse.json({ error: `Client updated but auth sync failed: ${authError.message}` }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminOrSuperAdmin(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const clientId = id ? parseInt(id, 10) : NaN
  if (!Number.isFinite(clientId) || clientId < 1) {
    return NextResponse.json({ error: 'Invalid client ID' }, { status: 400 })
  }

  const { data: client, error: fetchError } = await auth.supabase
    .from('clients')
    .select('id, name, email, brand_id, handler_id')
    .eq('id', clientId)
    .eq('status', true)
    .single()

  if (fetchError || !client) {
    return NextResponse.json({ error: fetchError?.message || 'Client not found' }, { status: 404 })
  }

  const { error: deleteError } = await auth.supabase
    .from('clients')
    .update({ status: false })
    .eq('id', clientId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
