import { NextResponse } from 'next/server'
import {
  ensureAuditReportsTable,
  getAuditSchemaSetupInstructions,
} from '@/lib/ensure-audit-schema'

export async function POST(request: Request) {
  const setupSecret = process.env.GOOGLE_OAUTH_SETUP_SECRET?.trim()
  const providedSecret = request.headers.get('x-setup-secret')?.trim()

  if (!setupSecret || providedSecret !== setupSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.BMYB_SUPABASE_DB_PASSWORD?.trim()) {
    return NextResponse.json(
      {
        error:
          'Missing BMYB_SUPABASE_DB_PASSWORD. Add your website Supabase database password to invoice/.env.local first.',
      },
      { status: 400 },
    )
  }

  try {
    await ensureAuditReportsTable()
    return NextResponse.json({ ok: true, message: 'audit_reports table is ready.' })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : getAuditSchemaSetupInstructions(),
      },
      { status: 500 },
    )
  }
}
