import { NextResponse } from 'next/server'
import { requireAdminOrSuperAdmin } from '@/lib/server-admin-auth'

export async function POST(request: Request) {
  const auth = await requireAdminOrSuperAdmin(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const email = String(body?.email ?? '').trim().toLowerCase()
  const password = String(body?.password ?? '').trim()
  const name = String(body?.name ?? '').trim()
  const phone = String(body?.phone ?? '').trim()
  const handlerId = String(body?.handlerId ?? body?.agentAuthId ?? '').trim() || null

  if (!name) {
    return NextResponse.json({ error: 'Client name is required' }, { status: 400 })
  }

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 })
  }

  if (!handlerId) {
    return NextResponse.json({ error: 'Handler is required' }, { status: 400 })
  }

  const { data: handler, error: handlerError } = await auth.supabase
    .from('employees')
    .select('auth_id, department')
    .eq('auth_id', handlerId)
    .neq('isdeleted', true)
    .maybeSingle()

  if (handlerError) {
    return NextResponse.json({ error: handlerError.message || 'Failed to validate handler' }, { status: 500 })
  }

  const handlerDepartment = String((handler as { department?: string | null } | null)?.department ?? '')
    .trim()
    .toLowerCase()

  if (!handler || !handlerDepartment.includes('sales')) {
    return NextResponse.json({ error: 'Only sales employees can be assigned as client handlers' }, { status: 400 })
  }

  const { data: createdUser, error: createError } = await auth.supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: name,
      phone,
    },
  })

  if (createError || !createdUser.user?.id) {
    return NextResponse.json({ error: createError?.message || 'Failed to create user' }, { status: 500 })
  }

  const { data: client, error: insertError } = await auth.supabase
    .from('clients')
    .insert({
      name,
      email,
      phone,
      handler_id: handlerId,
      auth_id: createdUser.user.id,
      status: 'approved',
      isdeleted: false,
    })
    .select('id, name, email, status')
    .single()

  if (insertError) {
    await auth.supabase.auth.admin.deleteUser(createdUser.user.id)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ client }, { status: 201 })
}
