export function normalizeInvoiceBaseUrl(value: string | null | undefined): string | null {
  const trimmed = (value || '').trim()
  if (!trimmed) return null

  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    url.pathname = '/'
    url.search = ''
    url.hash = ''
    return url.origin
  } catch {
    return null
  }
}

export function buildInvoicePublicUrl(
  path: string,
  invoiceBaseUrl: string | null | undefined,
  fallbackOrigin: string
): string {
  const origin = normalizeInvoiceBaseUrl(invoiceBaseUrl) || normalizeInvoiceBaseUrl(fallbackOrigin)
  if (!origin) return path
  return new URL(path, `${origin}/`).toString()
}

export function getUrlHostname(value: string | null | undefined): string | null {
  const normalized = normalizeInvoiceBaseUrl(value)
  if (!normalized) return null
  return new URL(normalized).hostname.toLowerCase()
}
