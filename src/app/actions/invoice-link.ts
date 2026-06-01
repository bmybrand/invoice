'use server'

export async function getInvoiceToken(_: number): Promise<string | null> {
  // Token generation removed — keep function for compatibility but return null.
  return null
}

export async function getInvoiceLink(invoiceId: number, payment?: string): Promise<string> {
  const base = `/invoice?id=${invoiceId}`
  return payment ? `${base}&payment=${encodeURIComponent(payment)}` : base
}

export async function getInvoicePayLink(invoiceId: number): Promise<string> {
  return `/invoice/pay?id=${invoiceId}`
}
