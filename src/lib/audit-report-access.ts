import { NextResponse } from 'next/server'
import { getBmybrandSupabaseAdmin } from '@/lib/bmybrand-supabase'
import {
  ensureAuditReportsTable,
  getAuditSchemaSetupInstructions,
  isAuditTableMissingError,
} from '@/lib/ensure-audit-schema'
import type { AuditReportDetailRow } from '@/types/audit-report'

export async function loadAuditReportById(id: string) {
  const supabase = getBmybrandSupabaseAdmin()
  if (!supabase) {
    return {
      error: NextResponse.json(
        { error: 'Audit database is not configured.' },
        { status: 503 },
      ),
    }
  }

  let result = await supabase.from('audit_reports').select('*').eq('id', id).maybeSingle()

  if (result.error && isAuditTableMissingError(result.error.message)) {
    if (process.env.BMYB_SUPABASE_DB_PASSWORD?.trim()) {
      try {
        await ensureAuditReportsTable()
        result = await supabase.from('audit_reports').select('*').eq('id', id).maybeSingle()
      } catch (setupError) {
        const message =
          setupError instanceof Error
            ? setupError.message
            : getAuditSchemaSetupInstructions()
        return {
          error: NextResponse.json({ error: message }, { status: 503 }),
        }
      }
    } else {
      return {
        error: NextResponse.json(
          { error: getAuditSchemaSetupInstructions() },
          { status: 503 },
        ),
      }
    }
  }

  if (result.error) {
    return {
      error: NextResponse.json(
        { error: result.error.message || 'Failed to load audit report' },
        { status: 500 },
      ),
    }
  }

  if (!result.data) {
    return {
      error: NextResponse.json({ error: 'Audit report not found' }, { status: 404 }),
    }
  }

  return { audit: result.data as AuditReportDetailRow }
}

export function verifyAuditDriveUploadSecret(request: Request) {
  const secret = process.env.AUDIT_DRIVE_UPLOAD_SECRET?.trim()
  if (!secret) {
    return false
  }

  const headerSecret = request.headers.get('x-audit-drive-secret')?.trim()
  return headerSecret === secret
}
