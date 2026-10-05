import type { BriefFormType } from '@/lib/brief-form-types'
import { getBriefFormPublicBaseUrl } from '@/lib/brief-form-public-url'
import { getUrlHostname, normalizeInvoiceBaseUrl } from '@/lib/invoice-public-url'

export type BriefFormBrandOption = {
  id: number
  brand_name: string
  brand_url: string | null
  brief_forms_base_url: string | null
  invoice_base_url: string | null
}

function normalizeBrandSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

export function resolveBriefFormsOriginForBrand(brand: BriefFormBrandOption | null | undefined): string {
  const fromBrief =
    normalizeInvoiceBaseUrl(brand?.brief_forms_base_url) ||
    normalizeInvoiceBaseUrl(brand?.brand_url) ||
    normalizeInvoiceBaseUrl(brand?.invoice_base_url)

  if (fromBrief) {
    return fromBrief
  }

  return getBriefFormPublicBaseUrl()
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
    brands.find((brand) => getUrlHostname(brand.brief_forms_base_url) === normalizedHost) ??
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
