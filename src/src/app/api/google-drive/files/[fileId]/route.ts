import { NextResponse } from 'next/server'
import { getDriveFileMedia } from '@/lib/server-google-drive'

type RouteParams = { fileId: string }

function getParams(params: RouteParams | Promise<RouteParams>) {
  return params instanceof Promise ? params : Promise.resolve(params)
}

export async function GET(
  _request: Request,
  { params }: { params: RouteParams | Promise<RouteParams> }
) {
  const resolvedParams = await getParams(params)
  const fileId = decodeURIComponent(resolvedParams.fileId || '').trim()

  try {
    const media = await getDriveFileMedia(fileId)
    return new NextResponse(media.body, {
      headers: {
        'Content-Type': media.contentType,
        'Content-Length': String(media.contentLength),
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load Google Drive file.'
    return NextResponse.json({ error: message }, { status: 404 })
  }
}
