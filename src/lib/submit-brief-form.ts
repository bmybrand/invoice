import { serializeBriefForm } from '@/lib/brief-form-serialize'
import type { BriefFormType } from '@/lib/brief-form-types'
import { canonicalizeBriefFormBrandSlug } from '@/lib/brief-form-public-brand'

type SubmitResult =
  | { ok: true; id: number }
  | { ok: false; error: string }

function resolveSubmitBrandMeta(): { brand_slug: string; brand_name: string } {
  if (typeof window === 'undefined') {
    return { brand_slug: 'bmybrand', brand_name: 'BMYBrand' }
  }

  const fromQuery = canonicalizeBriefFormBrandSlug(
    new URLSearchParams(window.location.search).get('brand')
  )

  let fromHost: 'bmybrand' | 'texaswebstudio' | null = null
  try {
    const host = (document.referrer ? new URL(document.referrer).hostname : window.location.hostname)
      .toLowerCase()
      .replace(/^www\./, '')
    if (host === 'texaswebstudio.co' || host.endsWith('.texaswebstudio.co')) {
      fromHost = 'texaswebstudio'
    } else if (host.includes('bmybrand')) {
      fromHost = 'bmybrand'
    }
  } catch {
    fromHost = null
  }

  const slug = fromQuery || fromHost || 'bmybrand'
  return {
    brand_slug: slug,
    brand_name: slug === 'texaswebstudio' ? 'Texas Web Studio' : 'BMYBrand',
  }
}

export async function submitBriefForm(
  formType: BriefFormType,
  form: HTMLFormElement,
  extra: Record<string, unknown> = {}
): Promise<SubmitResult> {
  const brandMeta = resolveSubmitBrandMeta()
  const payload = serializeBriefForm(form, {
    ...extra,
    brand_slug: brandMeta.brand_slug,
    brand_name: brandMeta.brand_name,
  })

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
