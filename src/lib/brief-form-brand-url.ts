import type { BriefFormType } from '@/lib/brief-form-types'
import { getBriefFormPublicBaseUrl } from '@/lib/brief-form-public-url'
import { getUrlHostname, normalizeInvoiceBaseUrl } from '@/lib/invoice-public-url'

export type BriefFormBrandOption = {
  id: number
  brand_name: string
  brand_url: string | null
  invoice_base_url: string | null
}

function normalizeBrandSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

/** Same Vercel domains as invoices; map dashboard.* → public apex for client brief links. */
export function briefFormsOriginFromInvoiceBaseUrl(invoiceBaseUrl: string | null | undefined): string | null {
  const origin = normalizeInvoiceBaseUrl(invoiceBaseUrl)
  if (!origin) return null

  try {
    const host = new URL(origin).hostname.toLowerCase()
    if (host.startsWith('dashboard.')) {
      return `https://${host.slice('dashboard.'.length)}`
    }
    if (host.startsWith('invoice.')) {
      return `https://${host.slice('invoice.'.length)}`
    }
    return origin
  } catch {
    return origin
  }
}

const KNOWN_BRIEF_FORM_ORIGINS: Record<string, string> = {
  bmybrand: 'https://bmybrand.com',
  bmy: 'https://bmybrand.com',
  americanwebexperts: 'https://americanwebexperts.com',
  americanwebexpert: 'https://americanwebexperts.com',
  texaswebstudio: 'https://texaswebstudio.co',
  texaxwebstudio: 'https://texaswebstudio.co',
  texaswebstudios: 'https://texaswebstudio.co',
  texaxwebstudios: 'https://texaswebstudio.co',
}

export function knownBriefFormsOriginForBrandName(brandName: string | null | undefined): string | null {
  if (!brandName) return null
  return KNOWN_BRIEF_FORM_ORIGINS[normalizeBrandSlug(brandName)] ?? null
}

export function resolveBriefFormsOriginForBrand(brand: BriefFormBrandOption | null | undefined): string {
  return (
    briefFormsOriginFromInvoiceBaseUrl(brand?.invoice_base_url) ||
    knownBriefFormsOriginForBrandName(brand?.brand_name) ||
    normalizeInvoiceBaseUrl(brand?.brand_url) ||
    getBriefFormPublicBaseUrl()
  )
}

export function buildBriefFormPublicUrlForBrand(
  formType: BriefFormType,
  brand: BriefFormBrandOption | null | undefined
): string {
  const base = resolveBriefFormsOriginForBrand(brand)
  return `${base.replace(/\/$/, '')}/brief-forms/${formType}`
}

export function findBriefFormBrandForHostname(
  hostname: string,
  brands: BriefFormBrandOption[]
): BriefFormBrandOption | null {
  const normalizedHost = hostname.trim().toLowerCase()
  if (!normalizedHost) {
    return null
  }

  return (
    brands.find((brand) => getUrlHostname(resolveBriefFormsOriginForBrand(brand)) === normalizedHost) ??
    brands.find((brand) => getUrlHostname(brand.invoice_base_url) === normalizedHost) ??
    brands.find((brand) => getUrlHostname(brand.brand_url) === normalizedHost) ??
    null
  )
}

export function pickDefaultBriefFormBrand(brands: BriefFormBrandOption[]): BriefFormBrandOption | null {
  if (brands.length === 0) {
    return null
  }

  if (typeof window !== 'undefined') {
    const fromHost = findBriefFormBrandForHostname(window.location.hostname, brands)
    if (fromHost) {
      return fromHost
    }
  }

  const bmy =
    brands.find((b) => normalizeBrandSlug(b.brand_name) === 'bmybrand') ??
    brands.find((b) => normalizeBrandSlug(b.brand_name) === 'bmy')

  return bmy ?? brands[0]
}
