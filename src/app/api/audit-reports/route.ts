import { NextResponse } from 'next/server'
import { getBmybrandSupabaseAdmin } from '@/lib/bmybrand-supabase'
import { requireActiveEmployee } from '@/lib/server-employee-auth'

export async function GET(request: Request) {
  const auth = await requireActiveEmployee(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const supabase = getBmybrandSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json(
      {
        error:
          'Audit database is not configured. Add NEXT_PUBLIC_BMYB_SUPABASE_URL and BMYB_SUPABASE_SERVICE_ROLE_KEY (or the main Supabase env vars) to .env.local.',
      },
      { status: 503 },
    )
  }

  const { data, error } = await supabase
    .from('audit_reports')
    .select(
      'id, site_url, industry, website_goal, overall_score, issue_count, summary, unlocked, lead_name, lead_email, lead_company, created_at',
    )
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to load website audits' },
      { status: 500 },
    )
  }

  return NextResponse.json({ audits: data ?? [] })
}
