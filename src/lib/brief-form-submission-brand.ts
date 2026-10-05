import type { BriefFormSubmissionRow } from '@/lib/cpanel-brief-forms-bridge'
import { canonicalizeBriefFormBrandSlug } from '@/lib/brief-form-public-brand'

function payloadString(
  payload: BriefFormSubmissionRow['payload'],
  key: string
): string | null {
  const value = payload?.[key]
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) {
    return value[0].trim()
  }
  return null
}

export function getBriefFormSubmissionBrandName(row: BriefFormSubmissionRow): string {
  const named = payloadString(row.payload, 'brand_name')
  if (named) return named

  const slug = canonicalizeBriefFormBrandSlug(payloadString(row.payload, 'brand_slug'))
  if (slug === 'texaswebstudio') return 'Texas Web Studio'
  if (slug === 'bmybrand') return 'BMYBrand'

  return 'BMYBrand'
}
