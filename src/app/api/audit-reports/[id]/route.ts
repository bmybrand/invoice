import { NextResponse } from 'next/server'
import { loadAuditReportById } from '@/lib/audit-report-access'
import { getBmybrandSupabaseAdmin } from '@/lib/bmybrand-supabase'
import { deleteDriveFile } from '@/lib/server-google-drive'
import { requireActiveEmployee } from '@/lib/server-employee-auth'
import { requireSuperAdmin } from '@/lib/server-superadmin-auth'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireActiveEmployee(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: 'Missing audit ID' }, { status: 400 })
  }

  const loaded = await loadAuditReportById(id)
  if ('error' in loaded && loaded.error) {
    return loaded.error
  }

  return NextResponse.json({ audit: loaded.audit })
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: 'Missing audit ID' }, { status: 400 })
  }

  const supabase = getBmybrandSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json({ error: 'Audit database is not configured.' }, { status: 503 })
  }

  const { data: audit, error: fetchError } = await supabase
    .from('audit_reports')
    .select('id, isdeleted')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    return NextResponse.json(
      { error: fetchError.message || 'Failed to load audit report' },
      { status: 500 },
    )
  }

  if (!audit || audit.isdeleted === true) {
    return NextResponse.json({ error: 'Audit report not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('audit_reports')
    .update({
      isdeleted: true,
      archived_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to archive audit report' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: 'Missing audit ID' }, { status: 400 })
  }

  const body = (await request.json().catch(() => null)) as { action?: string } | null
  const action = body?.action?.trim().toLowerCase()
  if (action !== 'purge' && action !== 'restore') {
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  }

  const supabase = getBmybrandSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json({ error: 'Audit database is not configured.' }, { status: 503 })
  }

  const { data: audit, error: fetchError } = await supabase
    .from('audit_reports')
    .select('id, site_url, drive_file_id, isdeleted')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    return NextResponse.json(
      { error: fetchError.message || 'Failed to load audit report' },
      { status: 500 },
    )
  }

  if (!audit) {
    return NextResponse.json({ error: 'Audit report not found' }, { status: 404 })
  }

  if (audit.isdeleted !== true) {
    return NextResponse.json(
      {
        error: `Only archived audit reports can be ${action === 'restore' ? 'restored' : 'permanently deleted'}`,
      },
      { status: 409 },
    )
  }

  if (action === 'restore') {
    const { error } = await supabase
      .from('audit_reports')
      .update({
        isdeleted: false,
        archived_at: null,
      })
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Failed to restore audit report' },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true })
  }

  if (audit.drive_file_id) {
    try {
      await deleteDriveFile(audit.drive_file_id)
    } catch (driveError) {
      console.warn('Failed to delete archived audit PDF from Google Drive', {
        id,
        driveFileId: audit.drive_file_id,
        detail: driveError instanceof Error ? driveError.message : 'Unknown error',
      })
    }
  }

  const { error } = await supabase.from('audit_reports').delete().eq('id', id)

  if (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to permanently delete audit report' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
