import { NextResponse } from 'next/server'
import { requireBlogEditor } from '@/lib/server-blog-editor-auth'
import { uploadToDrive } from '@/lib/server-google-drive'

const MAX_BLOG_IMAGE_BYTES = 10 * 1024 * 1024
const BLOG_IMAGE_FOLDER = process.env.GOOGLE_DRIVE_BLOG_IMAGES_FOLDER?.trim() || 'Blog Images'
const ALLOWED_IMAGE_TYPES = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
])

export async function POST(request: Request) {
  const auth = await requireBlogEditor(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Select an image to upload.' }, { status: 400 })
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: 'Use an AVIF, GIF, JPEG, PNG, or WebP image.' },
      { status: 400 },
    )
  }

  if (file.size > MAX_BLOG_IMAGE_BYTES) {
    return NextResponse.json({ error: 'Blog images must be 10MB or smaller.' }, { status: 400 })
  }

  try {
    const upload = await uploadToDrive(file, BLOG_IMAGE_FOLDER)
    return NextResponse.json({
      url: upload.publicViewUrl,
      fileId: upload.fileId,
      provider: 'google-drive',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to upload the image to Google Drive.'
    const disconnected = /reconnect google drive|oauth|invalid_grant/i.test(message)
    return NextResponse.json({ error: message }, { status: disconnected ? 503 : 500 })
  }
}
