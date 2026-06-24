import { NextResponse } from 'next/server'
import { loadAuditReportById, verifyAuditDriveUploadSecret } from '@/lib/audit-report-access'
import { ensureAuditReportPdfOnDrive } from '@/lib/audit-report-drive'
import { requireActiveEmployee } from '@/lib/server-employee-auth'

export const runtime = 'nodejs'
export const maxDuration = 60

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

  const audit = loaded.audit
  if (!audit.unlocked) {
    return NextResponse.json(
      { error: 'Audit report must be unlocked before downloading the PDF.' },
      { status: 400 },
    )
  }

  if (!audit.lead_company?.trim()) {
    return NextResponse.json(
      { error: 'Company name is required before generating the PDF.' },
      { status: 400 },
    )
  }

  try {
    const archived = await ensureAuditReportPdfOnDrive(audit)
    return new NextResponse(Buffer.from(archived.pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${archived.filename}"`,
        'Cache-Control': 'private, no-store',
        'X-Drive-File-Id': archived.fileId,
      },
    })
  } catch (error) {
    console.error('Failed to download audit PDF', {
      auditId: id,
      detail: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to generate or download audit PDF.',
      },
      { status: 500 },
    )
  }
}
