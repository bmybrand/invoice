import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

dotenv.config({ path: join(rootDir, '.env.local') })

const supabaseUrl =
  process.env.NEXT_PUBLIC_BMYB_SUPABASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const password = process.env.BMYB_SUPABASE_DB_PASSWORD?.trim()

if (!supabaseUrl) {
  console.error('Missing NEXT_PUBLIC_BMYB_SUPABASE_URL in invoice/.env.local')
  process.exit(1)
}

if (!password) {
  console.error(
    'Missing BMYB_SUPABASE_DB_PASSWORD in invoice/.env.local.\n' +
      'Get it from Supabase Dashboard → Project Settings → Database → Database password.',
  )
  process.exit(1)
}

const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
const connectionString =
  process.env.BMYB_SUPABASE_DB_URL?.trim() ||
  `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@${process.env.BMYB_SUPABASE_POOLER_HOST?.trim() || 'aws-1-us-east-2.pooler.supabase.com'}:6543/postgres`

const sqlFiles = [
  join(rootDir, 'supabase/migrations/20260617_audit_reports.sql'),
  join(rootDir, 'supabase/migrations/20260624_audit_reports_drive.sql'),
]

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })

try {
  await client.connect()
  for (const sqlPath of sqlFiles) {
    await client.query(readFileSync(sqlPath, 'utf8'))
  }
  const { rows } = await client.query(
    "SELECT to_regclass('public.audit_reports') AS table_name",
  )
  console.log('audit_reports table ready:', rows[0]?.table_name ?? 'missing')
} catch (error) {
  console.error('Failed to create audit_reports table:', error instanceof Error ? error.message : error)
  process.exit(1)
} finally {
  await client.end()
}
