import { getUrlHostname } from '@/lib/invoice-public-url'
import {
  knownBriefFormsOriginForBrandName,
  resolveBriefFormsOriginForBrand,
  type BriefFormBrandOption,
} from '@/lib/brief-form-brand-url'

export type PublicBriefFormBrand = BriefFormBrandOption & {
  invoice_primary_color: string | null
  invoice_secondary_color: string | null
  logo_url: string | null
  favicon_url: string | null
}

function normalizeBrandSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

export function canonicalizeBriefFormBrandSlug(value: string | null | undefined): 'bmybrand' | 'texaswebstudio' | null {
  const slug = normalizeBrandSlug(value || '')
  if (!slug) return null
  if (slug === 'bmybrand' || slug === 'bmy') return 'bmybrand'
  if (
    slug === 'texaswebstudio' ||
    slug === 'texaxwebstudio' ||
    slug === 'texaswebstudios' ||
    slug === 'texaxwebstudios' ||
    slug === 'texas' ||
    slug === 'tws'
  ) {
    return 'texaswebstudio'
  }
  return null
}

export const BRIEF_FORM_BRAND_PRESETS: Record<
  'bmybrand' | 'texaswebstudio',
  PublicBriefFormBrand
> = {
  bmybrand: {
    id: -1,
    brand_name: 'BMYBrand',
    brand_url: 'https://bmybrand.com',
    invoice_base_url: 'https://bmybrand.com',
    invoice_primary_color: '#ea580c',
    invoice_secondary_color: '#0f172a',
    logo_url: null,
    favicon_url: null,
  },
  texaswebstudio: {
    id: -2,
    brand_name: 'Texas Web Studio',
    brand_url: 'https://texaswebstudio.co',
    invoice_base_url: 'https://texaswebstudio.co',
    invoice_primary_color: '#2563eb',
    invoice_secondary_color: '#0b1220',
    logo_url: null,
    favicon_url: null,
  },
}

export function isBriefFormCopyBrand(brandName: string | null | undefined): boolean {
  return canonicalizeBriefFormBrandSlug(brandName) != null
}

export function filterBriefFormCopyBrands<T extends { brand_name: string }>(brands: T[]): T[] {
  const filtered = brands.filter((brand) => isBriefFormCopyBrand(brand.brand_name))
  const order = ['bmybrand', 'texaswebstudio'] as const
  return filtered.sort((a, b) => {
    const aKey = canonicalizeBriefFormBrandSlug(a.brand_name) || ''
    const bKey = canonicalizeBriefFormBrandSlug(b.brand_name) || ''
    return order.indexOf(aKey as (typeof order)[number]) - order.indexOf(bKey as (typeof order)[number])
  })
}

function hostnameLooksLikeTexas(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^www\./, '')
  return host === 'texaswebstudio.co' || host.endsWith('.texaswebstudio.co')
}

function hostnameLooksLikeBmy(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^www\./, '')
  return host === 'bmybrand.com' || host.endsWith('.bmybrand.com')
}

export function matchPublicBriefFormBrand(
  brands: PublicBriefFormBrand[],
  options: {
    brandQuery?: string | null
    hostname?: string | null
    referrer?: string | null
  }
): PublicBriefFormBrand | null {
  const fromQuery = canonicalizeBriefFormBrandSlug(options.brandQuery)
  const hostname = (options.hostname || '').trim().toLowerCase().replace(/^www\./, '')

  let referrerHost = ''
  if (options.referrer) {
    try {
      referrerHost = new URL(options.referrer).hostname.toLowerCase().replace(/^www\./, '')
    } catch {
      referrerHost = ''
    }
  }

  const resolvedKey =
    fromQuery ||
    (hostnameLooksLikeTexas(hostname) || hostnameLooksLikeTexas(referrerHost)
      ? 'texaswebstudio'
      : null) ||
    (hostnameLooksLikeBmy(hostname) || hostnameLooksLikeBmy(referrerHost) ? 'bmybrand' : null)

  if (resolvedKey) {
    const preset = BRIEF_FORM_BRAND_PRESETS[resolvedKey]
    const fromDb =
      brands.find((brand) => canonicalizeBriefFormBrandSlug(brand.brand_name) === resolvedKey) ?? null

    if (fromDb) {
      return {
        ...preset,
        ...fromDb,
        brand_name: fromDb.brand_name || preset.brand_name,
        invoice_primary_color: fromDb.invoice_primary_color || preset.invoice_primary_color,
        invoice_secondary_color: fromDb.invoice_secondary_color || preset.invoice_secondary_color,
        logo_url: fromDb.logo_url || preset.logo_url,
        invoice_base_url: fromDb.invoice_base_url || preset.invoice_base_url,
      }
    }

    return preset
  }

  if (hostname) {
    const byInvoiceHost = brands.find((brand) => {
      const host = getUrlHostname(brand.invoice_base_url)?.replace(/^www\./, '')
      return host === hostname
    })
    if (byInvoiceHost) return byInvoiceHost

    const byResolvedHost = brands.find((brand) => {
      const host = getUrlHostname(resolveBriefFormsOriginForBrand(brand))?.replace(/^www\./, '')
      return host === hostname
    })
    if (byResolvedHost) return byResolvedHost

    const byKnownOrigin = brands.find((brand) => {
      const known = knownBriefFormsOriginForBrandName(brand.brand_name)
      return getUrlHostname(known)?.replace(/^www\./, '') === hostname
    })
    if (byKnownOrigin) return byKnownOrigin
  }

  return null
}

/** Sync resolve from URL/referrer/hostname using presets only (no DB). Prevents brand flash. */
export function resolvePublicBriefFormBrandSync(options: {
  brandQuery?: string | null
  hostname?: string | null
  referrer?: string | null
}): PublicBriefFormBrand {
  return matchPublicBriefFormBrand([], options) ?? BRIEF_FORM_BRAND_PRESETS.bmybrand
}

export function publicBriefFormBrandLabel(brand: PublicBriefFormBrand | null | undefined): string {
  const name = brand?.brand_name?.trim()
  return name ? `${name} Intake` : 'BMYBrand Intake'
}

export function publicBriefFormBrandAccent(brand: PublicBriefFormBrand | null | undefined): string {
  const color = (brand?.invoice_primary_color || '').trim()
  if (/^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase()

  const key = canonicalizeBriefFormBrandSlug(brand?.brand_name)
  if (key === 'texaswebstudio') return '#2563eb'
  return '#ea580c'
}

export function publicBriefFormBrandCopyright(brand: PublicBriefFormBrand | null | undefined): string {
  const year = new Date().getFullYear()
  const name = brand?.brand_name?.trim() || 'BMYBrand'
  return `Copyright ${year} ${name}. All Rights Reserved`
}

export function normalizePublicBrandRows(data: unknown[] | null): PublicBriefFormBrand[] {
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id),
    brand_name: String(row.brand_name ?? ''),
    brand_url: (row.brand_url as string | null) ?? null,
    invoice_base_url: (row.invoice_base_url as string | null) ?? null,
    invoice_primary_color: (row.invoice_primary_color as string | null) ?? null,
    invoice_secondary_color: (row.invoice_secondary_color as string | null) ?? null,
    logo_url: (row.logo_url as string | null) ?? null,
    favicon_url: (row.favicon_url as string | null) ?? null,
  }))
}
