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
  const brandId = body?.brand_id != null ? Number(body.brand_id) : NaN

  if (!name) {
    return NextResponse.json({ error: 'Client name is required' }, { status: 400 })
  }

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 })
  }

  if (!Number.isFinite(brandId) || brandId < 1) {
    return NextResponse.json({ error: 'Valid brand is required' }, { status: 400 })
  }

  const { data: createdUser, error: createError } = await auth.supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: name,
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
      brand_id: brandId,
      handler_id: createdUser.user.id,
    })
    .select('id, name, email, brand_id')
    .single()

  if (insertError) {
    await auth.supabase.auth.admin.deleteUser(createdUser.user.id)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ client }, { status: 201 })
}
