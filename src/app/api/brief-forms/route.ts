import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { extractSubmitterEmail } from '@/lib/brief-form-serialize'
import { isBriefFormType, type BriefFormType } from '@/lib/brief-form-types'
import {
  getBriefFormSubmissionById,
  isBriefFormStorageConfigured,
  listBriefFormSubmissions,
  saveBriefFormSubmission,
} from '@/lib/brief-form-storage'
import { briefFormClientError, briefFormStorageSetupHint } from '@/lib/brief-form-errors'
import { requireBriefFormSubmissionsViewer } from '@/lib/server-brief-form-submissions-auth'

type SubmissionPayload = Record<string, string | string[]>

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY

  if (!url || !key) {
    return null
  }

  return { url, key }
}

async function getOptionalAuthUserId(): Promise<string | null> {
  const config = getSupabaseConfig()
  if (!config) {
    return null
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll() {},
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user?.id ?? null
}

async function isEmployeeUser(authId: string): Promise<boolean> {
  const config = getSupabaseConfig()
  if (!config) {
    return false
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll() {},
    },
  })

  const { data } = await supabase
    .from('employees')
    .select('id')
    .eq('auth_id', authId)
    .neq('isdeleted', true)
    .maybeSingle()

  return Boolean(data)
}

export async function POST(request: Request) {
  if (!isBriefFormStorageConfigured()) {
    return NextResponse.json(
      {
        error:
          'Brief form storage is not configured. Set CPANEL_BRIEF_FORMS_BRIDGE_URL on Vercel, or MYSQL_* for local dev.',
      },
      { status: 503 }
    )
  }

  let body: { formType?: string; payload?: SubmissionPayload }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const formType = (body.formType || '').trim()
  const payload = body.payload

  if (!isBriefFormType(formType)) {
    return NextResponse.json({ error: 'Invalid brief form type.' }, { status: 400 })
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return NextResponse.json({ error: 'Submission payload is required.' }, { status: 400 })
  }

  const submitterEmail = extractSubmitterEmail(payload)
  const submittedByAuthId = await getOptionalAuthUserId()

  if (submittedByAuthId && (await isEmployeeUser(submittedByAuthId))) {
    return NextResponse.json(
      { error: 'Only clients can submit brief forms. Send the public link to your client.' },
      { status: 403 }
    )
  }

  try {
    const result = await saveBriefFormSubmission({
      formType,
      payload,
      submitterEmail,
      submittedByAuthId,
    })

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database error'
    console.error('[brief-forms] insert failed:', message)
    const hint = briefFormStorageSetupHint()
    return NextResponse.json(
      {
        error: briefFormClientError(
          error,
          'Could not save submission. Check cPanel bridge or MySQL configuration.'
        ),
        hint,
      },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url)
  const idParam = (searchParams.get('id') || '').trim()
  const formTypeParam = (searchParams.get('formType') || '').trim()
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || 50), 1), 200)

  if (idParam) {
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

  let formType: BriefFormType | undefined
  if (formTypeParam) {
    if (!isBriefFormType(formTypeParam)) {
      return NextResponse.json({ error: 'Invalid brief form type.' }, { status: 400 })
    }
    formType = formTypeParam
  }

  try {
    const submissions = await listBriefFormSubmissions({
      formType,
      limit,
    })

    return NextResponse.json({ submissions })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database error'
    console.error('[brief-forms] list failed:', message)
    const hint = briefFormStorageSetupHint()
    return NextResponse.json(
      {
        error: briefFormClientError(error, 'Could not load submissions.'),
        hint,
      },
      { status: 500 }
    )
  }
}
