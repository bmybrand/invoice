import { NextResponse } from 'next/server'
import { deleteDriveFile } from '@/lib/server-google-drive'
import { requireUploadAuth } from '@/lib/server-upload-auth'

export async function POST(request: Request) {
  const auth = await requireUploadAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => null)) as { fileId?: string } | null
  const fileId = String(body?.fileId ?? '').trim()
  if (!fileId) {
    return NextResponse.json({ error: 'A fileId is required.' }, { status: 400 })
  }

  try {
    const deleted = await deleteDriveFile(fileId)
    return NextResponse.json({ ok: true, deleted })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete avatar.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
