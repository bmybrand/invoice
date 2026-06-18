import { NextResponse } from 'next/server'
import { uploadToDrive } from '@/lib/server-google-drive'
import { requireUploadAuth } from '@/lib/server-upload-auth'

const MAX_CHAT_FILE_BYTES = 20 * 1024 * 1024
const ALLOWED_CHAT_FILE_TYPES = new Set([
  'application/pdf',
  'image/avif',
  'image/bmp',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/svg+xml',
  'image/webp',
])

export async function POST(request: Request) {
  const auth = await requireUploadAuth(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'A file field is required.' }, { status: 400 })
  }

  if (!ALLOWED_CHAT_FILE_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Only images and PDFs can be uploaded.' }, { status: 400 })
  }

  if (file.size > MAX_CHAT_FILE_BYTES) {
    return NextResponse.json({ error: 'Chat files must be 20MB or smaller.' }, { status: 400 })
  }

  try {
    const result = await uploadToDrive(file, 'chat-files')
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload chat file.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
