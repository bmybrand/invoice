import type { BriefFormType } from '@/lib/brief-form-types'

/**
 * Public brief forms for clients (unauthenticated).
 * Set NEXT_PUBLIC_BRIEF_FORMS_PUBLIC_BASE_URL to your brand site on Vercel, e.g.
 * https://bmybrand.vercel.app
 */
export function getBriefFormPublicBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_BRIEF_FORMS_PUBLIC_BASE_URL?.trim()
  if (fromEnv) {
    return fromEnv.replace(/\/$/, '')
  }

  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  return ''
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

  return path
}
