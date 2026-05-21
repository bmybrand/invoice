import type { BriefFormType } from '@/lib/brief-form-types'

export const BRIEF_FORM_LABELS: Record<BriefFormType, string> = {
  'seo-questionnaire': 'SEO Questionnaire',
  website: 'Website Brief',
  'logo-design': 'Logo Design',
  'graphic-design': 'Graphic Design',
  'video-animation': 'Video Animation',
}

export function getBriefFormLabel(formType: string): string {
  return BRIEF_FORM_LABELS[formType as BriefFormType] ?? formType
}
