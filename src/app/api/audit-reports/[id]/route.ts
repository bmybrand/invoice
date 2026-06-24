import { NextResponse } from 'next/server'
import { loadAuditReportById } from '@/lib/audit-report-access'
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

  const loaded = await loadAuditReportById(id)
  if ('error' in loaded && loaded.error) {
    return loaded.error
  }

  return NextResponse.json({ audit: loaded.audit })
}
