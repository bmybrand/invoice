import { NextResponse } from 'next/server'
import { getInvoicePaymentContext, retrieveInvoicePaymentIntent } from '@/lib/server-stripe-gateways'

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    invoiceId?: number | string
    paymentIntentId?: string
  } | null
  const invoiceId = Number(body?.invoiceId)
  const paymentIntentId = String(body?.paymentIntentId ?? '').trim()

  if (!Number.isFinite(invoiceId) || invoiceId <= 0 || !paymentIntentId) {
    return NextResponse.json({ error: 'Invalid payment reconciliation request' }, { status: 400 })
  }

  const invoiceContext = await getInvoicePaymentContext(invoiceId)
  if (!invoiceContext.ok) {
    return NextResponse.json({ error: invoiceContext.error }, { status: invoiceContext.status })
  }

  const paymentLookup = await retrieveInvoicePaymentIntent(
    invoiceContext.supabase,
    invoiceId,
    invoiceContext.amount,
    paymentIntentId
  )
  if (!paymentLookup.ok) {
    return NextResponse.json({ error: paymentLookup.error }, { status: paymentLookup.status })
  }

  const paymentIntent = paymentLookup.paymentIntent

  const transactionId =
    typeof paymentIntent.latest_charge === 'string'
      ? paymentIntent.latest_charge
      : paymentIntent.latest_charge?.id ?? null

  const { error: submissionError } = await invoiceContext.supabase
    .from('payment_submissions')
    .update({
      payment_status: paymentIntent.status,
      stripe_transaction_id: transactionId,
    })
    .eq('invoice_id', invoiceId)
    .eq('stripe_payment_intent_id', paymentIntent.id)

  if (submissionError) {
    return NextResponse.json({ error: submissionError.message }, { status: 500 })
  }

  if (paymentIntent.status !== 'succeeded') {
    return NextResponse.json({ status: paymentIntent.status })
  }

  const { error: invoiceError } = await invoiceContext.supabase
    .from('invoices')
    .update({ status: 'Paid' })
    .eq('id', invoiceId)

  if (invoiceError) {
    return NextResponse.json({ error: invoiceError.message }, { status: 500 })
  }

  return NextResponse.json({ status: paymentIntent.status })
}
