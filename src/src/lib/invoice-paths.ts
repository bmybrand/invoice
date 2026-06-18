export function getInvoicePath(invoiceId: number, payment?: string): string {
  const base = `/invoice?id=${encodeURIComponent(String(invoiceId))}`
  return payment ? `${base}&payment=${encodeURIComponent(payment)}` : base
}

export function getInvoicePayPath(invoiceId: number): string {
  return `/invoice/pay?id=${encodeURIComponent(String(invoiceId))}`
}
