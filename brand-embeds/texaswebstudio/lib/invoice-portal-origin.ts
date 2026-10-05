/** Production URL of the invoice CRM Next.js app (not this brand site). */
export function getInvoicePortalOrigin(): string {
  return (
    process.env.INVOICE_PORTAL_ORIGIN ||
    process.env.NEXT_PUBLIC_INVOICE_PORTAL_ORIGIN ||
    ''
  ).replace(/\/$/, '')
}

export const BRIEF_FORM_SLUGS = [
  'seo-questionnaire',
  'website',
  'logo-design',
  'graphic-design',
  'video-animation',
  'smm',
] as const

export type BriefFormSlug = (typeof BRIEF_FORM_SLUGS)[number]

export function isBriefFormSlug(value: string): value is BriefFormSlug {
  return (BRIEF_FORM_SLUGS as readonly string[]).includes(value)
}
