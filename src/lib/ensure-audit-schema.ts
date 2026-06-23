import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { getBmybrandSupabaseProjectRef } from '@/lib/bmybrand-supabase'

const MIGRATION_FILE = join(
  process.cwd(),
  'supabase/migrations/20260617_audit_reports.sql',
)

export { getBmybrandSupabaseProjectRef }

export function isAuditTableMissingError(message: string | undefined): boolean {
  if (!message) return false
  return (
    message.includes("Could not find the table 'public.audit_reports'") ||
    (message.includes('audit_reports') && message.includes('schema cache'))
  )
}

export function getAuditSchemaSetupInstructions(): string {
  const projectRef = getBmybrandSupabaseProjectRef()
  const dashboardUrl = projectRef
    ? `https://supabase.com/dashboard/project/${projectRef}/sql/new`
    : 'your website Supabase project SQL editor'

  return (
    `The audit_reports table is missing in the website Supabase project` +
    (projectRef ? ` (${projectRef})` : '') +
    `. Run invoice/supabase/migrations/20260617_audit_reports.sql in ${dashboardUrl}, ` +
    `or add BMYB_SUPABASE_DB_PASSWORD to invoice/.env.local and run npm run db:ensure-audit-table.`
  )
}

function buildAuditDatabaseConnectionString(projectRef: string, password: string): string {
  if (process.env.BMYB_SUPABASE_DB_URL?.trim()) {
    return process.env.BMYB_SUPABASE_DB_URL.trim()
  }

  const poolerHost =
    process.env.BMYB_SUPABASE_POOLER_HOST?.trim() || 'aws-1-us-east-2.pooler.supabase.com'

  return `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@${poolerHost}:6543/postgres`
}

export async function ensureAuditReportsTable(): Promise<void> {
  const password = process.env.BMYB_SUPABASE_DB_PASSWORD?.trim()
  const projectRef = getBmybrandSupabaseProjectRef()

  if (!password || !projectRef) {
    throw new Error(getAuditSchemaSetupInstructions())
  }

  const connectionString = buildAuditDatabaseConnectionString(projectRef, password)
  const sql = readFileSync(MIGRATION_FILE, 'utf8')
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })

  try {
    await client.connect()
    await client.query(sql)
  } finally {
    await client.end()
  }
}
