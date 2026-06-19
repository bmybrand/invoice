import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import { readInvoiceToken } from '@/lib/invoice-token'

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

function parseAmountValue(amount: unknown): number {
  const n = Number(String(amount ?? '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function isSuccessfulPaymentStatus(status: string | null | undefined): boolean {
  const normalized = (status || '').trim().toLowerCase()
  return (
    normalized.includes('paid') ||
    normalized.includes('success') ||
    normalized.includes('succeed') ||
    normalized.includes('completed')
  )
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')?.trim() ?? ''

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  const payload = readInvoiceToken(token)
  const expiredPayload = payload ? null : readInvoiceToken(token, { allowExpired: true })
  const resolvedPayload = payload ?? expiredPayload

  if (!resolvedPayload) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const [{ data: invoice, error: invoiceError }, { data: brands, error: brandsError }] = await Promise.all([
    supabase
      .from('invoices')
      .select('*, employees!invoice_creator_id(employee_name), clients!client_id(name)')
      .eq('id', resolvedPayload.id)
      .maybeSingle(),
    supabase
      .from('brands')
      .select('id, brand_name, brand_url, logo_url')
      .neq('isdeleted', true)
      .order('brand_name'),
  ])

  if (invoiceError) {
    return NextResponse.json({ error: invoiceError.message }, { status: 500 })
  }

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  }

  if (brandsError) {
    return NextResponse.json({ error: brandsError.message }, { status: 500 })
  }

  const { data: paymentRows, error: paymentsError } = await supabase
    .from('payment_submissions')
    .select('amount_paid, payment_status')
    .eq('invoice_id', resolvedPayload.id)

  if (paymentsError) {
    return NextResponse.json({ error: paymentsError.message }, { status: 500 })
  }

  const paidAmount = ((paymentRows as Array<{ amount_paid?: unknown; payment_status?: string | null }> | null) ?? []).reduce(
    (sum, payment) => sum + (isSuccessfulPaymentStatus(payment.payment_status) ? parseAmountValue(payment.amount_paid) : 0),
    0
  )

  return NextResponse.json({
    invoice: {
      ...invoice,
      paid_amount: Number(paidAmount.toFixed(2)),
    },
    brands: brands ?? [],
    tokenExpired: !payload && !!expiredPayload,
  })
}
