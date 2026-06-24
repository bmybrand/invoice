import { NextResponse } from 'next/server'
import { loadAuditReportById, verifyAuditDriveUploadSecret } from '@/lib/audit-report-access'
import { ensureAuditReportPdfOnDrive } from '@/lib/audit-report-drive'

export const runtime = 'nodejs'
export const maxDuration = 60

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  if (!verifyAuditDriveUploadSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
      { error: 'Audit report must be unlocked before archiving the PDF.' },
      { status: 400 },
    )
  }

  if (!audit.lead_company?.trim()) {
    return NextResponse.json(
      { error: 'Company name is required before archiving the PDF.' },
      { status: 400 },
    )
  }

  try {
    const archived = await ensureAuditReportPdfOnDrive(audit)
    return NextResponse.json({
      ok: true,
      fileId: archived.fileId,
      publicViewUrl: archived.publicViewUrl,
      filename: archived.filename,
      fromDrive: archived.fromDrive,
    })
  } catch (error) {
    console.error('Failed to archive audit PDF to Google Drive', {
      auditId: id,
      detail: error instanceof Error ? error.message : 'Unknown error',
    })

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to archive audit PDF to Google Drive.',
      },
      { status: 500 },
    )
  }
}
