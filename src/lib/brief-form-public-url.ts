import type { BriefFormType } from '@/lib/brief-form-types'

/** Production brand site — never expose *.vercel.app in client-facing copy links. */
const BMYBRAND_PUBLIC_SITE_ORIGIN = 'https://bmybrand.com'

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, '')
}

function canonicalizeBrandPublicOrigin(url: string): string {
  const normalized = normalizeBaseUrl(url)

  try {
    const { hostname } = new URL(normalized)
    if (hostname === 'bmybrand.vercel.app' || hostname.endsWith('.bmybrand.vercel.app')) {
      return BMYBRAND_PUBLIC_SITE_ORIGIN
    }
  } catch {
    return normalized
  }

  return normalized
}

/**
 * When staff use dashboard.bmybrand.com, public forms live on bmybrand.com.
 */
function deriveBrandSiteFromDashboardHostname(hostname: string): string | null {
  if (!hostname.startsWith('dashboard.')) {
    return null
  }

  const brandHost = hostname.slice('dashboard.'.length)
  if (!brandHost || brandHost.includes('.vercel.app')) {
    return null
  }

  return `https://${brandHost}`
}

function readConfiguredPublicBaseUrl(): string | null {
  const candidates = [
    process.env.NEXT_PUBLIC_BRIEF_FORMS_PUBLIC_BASE_URL,
    process.env.NEXT_PUBLIC_BRAND_SITE_URL,
  ]

  for (const value of candidates) {
    const trimmed = value?.trim()
    if (trimmed) {
      return canonicalizeBrandPublicOrigin(trimmed)
    }
  }

  return null
}

/**
 * Public brief forms for clients (unauthenticated).
 * Set NEXT_PUBLIC_BRIEF_FORMS_PUBLIC_BASE_URL to your brand site, e.g.
 * https://bmybrand.com
 */
export function getBriefFormPublicBaseUrl(): string {
  const fromEnv = readConfiguredPublicBaseUrl()

  if (typeof window !== 'undefined') {
    const derived = deriveBrandSiteFromDashboardHostname(window.location.hostname)
    if (derived) {
      return derived
    }
  }

  if (fromEnv) {
    return fromEnv
  }

  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  return BMYBRAND_PUBLIC_SITE_ORIGIN
}

export function getBriefFormPublicUrl(formType: BriefFormType): string {
  const path = `/brief-forms/${formType}`
  const base = getBriefFormPublicBaseUrl()

  if (base) {
    return `${base}${path}`
  }

  if (typeof window !== 'undefined') {
    return new URL(path, window.location.origin).toString()
  }

  return `${BMYBRAND_PUBLIC_SITE_ORIGIN}${path}`
}
