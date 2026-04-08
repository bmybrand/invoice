import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY

  if (!supabaseUrl || !publishableKey) {
    return NextResponse.json({ error: 'Server not configured for password verification' }, { status: 503 })
  }

  const { data: employee, error: employeeError } = await auth.supabase
    .from('employees')
    .select('auth_id, email')
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

  const employeeEmail = (employee as { email?: string | null } | null)?.email?.trim().toLowerCase() || ''
  if (!employeeEmail) {
    return NextResponse.json({ error: 'Employee email is missing, cannot verify password update' }, { status: 500 })
  }

  const verificationClient = createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const { error: verificationError } = await verificationClient.auth.signInWithPassword({
    email: employeeEmail,
    password,
  })

  if (verificationError) {
    return NextResponse.json(
      { error: `Password update could not be verified: ${verificationError.message}` },
      { status: 500 }
    )
  }

  await verificationClient.auth.signOut({ scope: 'local' }).catch(() => {})

  return NextResponse.json({ ok: true })
}
