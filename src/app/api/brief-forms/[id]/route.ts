import { NextResponse } from 'next/server'
import { briefFormClientError, briefFormStorageSetupHint } from '@/lib/brief-form-errors'
import { requireBriefFormSubmissionsViewer } from '@/lib/server-brief-form-submissions-auth'
import {
  getBriefFormSubmissionById,
  isBriefFormStorageConfigured,
} from '@/lib/brief-form-storage'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireBriefFormSubmissionsViewer(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (!isBriefFormStorageConfigured()) {
    return NextResponse.json(
      {
        error:
          'Brief form storage is not configured. Set CPANEL_BRIEF_FORMS_BRIDGE_URL on Vercel, or MYSQL_* for local dev.',
      },
      { status: 503 }
    )
  }

  const { id: idParam } = await context.params
  const id = Number(idParam)
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid submission id.' }, { status: 400 })
  }

  try {
    const submission = await getBriefFormSubmissionById(id)
    if (!submission) {
      return NextResponse.json({ error: 'Submission not found.' }, { status: 404 })
    }

    return NextResponse.json({ submission })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database error'
    console.error('[brief-forms] get by id failed:', message)
    const hint = briefFormStorageSetupHint()
    return NextResponse.json(
      {
        error: briefFormClientError(error, 'Could not load submission.'),
        hint,
      },
      { status: 500 }
    )
  }
}
