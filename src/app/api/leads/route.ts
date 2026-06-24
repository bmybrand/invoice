import { NextResponse } from 'next/server'
import { requireActiveEmployee } from '@/lib/server-employee-auth'

export async function GET(request: Request) {
  const auth = await requireActiveEmployee(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { data, error } = await auth.supabase
    .from('leads')
    .select('id, created_at, access_page, first_name, last_name, email, phone, service, message, form_type, company')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message || 'Failed to load leads' }, { status: 500 })
  }

  return NextResponse.json({ leads: data ?? [] })
}
