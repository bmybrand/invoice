import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/server-superadmin-auth'

function normalizeRole(value: unknown): 'user' | 'admin' {
  return String(value ?? 'user').trim().toLowerCase() === 'admin' ? 'admin' : 'user'
}

export async function POST(request: Request) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const email = String(body?.email ?? '').trim().toLowerCase()
  const password = String(body?.password ?? '').trim()
  const name = String(body?.name ?? '').trim()
  const department = String(body?.department ?? '').trim()
  const role = normalizeRole(body?.role)

  if (!name) {
    return NextResponse.json({ error: 'Employee name is required' }, { status: 400 })
  }

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  if (!password || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 })
  }

  if (!department) {
    return NextResponse.json({ error: 'Department is required' }, { status: 400 })
  }

  const { data: createdUser, error: createError } = await auth.supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: name,
    },
  })

  if (createError || !createdUser.user?.id) {
    return NextResponse.json({ error: createError?.message || 'Failed to create user' }, { status: 500 })
  }

  const { data: employee, error: insertError } = await auth.supabase
    .from('employees')
    .insert({
      auth_id: createdUser.user.id,
      email,
      employee_name: name,
      role,
      department,
      isdeleted: false,
    })
    .select('id, auth_id, employee_name, email, role, department')
    .single()

  if (insertError) {
    await auth.supabase.auth.admin.deleteUser(createdUser.user.id)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ employee }, { status: 201 })
}
