import { NextResponse } from 'next/server'
import { uploadToDrive } from '@/lib/server-google-drive'
import { requireUploadAuth } from '@/lib/server-upload-auth'

const MAX_AVATAR_BYTES = 5 * 1024 * 1024

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

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Avatar must be an image file.' }, { status: 400 })
  }

  if (file.size > MAX_AVATAR_BYTES) {
    return NextResponse.json({ error: 'Avatar must be 5MB or smaller.' }, { status: 400 })
  }

  try {
    const result = await uploadToDrive(file, 'avatars')
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload avatar.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
