import { NextResponse } from 'next/server'
import { getBmybrandSupabaseAdmin } from '@/lib/bmybrand-supabase'
import { requireCareerApplicationsAccess } from '@/lib/server-career-applications-auth'

export async function GET(request: Request) {
  const permission = await requireCareerApplicationsAccess(request)
  if (!permission.ok) {
    return NextResponse.json({ error: permission.error }, { status: permission.status })
  }

  const applicationsDatabase = getBmybrandSupabaseAdmin()
  if (!applicationsDatabase) {
    return NextResponse.json(
      { error: 'BmyBrand Supabase is not configured for the Invoice CRM.' },
      { status: 503 },
    )
  }

  const { data, error } = await applicationsDatabase
    .from('job_applications')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    const message =
      error.message.includes('job_applications') && error.message.includes('schema cache')
        ? 'The job applications table is not ready in BmyBrand Supabase.'
        : error.message
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json(
    { applications: data ?? [] },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}
