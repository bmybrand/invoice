import CryptoJS from 'crypto-js'

const SECRET = process.env.INVOICE_LINK_SECRET_KEY || 'invoice-crm-default-secret-change-in-production'

function toBase64Url(str: string): string {
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(str: string): string {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4
  if (pad) b64 += '='.repeat(4 - pad)
  return b64
}

export function encryptInvoiceId(id: number): string {
  const encrypted = CryptoJS.AES.encrypt(String(id), SECRET).toString()
  return toBase64Url(encrypted)
}

export function decryptInvoiceToken(token: string): number | null {
  try {
    const decrypted = CryptoJS.AES.decrypt(fromBase64Url(token), SECRET).toString(CryptoJS.enc.Utf8)
    const id = Number(decrypted)
    return Number.isFinite(id) && id > 0 ? id : null
  } catch {
    return null
  }
}

export function getInvoiceLink(invoiceId: number, payment?: string): string {
  const token = encryptInvoiceId(invoiceId)
  const base = `/invoice?token=${encodeURIComponent(token)}`
  return payment ? `${base}&payment=${encodeURIComponent(payment)}` : base
}

export function getInvoicePayLink(invoiceId: number): string {
  const token = encryptInvoiceId(invoiceId)
  return `/invoice/pay?token=${encodeURIComponent(token)}`
}
