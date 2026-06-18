import type { BriefFormType } from '@/lib/brief-form-types'

type SubmissionPayload = Record<string, string | string[]>

export type BriefFormSubmissionRow = {
  id: number
  formType: string
  payload: SubmissionPayload
  submitterEmail: string | null
  submittedByAuthId: string | null
  source: string
  createdAt: string
}

function getBridgeConfig() {
  const url = (process.env.CPANEL_BRIEF_FORMS_BRIDGE_URL || '').trim().replace(/\/$/, '')
  const secret = (process.env.CPANEL_BRIEF_FORMS_BRIDGE_SECRET || '').trim()

  if (!url || !secret) {
    return null
  }

  return { url, secret }
}

export function isCpanelBridgeConfigured(): boolean {
  return Boolean(getBridgeConfig())
}

async function bridgeFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const config = getBridgeConfig()
  if (!config) {
    throw new Error('cPanel bridge is not configured.')
  }

  const headers = new Headers(init.headers)
  headers.set('X-Bridge-Secret', config.secret)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  return fetch(`${config.url}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  })
}

export async function saveBriefFormViaCpanelBridge(input: {
  formType: BriefFormType
  payload: SubmissionPayload
  submitterEmail: string | null
  submittedByAuthId: string | null
  source: 'public' | 'dashboard'
}): Promise<{ id: number; formType: string }> {
  const response = await bridgeFetch('', {
    method: 'POST',
    body: JSON.stringify({
      formType: input.formType,
      payload: input.payload,
      submitterEmail: input.submitterEmail,
      submittedByAuthId: input.submittedByAuthId,
      source: input.source,
    }),
  })

  const data = (await response.json().catch(() => null)) as
    | { id?: number; formType?: string; error?: string }
    | null

  if (!response.ok) {
    throw new Error(data?.error || 'cPanel bridge rejected the submission.')
  }

  const id = typeof data?.id === 'number' ? data.id : Number(data?.id)
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error('cPanel bridge did not return a submission id.')
  }

  return { id, formType: data?.formType || input.formType }
}

export async function listBriefFormsViaCpanelBridge(input: {
  formType?: BriefFormType
  limit: number
}): Promise<BriefFormSubmissionRow[]> {
  const params = new URLSearchParams()
  params.set('limit', String(input.limit))
  if (input.formType) {
    params.set('formType', input.formType)
  }

  const response = await bridgeFetch(`?${params.toString()}`, { method: 'GET' })
  const data = (await response.json().catch(() => null)) as
    | { submissions?: BriefFormSubmissionRow[]; error?: string }
    | null

  if (!response.ok) {
    throw new Error(data?.error || 'cPanel bridge could not load submissions.')
  }

  return data?.submissions ?? []
}

function findSubmissionById(
  rows: BriefFormSubmissionRow[],
  id: number
): BriefFormSubmissionRow | null {
  return rows.find((row) => Number(row.id) === id) ?? null
}

export async function getBriefFormByIdViaCpanelBridge(
  id: number
): Promise<BriefFormSubmissionRow | null> {
  const params = new URLSearchParams()
  params.set('id', String(id))

  const response = await bridgeFetch(`?${params.toString()}`, { method: 'GET' })
  const data = (await response.json().catch(() => null)) as
    | {
        submission?: BriefFormSubmissionRow | null
        submissions?: BriefFormSubmissionRow[]
        error?: string
      }
    | null

  if (!response.ok) {
    throw new Error(data?.error || 'cPanel bridge could not load the submission.')
  }

  if (data?.submission) {
    return data.submission
  }

  // Older bridge PHP without ?id= support returns a list instead.
  if (data?.submissions?.length) {
    const match = findSubmissionById(data.submissions, id)
    if (match) {
      return match
    }
  }

  const rows = await listBriefFormsViaCpanelBridge({ limit: 200 })
  return findSubmissionById(rows, id)
}
