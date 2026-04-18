import crypto from 'node:crypto'
import { env } from '@/lib/env'

export type InvoiceTokenPurpose = 'view' | 'pay'

type InvoiceTokenPayload = {
  id: number
  exp: number
  purpose: InvoiceTokenPurpose
}

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30

function b64urlEncode(buffer: Buffer): string {
  return buffer.toString('base64url')
}

function b64urlDecode(value: string): Buffer {
  return Buffer.from(value, 'base64url')
}

function signPayload(payload: InvoiceTokenPayload): string {
  const body = b64urlEncode(Buffer.from(JSON.stringify(payload), 'utf8'))
  const signature = b64urlEncode(
    crypto.createHmac('sha256', env.INVOICE_LINK_SECRET_KEY).update(body).digest()
  )
  return `${body}.${signature}`
}

export function verifyInvoiceToken(token: string): InvoiceTokenPayload | null {
  try {
    const [body, signature] = token.split('.')
    if (!body || !signature) {
      return null
    }

    const expectedSignature = b64urlEncode(
      crypto.createHmac('sha256', env.INVOICE_LINK_SECRET_KEY).update(body).digest()
    )

    if (
      signature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expectedSignature, 'utf8'))
    ) {
      return null
    }

    const parsed = JSON.parse(b64urlDecode(body).toString('utf8')) as Partial<InvoiceTokenPayload>
    const id = Number(parsed.id)
    const exp = Number(parsed.exp)
    const purpose = parsed.purpose

    if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(exp)) {
      return null
    }

    if (purpose !== 'view' && purpose !== 'pay') {
      return null
    }

    if (exp < Math.floor(Date.now() / 1000)) {
      return null
    }

    return {
      id,
      exp,
      purpose,
    }
  } catch {
    return null
  }
}

export function encryptInvoiceId(
  id: number,
  purpose: InvoiceTokenPurpose = 'view',
  ttlSeconds = DEFAULT_TTL_SECONDS
): string {
  return signPayload({
    id,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    purpose,
  })
}

export function decryptInvoiceToken(token: string, expectedPurpose?: InvoiceTokenPurpose): number | null {
  const payload = verifyInvoiceToken(token)
  if (!payload) {
    return null
  }
  if (expectedPurpose && payload.purpose !== expectedPurpose) {
    return null
  }
  return payload.id
}

export function getInvoiceLink(invoiceId: number, payment?: string): string {
  const token = encryptInvoiceId(invoiceId, 'view')
  const base = `/invoice?token=${encodeURIComponent(token)}`
  return payment ? `${base}&payment=${encodeURIComponent(payment)}` : base
}

export function getInvoicePayLink(invoiceId: number): string {
  const token = encryptInvoiceId(invoiceId, 'pay')
  return `/invoice/pay?token=${encodeURIComponent(token)}`
}
