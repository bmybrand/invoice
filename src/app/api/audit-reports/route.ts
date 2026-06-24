import { NextResponse } from 'next/server'
import { getBmybrandSupabaseAdmin } from '@/lib/bmybrand-supabase'
import {
  ensureAuditReportsTable,
  getAuditSchemaSetupInstructions,
  isAuditTableMissingError,
} from '@/lib/ensure-audit-schema'
import { requireActiveEmployee } from '@/lib/server-employee-auth'

const AUDIT_LIST_COLUMNS =
  'id, site_url, industry, website_goal, overall_score, issue_count, summary, unlocked, lead_name, lead_email, lead_company, drive_file_id, drive_uploaded_at, created_at'

async function loadAuditReports() {
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

  let result = await supabase
    .from('audit_reports')
    .select(AUDIT_LIST_COLUMNS)
    .order('created_at', { ascending: false })

  if (result.error && isAuditTableMissingError(result.error.message)) {
    if (process.env.BMYB_SUPABASE_DB_PASSWORD?.trim()) {
      try {
        await ensureAuditReportsTable()
        result = await supabase
          .from('audit_reports')
          .select(AUDIT_LIST_COLUMNS)
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
    return {
      error: NextResponse.json(
        { error: result.error.message || 'Failed to load website audits' },
        { status: 500 },
      ),
    }
  }

  return { audits: result.data ?? [] }
}

export async function GET(request: Request) {
  const auth = await requireActiveEmployee(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const loaded = await loadAuditReports()
  if ('error' in loaded && loaded.error) {
    return loaded.error
  }

  return NextResponse.json({ audits: loaded.audits })
}
