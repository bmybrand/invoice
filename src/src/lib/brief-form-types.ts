export const BRIEF_FORM_TYPES = [
  'seo-questionnaire',
  'website',
  'logo-design',
  'graphic-design',
  'video-animation',
] as const

export type BriefFormType = (typeof BRIEF_FORM_TYPES)[number]

export function isBriefFormType(value: string): value is BriefFormType {
  return (BRIEF_FORM_TYPES as readonly string[]).includes(value)
}
