import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import { readInvoiceToken } from '@/lib/invoice-token'

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

type InvoiceBrandMetadata = {
  brandName: string
  faviconUrl: string
  websiteUrl: string | null
}

function normalizeBrandName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

function isBmyBrand(value: string): boolean {
  const normalized = normalizeBrandName(value)
  return normalized === 'bmybrand' || normalized === 'bmy'
}

function safeHttpUrl(value: unknown): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) return null

  try {
    const parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null
  } catch {
    return null
  }
}

async function loadInvoiceBrandMetadata(token: string | null | undefined): Promise<InvoiceBrandMetadata | null> {
  const normalizedToken = token?.trim() || ''
  const tokenPayload = normalizedToken
    ? readInvoiceToken(normalizedToken) || readInvoiceToken(normalizedToken, { allowExpired: true })
    : null
  if (!tokenPayload) return null

  const { data: invoice } = await supabase
    .from('invoices')
    .select('brand_id, brand_name')
    .eq('id', tokenPayload.id)
    .maybeSingle()

  if (!invoice) return null

  const invoiceBrandName = String(invoice.brand_name || '').trim()
  const brandId = invoice.brand_id == null ? null : Number(invoice.brand_id)
  let brand: { brand_name?: unknown; brand_url?: unknown; logo_url?: unknown; favicon_url?: unknown } | null = null

  if (Number.isFinite(brandId) && brandId && brandId > 0) {
    const result = await supabase
      .from('brands')
      .select('brand_name, brand_url, logo_url, favicon_url')
      .eq('id', brandId)
      .maybeSingle()
    brand = result.data
  }

  if (!brand && invoiceBrandName) {
    const result = await supabase
      .from('brands')
      .select('brand_name, brand_url, logo_url, favicon_url')
      .eq('brand_name', invoiceBrandName)
      .maybeSingle()
    brand = result.data
  }

  const brandName = String(brand?.brand_name || invoiceBrandName || 'Invoice').trim()
  const configuredFavicon = safeHttpUrl(brand?.favicon_url)
  const logoFallback = safeHttpUrl(brand?.logo_url)

  return {
    brandName,
    faviconUrl: configuredFavicon || logoFallback || (isBmyBrand(brandName) ? '/bmybrand-favicon.ico' : '/invoice-favicon.svg?v=2'),
    websiteUrl: safeHttpUrl(brand?.brand_url),
  }
}

export async function buildInvoiceMetadata(
  token: string | null | undefined,
  page: 'view' | 'pay' = 'view'
): Promise<Metadata> {
  const brand = await loadInvoiceBrandMetadata(token)
  const brandName = brand?.brandName || 'Invoice'
  const pageLabel = page === 'pay' ? 'Secure Invoice Payment' : 'Invoice'
  const title = `${brandName} | ${pageLabel}`
  const description = page === 'pay'
    ? `Securely pay your ${brandName} invoice.`
    : `View your invoice from ${brandName}.`

  return {
    title: { absolute: title },
    applicationName: brandName,
    description,
    icons: {
      icon: [{ url: brand?.faviconUrl || '/invoice-favicon.svg?v=1' }],
      shortcut: [{ url: brand?.faviconUrl || '/invoice-favicon.svg?v=1' }],
    },
    openGraph: {
      type: 'website',
      title,
      description,
      siteName: brandName,
      url: brand?.websiteUrl || undefined,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}
