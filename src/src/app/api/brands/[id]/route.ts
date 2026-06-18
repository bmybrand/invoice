import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/server-superadmin-auth'

type RouteParams = { id: string }

function isMissingBrandIdColumnError(error: { message?: string | null } | null | undefined) {
  const message = (error?.message || '').toLowerCase()
  return message.includes('brand_id') && message.includes('does not exist')
}

export async function PATCH(
  request: Request,
  { params }: { params: RouteParams | Promise<RouteParams> }
) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const resolvedParams = params instanceof Promise ? await params : params
  const brandId = resolvedParams.id ? parseInt(resolvedParams.id, 10) : NaN
  if (!Number.isFinite(brandId) || brandId < 1) {
    return NextResponse.json({ error: 'Invalid brand ID' }, { status: 400 })
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const brandName = String(body?.brand_name ?? '').trim()
  const brandUrl = String(body?.brand_url ?? '').trim()
  const logoUrl = String(body?.logo_url ?? '').trim()
  const faviconUrl = String(body?.favicon_url ?? '').trim()

  if (!brandName) {
    return NextResponse.json({ error: 'Brand name is required' }, { status: 400 })
  }

  const { data: brand, error: fetchError } = await auth.supabase
    .from('brands')
    .select('id, isdeleted')
    .eq('id', brandId)
    .single()

  if (fetchError || !brand || (brand as { isdeleted?: boolean | null }).isdeleted === true) {
    return NextResponse.json({ error: fetchError?.message || 'Brand not found' }, { status: 404 })
  }

  const { error } = await auth.supabase
    .from('brands')
    .update({
      brand_name: brandName,
      brand_url: brandUrl || null,
      logo_url: logoUrl || null,
      favicon_url: faviconUrl || null,
    })
    .eq('id', brandId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  request: Request,
  { params }: { params: RouteParams | Promise<RouteParams> }
) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const resolvedParams = params instanceof Promise ? await params : params
  const brandId = resolvedParams.id ? parseInt(resolvedParams.id, 10) : NaN
  if (!Number.isFinite(brandId) || brandId < 1) {
    return NextResponse.json({ error: 'Invalid brand ID' }, { status: 400 })
  }

  const { data: brand, error: fetchError } = await auth.supabase
    .from('brands')
    .select('id, isdeleted')
    .eq('id', brandId)
    .single()

  if (fetchError || !brand || (brand as { isdeleted?: boolean | null }).isdeleted === true) {
    return NextResponse.json({ error: fetchError?.message || 'Brand not found' }, { status: 404 })
  }

  const { error } = await auth.supabase
    .from('brands')
    .update({ isdeleted: true })
    .eq('id', brandId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function POST(
  request: Request,
  { params }: { params: RouteParams | Promise<RouteParams> }
) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const resolvedParams = params instanceof Promise ? await params : params
  const brandId = resolvedParams.id ? parseInt(resolvedParams.id, 10) : NaN
  if (!Number.isFinite(brandId) || brandId < 1) {
    return NextResponse.json({ error: 'Invalid brand ID' }, { status: 400 })
  }

  const body = (await request.json().catch(() => null)) as { action?: string } | null
  const action = body?.action?.trim().toLowerCase()
  if (action !== 'purge' && action !== 'restore') {
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  }

  const { data: brand, error: fetchError } = await auth.supabase
    .from('brands')
    .select('id, brand_name, isdeleted')
    .eq('id', brandId)
    .single()

  if (fetchError || !brand) {
    return NextResponse.json({ error: fetchError?.message || 'Brand not found' }, { status: 404 })
  }

  const row = brand as { id: number; brand_name?: string | null; isdeleted?: boolean | null }

  if (row.isdeleted !== true) {
    return NextResponse.json(
      { error: `Only archived brands can be ${action === 'restore' ? 'restored' : 'permanently deleted'}` },
      { status: 409 }
    )
  }

  if (action === 'restore') {
    const { error } = await auth.supabase
      .from('brands')
      .update({ isdeleted: false })
      .eq('id', brandId)

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to restore brand' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  }

  const brandName = (row.brand_name || '').trim()
  let { count: invoiceCount, error: invoiceCountError } = await auth.supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('brand_id', brandId)

  if (invoiceCountError && isMissingBrandIdColumnError(invoiceCountError)) {
    invoiceCountError = null
    invoiceCount = 0
  }

  if (invoiceCountError) {
    return NextResponse.json(
      { error: invoiceCountError.message || 'Failed to validate brand invoices' },
      { status: 500 }
    )
  }

  if ((invoiceCount ?? 0) > 0) {
    return NextResponse.json(
      { error: 'This brand cannot be deleted forever because invoices are still linked to this brand.' },
      { status: 409 }
    )
  }

  if (brandName) {
    let { count: legacyInvoiceCount, error: legacyInvoiceCountError } = await auth.supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .is('brand_id', null)
      .eq('brand_name', brandName)

    if (legacyInvoiceCountError && isMissingBrandIdColumnError(legacyInvoiceCountError)) {
      ;({ count: legacyInvoiceCount, error: legacyInvoiceCountError } = await auth.supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('brand_name', brandName))
    }

    if (legacyInvoiceCountError) {
      return NextResponse.json(
        { error: legacyInvoiceCountError.message || 'Failed to validate legacy brand invoices' },
        { status: 500 }
      )
    }

    if ((legacyInvoiceCount ?? 0) > 0) {
      return NextResponse.json(
        { error: 'This brand cannot be deleted forever because invoices are still linked to this brand.' },
        { status: 409 }
      )
    }
  }

  const { error } = await auth.supabase
    .from('brands')
    .delete()
    .eq('id', brandId)

  if (error) {
    return NextResponse.json({ error: error.message || 'Failed to permanently delete brand' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
