import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdminOrSuperAdmin } from '@/lib/server-admin-auth'

type RouteParams = { id: string }

export async function PATCH(
  request: Request,
  { params }: { params: RouteParams | Promise<RouteParams> }
) {
  const auth = await requireAdminOrSuperAdmin(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const resolvedParams = params instanceof Promise ? await params : params
  const clientId = resolvedParams.id ? parseInt(resolvedParams.id, 10) : NaN
  if (!Number.isFinite(clientId) || clientId < 1) {
    return NextResponse.json({ error: 'Invalid client ID' }, { status: 400 })
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const name = body?.name != null ? String(body.name).trim() : null
  const email = body?.email != null ? String(body.email).trim().toLowerCase() : null
  const password = typeof body?.password === 'string' ? body.password.trim() : ''
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY

  if (password.length > 0 && password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 })
  }

  if (!supabaseUrl || !publishableKey) {
    return NextResponse.json({ error: 'Server not configured for auth verification' }, { status: 503 })
  }

  const { data: client, error: fetchError } = await auth.supabase
    .from('clients')
    .select('id, name, email, auth_id, handler_id, isdeleted')
    .eq('id', clientId)
    .single()

  if (fetchError || !client || (client as { isdeleted?: boolean | null }).isdeleted === true) {
    return NextResponse.json({ error: fetchError?.message || 'Client not found' }, { status: 404 })
  }

  const row = client as { name: string; email: string; auth_id?: string | null; handler_id?: string | null }
  const updates: Record<string, unknown> = {}

  if (name !== null) updates.name = name
  if (email !== null) updates.email = email

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

  const clientAuthId = (row.auth_id || '').trim()

  if (clientAuthId) {
    const authUpdates: { email?: string; password?: string } = {}
    if (email !== null && email !== row.email) authUpdates.email = email
    if (password) authUpdates.password = password

    if (Object.keys(authUpdates).length > 0) {
      const { error: authError } = await auth.supabase.auth.admin.updateUserById(clientAuthId, authUpdates)
      if (authError) {
        return NextResponse.json({ error: `Client updated but auth sync failed: ${authError.message}` }, { status: 500 })
      }

      if (password) {
        const verificationClient = createClient(supabaseUrl, publishableKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        })

        const verifyEmail = (email ?? row.email ?? '').trim().toLowerCase()
        const { error: verificationError } = await verificationClient.auth.signInWithPassword({
          email: verifyEmail,
          password,
        })

        if (verificationError) {
          return NextResponse.json(
            { error: `Client updated but password verification failed: ${verificationError.message}` },
            { status: 500 }
          )
        }

        await verificationClient.auth.signOut({ scope: 'local' }).catch(() => {})
      }
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  request: Request,
  { params }: { params: RouteParams | Promise<RouteParams> }
) {
  const auth = await requireAdminOrSuperAdmin(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const resolvedParams = params instanceof Promise ? await params : params
  const clientId = resolvedParams.id ? parseInt(resolvedParams.id, 10) : NaN
  if (!Number.isFinite(clientId) || clientId < 1) {
    return NextResponse.json({ error: 'Invalid client ID' }, { status: 400 })
  }

  const { data: client, error: fetchError } = await auth.supabase
    .from('clients')
    .select('id, isdeleted')
    .eq('id', clientId)
    .single()

  if (fetchError || !client || (client as { isdeleted?: boolean | null }).isdeleted === true) {
    return NextResponse.json({ error: fetchError?.message || 'Client not found' }, { status: 404 })
  }

  const { error: deleteError } = await auth.supabase
    .from('clients')
    .update({ isdeleted: true })
    .eq('id', clientId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function POST(
  request: Request,
  { params }: { params: RouteParams | Promise<RouteParams> }
) {
  const auth = await requireAdminOrSuperAdmin(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const resolvedParams = params instanceof Promise ? await params : params
  const clientId = resolvedParams.id ? parseInt(resolvedParams.id, 10) : NaN
  if (!Number.isFinite(clientId) || clientId < 1) {
    return NextResponse.json({ error: 'Invalid client ID' }, { status: 400 })
  }

  const body = (await request.json().catch(() => null)) as { action?: string } | null
  const action = body?.action?.trim().toLowerCase()
  if (action !== 'purge' && action !== 'restore') {
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  }

  const { data: client, error: fetchError } = await auth.supabase
    .from('clients')
    .select('id, name, email, auth_id, handler_id, isdeleted')
    .eq('id', clientId)
    .single()

  if (fetchError || !client) {
    return NextResponse.json({ error: fetchError?.message || 'Client not found' }, { status: 404 })
  }

  const row = client as {
    id: number
    name?: string | null
    email?: string | null
    auth_id?: string | null
    handler_id?: string | null
    isdeleted?: boolean | null
  }

  if (row.isdeleted !== true) {
    return NextResponse.json(
      { error: `Only archived clients can be ${action === 'restore' ? 'restored' : 'permanently deleted'}` },
      { status: 409 }
    )
  }

  if (action === 'restore') {
    const { error: restoreError } = await auth.supabase
      .from('clients')
      .update({ isdeleted: false })
      .eq('id', clientId)

    if (restoreError) {
      return NextResponse.json(
        { error: restoreError.message || 'Failed to restore client' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  }

  const { count: invoiceCount, error: invoiceCountError } = await auth.supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)

  if (invoiceCountError) {
    return NextResponse.json(
      { error: invoiceCountError.message || 'Failed to validate client invoices' },
      { status: 500 }
    )
  }

  if ((invoiceCount ?? 0) > 0) {
    return NextResponse.json(
      { error: 'This client cannot be deleted forever because invoices are still linked to this client.' },
      { status: 409 }
    )
  }

  const { error: deleteError } = await auth.supabase
    .from('clients')
    .delete()
    .eq('id', clientId)

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message || 'Failed to permanently delete client' },
      { status: 500 }
    )
  }

  const clientAuthId = (row.auth_id || '').trim()

  if (clientAuthId) {
    const { error: authDeleteError } = await auth.supabase.auth.admin.deleteUser(clientAuthId)
    if (authDeleteError) {
      return NextResponse.json(
        { error: `Client row deleted but auth cleanup failed: ${authDeleteError.message}` },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({ ok: true })
}
