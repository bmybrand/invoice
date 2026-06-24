import { NextResponse } from 'next/server'
import { getBmybrandSupabaseAdmin } from '@/lib/bmybrand-supabase'
import {
  ensureAuditReportsTable,
  getAuditSchemaSetupInstructions,
  isAuditTableMissingError,
} from '@/lib/ensure-audit-schema'
import { requireActiveEmployee } from '@/lib/server-employee-auth'

const AUDIT_LIST_COLUMNS =
  'id, site_url, industry, website_goal, overall_score, issue_count, summary, unlocked, lead_name, lead_email, lead_company, drive_file_id, drive_uploaded_at, isdeleted, archived_at, created_at'

async function loadAuditReports(archived: boolean) {
  const supabase = getBmybrandSupabaseAdmin()
  if (!supabase) {
    return {
      error: NextResponse.json(
        {
          error:
            'Audit database is not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to invoice/.env.local.',
        },
        { status: 503 },
      ),
    }
  }

  let query = supabase
    .from('audit_reports')
    .select(AUDIT_LIST_COLUMNS)
    .eq('isdeleted', archived)
    .order('created_at', { ascending: false })

  let result = await query

  if (result.error && isAuditTableMissingError(result.error.message)) {
    if (process.env.BMYB_SUPABASE_DB_PASSWORD?.trim()) {
      try {
        await ensureAuditReportsTable()
        result = await supabase
          .from('audit_reports')
          .select(AUDIT_LIST_COLUMNS)
          .eq('isdeleted', archived)
          .order('created_at', { ascending: false })
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
    const message = result.error.message || 'Failed to load website audits'
    const missingArchiveColumn =
      message.includes('isdeleted') &&
      (message.includes('does not exist') || message.includes('schema cache'))

    if (!archived && missingArchiveColumn) {
      const fallback = await supabase
        .from('audit_reports')
        .select(AUDIT_LIST_COLUMNS.replace(', isdeleted, archived_at', ''))
        .order('created_at', { ascending: false })

      if (fallback.error) {
        return {
          error: NextResponse.json({ error: message }, { status: 500 }),
        }
      }

      const audits = (fallback.data ?? []).map((row) => ({
        ...row,
        isdeleted: false,
        archived_at: null,
      }))
      return { audits }
    }

    return {
      error: NextResponse.json({ error: message }, { status: 500 }),
    }
  }

  return { audits: result.data ?? [] }
}

export async function GET(request: Request) {
  const auth = await requireActiveEmployee(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const archived = url.searchParams.get('archived') === 'true'

  const loaded = await loadAuditReports(archived)
  if ('error' in loaded && loaded.error) {
    return loaded.error
  }

  return NextResponse.json({ audits: loaded.audits })
}
