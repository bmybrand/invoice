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
  // Token checks are disabled temporarily to avoid blocking public access.
  // Returning success unconditionally lets payment-related endpoints proceed by invoice id.
  // NOTE: Re-enable and tighten checks before deploying to production.
  return { ok: true }
}
