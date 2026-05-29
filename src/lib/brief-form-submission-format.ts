export type BriefFormPayloadValue = string | string[]

export function formatBriefFormPayloadValue(value: BriefFormPayloadValue): string {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(', ') || '—'
  }
  return value.trim() || '—'
}

export function formatBriefFormSubmittedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
