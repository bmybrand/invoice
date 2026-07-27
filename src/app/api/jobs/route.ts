import { NextResponse } from 'next/server'
import { getBmybrandSupabaseAdmin } from '@/lib/bmybrand-supabase'
import { requireJobEditor } from '@/lib/server-job-editor-auth'

type JobPayload = Record<string, unknown>

const departments = new Set(['Design', 'Technology', 'Growth', 'Operations'])
const workplaceTypes = new Set(['Remote', 'Hybrid', 'On-site'])
const employmentTypes = new Set(['Full-time', 'Part-time', 'Contract', 'Internship'])

function text(value: unknown) {
  return String(value ?? '').trim()
}

function slug(value: unknown) {
  return text(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function databaseError(message: string) {
  if (message.includes('job_openings') && message.includes('schema cache')) {
    return 'The job_openings table is not ready. Run supabase/migrations/20260727_job_openings.sql in the BmyBrand Supabase SQL editor.'
  }
  return message
}

function buildPayload(body: JobPayload) {
  const nextSlug = slug(body.slug)
  const title = text(body.title)
  const summary = text(body.summary)
  const department = text(body.department)
  const location = text(body.location)
  const workplace = text(body.workplace)
  const employmentType = text(body.employment_type)

  if (!nextSlug || !title || !summary || !location) {
    return { error: 'Slug, title, summary, and location are required.' } as const
  }
  if (!departments.has(department)) return { error: 'Choose a valid department.' } as const
  if (!workplaceTypes.has(workplace)) return { error: 'Choose a valid work style.' } as const
  if (!employmentTypes.has(employmentType)) return { error: 'Choose a valid employment type.' } as const

  return {
    payload: {
      slug: nextSlug,
      title,
      summary,
      department,
      location,
      workplace,
      employment_type: employmentType,
      sort_order: Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0,
      is_published: body.is_published !== false,
      updated_at: new Date().toISOString(),
    },
  } as const
}

async function authorize(request: Request) {
  const permission = await requireJobEditor(request)
  if (!permission.ok) {
    return { response: NextResponse.json({ error: permission.error }, { status: permission.status }) }
  }

  const jobsDatabase = getBmybrandSupabaseAdmin()
  if (!jobsDatabase) {
    return {
      response: NextResponse.json(
        { error: 'BmyBrand Supabase is not configured for the Invoice CRM.' },
        { status: 503 },
      ),
    }
  }

  return { jobsDatabase }
}

export async function GET(request: Request) {
  const auth = await authorize(request)
  if ('response' in auth) return auth.response

  const { data, error } = await auth.jobsDatabase
    .from('job_openings')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: databaseError(error.message) }, { status: 500 })
  return NextResponse.json(
    { jobs: data ?? [] },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}

export async function POST(request: Request) {
  const auth = await authorize(request)
  if ('response' in auth) return auth.response

  const body = (await request.json().catch(() => null)) as JobPayload | null
  if (!body) return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })

  const result = buildPayload(body)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })

  const { data, error } = await auth.jobsDatabase
    .from('job_openings')
    .insert(result.payload)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: databaseError(error.message) }, { status: 500 })
  return NextResponse.json({ job: data }, { status: 201 })
}

export async function PUT(request: Request) {
  const auth = await authorize(request)
  if ('response' in auth) return auth.response

  const body = (await request.json().catch(() => null)) as JobPayload | null
  if (!body) return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })

  const originalSlug = slug(body.original_slug || body.slug)
  const result = buildPayload(body)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })

  const { data, error } = await auth.jobsDatabase
    .from('job_openings')
    .update(result.payload)
    .eq('slug', originalSlug)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: databaseError(error.message) }, { status: 500 })
  return NextResponse.json({ job: data })
}

export async function DELETE(request: Request) {
  const auth = await authorize(request)
  if ('response' in auth) return auth.response

  const jobSlug = slug(new URL(request.url).searchParams.get('slug'))
  if (!jobSlug) return NextResponse.json({ error: 'Job slug is required.' }, { status: 400 })

  const { error } = await auth.jobsDatabase.from('job_openings').delete().eq('slug', jobSlug)
  if (error) return NextResponse.json({ error: databaseError(error.message) }, { status: 500 })
  return NextResponse.json({ success: true })
}
