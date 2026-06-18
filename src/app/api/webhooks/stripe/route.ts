import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

const stripe = new Stripe(env.STRIPE_SECRET_KEY)
const webhookSecret = env.STRIPE_WEBHOOK_SECRET
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

const supabase = serviceRoleKey
  ? createClient(env.SUPABASE_URL, serviceRoleKey)
  : null

async function markInvoicePaid(invoiceId: number) {
  const { error } = await supabase!.from('invoices').update({ status: 'Paid' }).eq('id', invoiceId)
  if (error) {
    logger.error('Failed to update invoice to Paid', { invoiceId, error: error.message })
    return false
  }
  return true
}

async function updatePaymentSubmissionByIntent(
  paymentIntentId: string,
  status: string,
  stripeTransactionId: string | null
) {
  const { data: paymentSubmission, error: paymentLookupError } = await supabase!
    .from('payment_submissions')
    .select('id, stripe_transaction_id')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (paymentLookupError) {
    logger.error('Failed to load payment submission for intent', {
      paymentIntentId,
      error: paymentLookupError.message,
    })
    return
  }

  if (!paymentSubmission?.id) {
    return
  }

  const nextTransactionId = stripeTransactionId || paymentSubmission.stripe_transaction_id || null
  const { error: paymentSubmissionError } = await supabase!
    .from('payment_submissions')
    .update({
      payment_method: 'Stripe',
      payment_status: status,
      stripe_payment_intent_id: paymentIntentId,
      stripe_transaction_id: nextTransactionId,
    })
    .eq('id', paymentSubmission.id)

  if (paymentSubmissionError) {
    logger.error('Failed to update payment submission from webhook', {
      paymentIntentId,
      error: paymentSubmissionError.message,
    })
  }
}

export async function POST(req: Request) {
  if (!webhookSecret) {
    logger.error('STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  if (!supabase) {
    logger.error('SUPABASE_SERVICE_ROLE_KEY is not set')
    return NextResponse.json({ error: 'Webhook database client is not configured' }, { status: 500 })
  }

  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature'
    logger.error('Stripe webhook signature verification failed', { error: message })
    return NextResponse.json({ error: message }, { status: 400 })
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent
    const invoiceId = paymentIntent.metadata?.invoice_id
    if (invoiceId) {
      const updated = await markInvoicePaid(Number(invoiceId))
      if (!updated) {
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
      }

      const stripeTransactionId =
        typeof paymentIntent.latest_charge === 'string'
          ? paymentIntent.latest_charge
          : paymentIntent.latest_charge?.id ?? null

      await updatePaymentSubmissionByIntent(paymentIntent.id, paymentIntent.status, stripeTransactionId)
    }
  } else if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const invoiceId = session.metadata?.invoice_id
    if (invoiceId) {
      const updated = await markInvoicePaid(Number(invoiceId))
      if (!updated) {
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
      }

      const sessionPaymentIntentId =
        typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id

      if (sessionPaymentIntentId) {
        await updatePaymentSubmissionByIntent(sessionPaymentIntentId, 'succeeded', null)
      }
    }
  }

  return NextResponse.json({ received: true })
}
