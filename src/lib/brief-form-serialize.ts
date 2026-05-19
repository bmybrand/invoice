function fieldKeyFromLabel(label: string): string {
  return (
    label
      .replace(/^\*\s*/, '')
      .replace(/:\s*$/, '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 120) || 'field'
  )
}

function assignValue(
  target: Record<string, string | string[]>,
  key: string,
  value: string
) {
  const trimmed = value.trim()
  if (!trimmed) {
    return
  }

  const existing = target[key]
  if (existing === undefined) {
    target[key] = trimmed
    return
  }

  if (Array.isArray(existing)) {
    if (!existing.includes(trimmed)) {
      existing.push(trimmed)
    }
    return
  }

  if (existing === trimmed) {
    return
  }

  target[key] = [existing, trimmed]
}

function uniqueKey(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base)
    return base
  }

  let index = 2
  while (used.has(`${base}_${index}`)) {
    index += 1
  }

  const next = `${base}_${index}`
  used.add(next)
  return next
}

export function serializeBriefForm(
  form: HTMLFormElement,
  extra: Record<string, unknown> = {}
): Record<string, string | string[]> {
  const payload: Record<string, string | string[]> = {}
  const usedKeys = new Set<string>()

  const formData = new FormData(form)
  for (const [name, rawValue] of formData.entries()) {
    if (typeof rawValue !== 'string') {
      continue
    }

    const key = uniqueKey(name.replace(/\[\]$/, ''), usedKeys)
    assignValue(payload, key, rawValue)
  }

  for (const label of form.querySelectorAll('label')) {
    const element = label.querySelector('input, textarea, select')
    if (!element || element.getAttribute('name')) {
      continue
    }

    if (
      element instanceof HTMLInputElement &&
      (element.type === 'radio' || element.type === 'checkbox')
    ) {
      continue
    }

    const labelText = label.querySelector('span')?.textContent?.trim() || ''
    if (!labelText) {
      continue
    }

    let value = ''
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      value = element.value
    } else if (element instanceof HTMLSelectElement) {
      value = element.value
    }

    const key = uniqueKey(fieldKeyFromLabel(labelText), usedKeys)
    assignValue(payload, key, value)
  }

  for (const fieldset of form.querySelectorAll('fieldset')) {
    if (fieldset.querySelector('[name]')) {
      continue
    }

    const legend = fieldset.querySelector('legend')?.textContent?.trim() || ''
    if (!legend) {
      continue
    }

    const key = uniqueKey(fieldKeyFromLabel(legend), usedKeys)
    const checked = Array.from(
      fieldset.querySelectorAll<HTMLInputElement>('input:checked')
    )
      .map((input) => input.value || input.labels?.[0]?.textContent?.trim() || '')
      .filter(Boolean)

    if (checked.length === 0) {
      continue
    }

    payload[key] = checked.length === 1 ? checked[0] : checked
  }

  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined || value === null) {
      continue
    }

    if (Array.isArray(value)) {
      const normalized = value
        .map((item) => (typeof item === 'string' ? item.trim() : String(item)))
        .filter(Boolean)
      if (normalized.length > 0) {
        payload[fieldKeyFromLabel(key)] = normalized.length === 1 ? normalized[0] : normalized
      }
      continue
    }

    if (typeof value === 'string') {
      assignValue(payload, fieldKeyFromLabel(key), value)
    } else {
      assignValue(payload, fieldKeyFromLabel(key), JSON.stringify(value))
    }
  }

  return payload
}

export function extractSubmitterEmail(
  payload: Record<string, string | string[]>
): string | null {
  for (const [key, value] of Object.entries(payload)) {
    if (!key.includes('email')) {
      continue
    }

    const email = Array.isArray(value) ? value[0] : value
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return email
    }
  }

  return null
}
