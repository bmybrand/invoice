import { readInvoiceToken, type InvoiceTokenPurpose } from '@/lib/invoice-token'

type BoundInvoiceAccessSuccess = {
  ok: true
}

type BoundInvoiceAccessFailure = {
  ok: false
  status: number
  error: string
}

export type BoundInvoiceAccessResult = BoundInvoiceAccessSuccess | BoundInvoiceAccessFailure

export function requireBoundInvoiceToken(
  token: string | null | undefined,
  invoiceId: number,
  purpose: InvoiceTokenPurpose = 'pay'
): BoundInvoiceAccessResult {
  const normalizedToken = token?.trim() ?? ''
  if (!normalizedToken) {
    return {
      ok: false,
      status: 401,
      error: 'Missing invoice token',
    }
  }

  const payload = readInvoiceToken(normalizedToken)
  if (!payload) {
    const expiredPayload = readInvoiceToken(normalizedToken, { allowExpired: true })
    return {
      ok: false,
      status: 401,
      error: expiredPayload ? 'Token expired' : 'Invalid invoice token',
    }
  }

  if (payload.id !== invoiceId) {
    return {
      ok: false,
      status: 403,
      error: 'Invoice token does not match this invoice',
    }
  }

  if (purpose === 'view' && payload.purpose !== 'view') {
    return {
      ok: false,
      status: 403,
      error: 'Invoice token is not valid for viewing',
    }
  }

  if (purpose === 'pay' && payload.purpose !== 'pay' && payload.purpose !== 'view') {
    return {
      ok: false,
      status: 403,
      error: 'Invoice token is not valid for payment',
    }
  }

  return { ok: true }
}
