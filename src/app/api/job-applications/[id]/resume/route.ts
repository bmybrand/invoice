import { NextResponse } from 'next/server'
import { getBmybrandSupabaseAdmin } from '@/lib/bmybrand-supabase'
import { requireCareerApplicationsAccess } from '@/lib/server-career-applications-auth'
import { getDriveFileMedia } from '@/lib/server-google-drive'

type RouteParams = { id: string }

function safeDownloadName(value: string) {
  return value.replace(/[\r\n"\\/:*?<>|]/g, '_').trim() || 'resume'
}

export async function GET(
  request: Request,
  { params }: { params: Promise<RouteParams> },
) {
  const permission = await requireCareerApplicationsAccess(request)
  if (!permission.ok) {
    return NextResponse.json({ error: permission.error }, { status: permission.status })
  }

  const { id } = await params
  const applicationId = decodeURIComponent(id || '').trim()
  if (!applicationId) {
    return NextResponse.json({ error: 'Application ID is required.' }, { status: 400 })
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
    .select('resume_file_name, resume_file_type, resume_drive_file_id')
    .eq('id', applicationId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Unable to find this application.' }, { status: 500 })
  }
  if (!data?.resume_drive_file_id) {
    return NextResponse.json({ error: 'This application does not have a downloadable resume.' }, { status: 404 })
  }

  try {
    const media = await getDriveFileMedia(data.resume_drive_file_id)
    const fileName = safeDownloadName(data.resume_file_name || 'resume')
    const asciiFileName = fileName.replace(/[^\x20-\x7E]/g, '_')
    const encodedFileName = encodeURIComponent(fileName)

    return new NextResponse(media.body, {
      headers: {
        'Content-Type': data.resume_file_type || media.contentType || 'application/octet-stream',
        'Content-Length': String(media.contentLength),
        'Content-Disposition': `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodedFileName}`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (downloadError) {
    const message =
      downloadError instanceof Error ? downloadError.message : 'Unable to download this resume.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
