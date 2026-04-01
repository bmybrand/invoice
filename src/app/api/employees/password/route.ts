import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/server-superadmin-auth'

export async function POST(request: Request) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => null)
  const authId =
    typeof body?.authId === 'string' ? body.authId.trim() : ''
  const password =
    typeof body?.password === 'string' ? body.password : ''

  if (!authId) {
    return NextResponse.json({ error: 'Employee auth ID is required' }, { status: 400 })
  }

  if (password.trim().length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 })
  }

  const { data: employee, error: employeeError } = await auth.supabase
    .from('employees')
    .select('auth_id')
    .eq('auth_id', authId)
    .neq('isdeleted', true)
    .maybeSingle()

  if (employeeError) {
    return NextResponse.json({ error: 'Failed to verify employee record' }, { status: 500 })
  }

  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
  }

  const { error } = await auth.supabase.auth.admin.updateUserById(authId, {
    password,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
