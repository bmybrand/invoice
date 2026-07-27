import { NextResponse } from 'next/server'
import { requireBlogEditor } from '@/lib/server-blog-editor-auth'
import { getBmybrandSupabaseAdmin } from '@/lib/bmybrand-supabase'

type BlogPayload = Record<string, unknown>

function text(value: unknown) {
  return String(value ?? '').trim()
}

function array(value: unknown) {
  return Array.isArray(value) ? value : []
}

function sanitizeHtml(html: string) {
  return html
    .replace(/<(script|iframe|object|embed|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(script|iframe|object|embed|link|meta|base)\b[^>]*\/?>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '')
}

function sanitizeSections(value: unknown) {
  return array(value).map((section) => {
    if (!section || typeof section !== 'object' || Array.isArray(section)) return section
    const record = section as Record<string, unknown>
    const blocks = array(record.blocks).map((block) => {
      if (!block || typeof block !== 'object' || Array.isArray(block)) return block
      const blockRecord = block as Record<string, unknown>
      return (blockRecord.type === 'html' || blockRecord.type === 'richtext') && typeof blockRecord.html === 'string'
        ? { ...blockRecord, html: sanitizeHtml(blockRecord.html) }
        : blockRecord
    })
    return {
      ...record,
      ...(typeof record.html === 'string' ? { html: sanitizeHtml(record.html) } : {}),
      ...(Array.isArray(record.blocks) ? { blocks } : {}),
    }
  })
}

function buildPayload(body: BlogPayload) {
  const slug = text(body.slug).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
  const title = text(body.title)
  const excerpt = text(body.excerpt)
  const category = text(body.category)

  if (!slug || !title || !excerpt || !category) {
    return { error: 'Slug, title, excerpt, and category are required.' } as const
  }

  const conclusion = Array.isArray(body.conclusion)
    ? body.conclusion.map(text).filter(Boolean)
    : text(body.conclusion)

  return {
    payload: {
      slug,
      title,
      excerpt,
      category,
      published_on: text(body.published_on),
      updated_on: text(body.updated_on) || null,
      read_time: text(body.read_time),
      author: text(body.author),
      hero_image: text(body.hero_image),
      accent: text(body.accent) || '#F45B25',
      display_number: text(body.display_number),
      sort_order: Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0,
      tags: array(body.tags),
      highlights: array(body.highlights),
      introduction: array(body.introduction),
      sections: sanitizeSections(body.sections),
      conclusion,
      closing_images: body.closing_images == null ? null : array(body.closing_images),
      faqs: array(body.faqs),
      is_published: body.is_published !== false,
    },
  } as const
}

async function authorize(request: Request) {
  const auth = await requireBlogEditor(request)
  if (!auth.ok) return { response: NextResponse.json({ error: auth.error }, { status: auth.status }) }

  const blogsDatabase = getBmybrandSupabaseAdmin()
  if (!blogsDatabase) {
    return {
      response: NextResponse.json(
        { error: 'BmyBrand Supabase is not configured for the Invoice CRM.' },
        { status: 503 },
      ),
    }
  }

  return { blogsDatabase }
}

export async function GET(request: Request) {
  const auth = await authorize(request)
  if ('response' in auth) return auth.response

  const { data, error } = await auth.blogsDatabase
    .from('blog_articles')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(
    { blogs: data ?? [] },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}

export async function POST(request: Request) {
  const auth = await authorize(request)
  if ('response' in auth) return auth.response

  const body = (await request.json().catch(() => null)) as BlogPayload | null
  if (!body) return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })

  const result = buildPayload(body)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })

  const { data, error } = await auth.blogsDatabase
    .from('blog_articles')
    .insert(result.payload)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ blog: data }, { status: 201 })
}

export async function PUT(request: Request) {
  const auth = await authorize(request)
  if ('response' in auth) return auth.response

  const body = (await request.json().catch(() => null)) as BlogPayload | null
  if (!body) return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })

  const originalSlug = text(body.original_slug || body.slug)
  const result = buildPayload(body)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })

  const { data, error } = await auth.blogsDatabase
    .from('blog_articles')
    .update(result.payload)
    .eq('slug', originalSlug)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ blog: data })
}

export async function DELETE(request: Request) {
  const auth = await authorize(request)
  if ('response' in auth) return auth.response

  const slug = text(new URL(request.url).searchParams.get('slug'))
  if (!slug) return NextResponse.json({ error: 'Blog slug is required.' }, { status: 400 })

  const { error } = await auth.blogsDatabase.from('blog_articles').delete().eq('slug', slug)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
