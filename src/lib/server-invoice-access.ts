import { verifyInvoiceToken, type InvoiceTokenPurpose } from '@/lib/invoice-token'

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
  const normalizedToken = token?.trim() || ''
  if (!normalizedToken) {
    return { ok: false, status: 401, error: 'Missing invoice token' }
  }

  const payload = verifyInvoiceToken(normalizedToken)
  if (!payload || payload.purpose !== purpose) {
    return { ok: false, status: 401, error: 'Invalid or expired invoice token' }
  }

  if (payload.id !== invoiceId) {
    return { ok: false, status: 403, error: 'Invoice token does not match this invoice' }
  }

  return { ok: true }
}
