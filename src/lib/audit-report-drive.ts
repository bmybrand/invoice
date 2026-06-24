import {
  buildAuditReportFilename,
  buildAuditReportPdf,
} from '@/lib/audit-report-pdf'
import { getBmybrandSupabaseAdmin } from '@/lib/bmybrand-supabase'
import {
  getDriveFileMedia,
  getDrivePublicViewUrl,
  uploadToDrive,
  type DriveUploadResult,
} from '@/lib/server-google-drive'
import type { AuditReportDetailRow } from '@/types/audit-report'

function sanitizeDriveFolderName(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').trim() || 'audit-reports'
}

export async function persistAuditDriveFileId(auditId: string, fileId: string) {
  const supabase = getBmybrandSupabaseAdmin()
  if (!supabase) {
    throw new Error('Audit database is not configured.')
  }

  const { error } = await supabase
    .from('audit_reports')
    .update({
      drive_file_id: fileId,
      drive_uploaded_at: new Date().toISOString(),
    })
    .eq('id', auditId)

  if (error) {
    throw new Error(error.message || 'Failed to save Google Drive file ID.')
  }
}

export async function uploadAuditReportPdfToDrive(
  audit: AuditReportDetailRow,
): Promise<DriveUploadResult & { pdfBytes: Uint8Array; filename: string }> {
  if (!audit.lead_company?.trim()) {
    throw new Error('Company name is required before uploading the audit PDF.')
  }

  const { pdfBytes, filename } = await buildAuditReportPdf(audit)
  const folderName = sanitizeDriveFolderName(audit.lead_company)
  const file = new File([Buffer.from(pdfBytes)], filename, { type: 'application/pdf' })
  const upload = await uploadToDrive(file, folderName)

  return {
    ...upload,
    pdfBytes,
    filename,
  }
}

export type AuditReportDriveArchive = {
  fileId: string
  publicViewUrl: string
  filename: string
  pdfBytes: Uint8Array
  fromDrive: boolean
}

export async function ensureAuditReportPdfOnDrive(
  audit: AuditReportDetailRow,
): Promise<AuditReportDriveArchive> {
  const filename = buildAuditReportFilename(audit)

  if (audit.drive_file_id) {
    try {
      const media = await getDriveFileMedia(audit.drive_file_id)
      return {
        fileId: audit.drive_file_id,
        publicViewUrl: getDrivePublicViewUrl(audit.drive_file_id),
        filename,
        pdfBytes: new Uint8Array(media.body),
        fromDrive: true,
      }
    } catch (error) {
      console.warn('Stored Google Drive file missing, re-uploading audit PDF', {
        auditId: audit.id,
        driveFileId: audit.drive_file_id,
        detail: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const upload = await uploadAuditReportPdfToDrive(audit)
  await persistAuditDriveFileId(audit.id, upload.fileId)

  return {
    fileId: upload.fileId,
    publicViewUrl: upload.publicViewUrl,
    filename: upload.filename,
    pdfBytes: upload.pdfBytes,
    fromDrive: false,
  }
}
