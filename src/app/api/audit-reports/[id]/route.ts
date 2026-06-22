import { NextResponse } from 'next/server'
import { getBmybrandSupabaseAdmin } from '@/lib/bmybrand-supabase'
import { requireActiveEmployee } from '@/lib/server-employee-auth'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireActiveEmployee(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: 'Missing audit ID' }, { status: 400 })
  }

  const supabase = getBmybrandSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json(
      { error: 'Audit database is not configured.' },
      { status: 503 },
    )
  }

  const { data, error } = await supabase
    .from('audit_reports')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to load audit report' },
      { status: 500 },
    )
  }

  if (!data) {
    return NextResponse.json({ error: 'Audit report not found' }, { status: 404 })
  }

  return NextResponse.json({ audit: data })
}
