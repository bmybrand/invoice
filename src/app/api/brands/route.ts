import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/server-superadmin-auth'
import { normalizeInvoiceBaseUrl } from '@/lib/invoice-public-url'

export async function POST(request: Request) {
  const auth = await requireSuperAdmin(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const brandName = String(body?.brand_name ?? '').trim()
  const brandUrl = String(body?.brand_url ?? '').trim()
  const invoiceBaseUrl = String(body?.invoice_base_url ?? '').trim()
  const logoUrl = String(body?.logo_url ?? '').trim()
  const faviconUrl = String(body?.favicon_url ?? '').trim()

  if (!brandName) {
    return NextResponse.json({ error: 'Brand name is required' }, { status: 400 })
  }

  const normalizedInvoiceBaseUrl = normalizeInvoiceBaseUrl(invoiceBaseUrl)
  if (invoiceBaseUrl && !normalizedInvoiceBaseUrl) {
    return NextResponse.json({ error: 'Invoice URL must be a valid HTTP or HTTPS URL' }, { status: 400 })
  }

  const { data: brand, error } = await auth.supabase
    .from('brands')
    .insert({
      brand_name: brandName,
      brand_url: brandUrl || null,
      invoice_base_url: normalizedInvoiceBaseUrl,
      logo_url: logoUrl || null,
      favicon_url: faviconUrl || null,
      isdeleted: false,
    })
    .select('id, brand_name, brand_url, invoice_base_url, logo_url, favicon_url, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ brand }, { status: 201 })
}
