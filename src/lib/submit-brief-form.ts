import { serializeBriefForm } from '@/lib/brief-form-serialize'
import type { BriefFormType } from '@/lib/brief-form-types'

type SubmitResult =
  | { ok: true; id: number }
  | { ok: false; error: string }

export async function submitBriefForm(
  formType: BriefFormType,
  form: HTMLFormElement,
  extra: Record<string, unknown> = {}
): Promise<SubmitResult> {
  const payload = serializeBriefForm(form, extra)

  const response = await fetch('/api/brief-forms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ formType, payload }),
  })

  const data = (await response.json().catch(() => null)) as
    | { id?: number; error?: string }
    | null

  if (!response.ok) {
    return { ok: false, error: data?.error || 'Could not save your submission.' }
  }

  const id = typeof data?.id === 'number' ? data.id : Number(data?.id)
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, error: 'Submission saved but no confirmation id was returned.' }
  }

  return { ok: true, id }
}
