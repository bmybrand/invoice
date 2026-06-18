'use server'

import { encryptInvoiceId, getInvoiceLink as getLink, getInvoicePayLink as getPayLink } from '@/lib/invoice-token'

export async function getInvoiceToken(invoiceId: number): Promise<string | null> {
  if (!Number.isFinite(invoiceId) || invoiceId <= 0) return null
  return encryptInvoiceId(invoiceId)
}

export async function getInvoiceLink(invoiceId: number, payment?: string): Promise<string> {
  return getLink(invoiceId, payment)
}

export async function getInvoicePayLink(invoiceId: number): Promise<string> {
  return getPayLink(invoiceId)
}
