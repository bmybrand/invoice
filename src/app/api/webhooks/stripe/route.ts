import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = serviceRoleKey
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
  : null

export async function POST(req: Request) {
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  if (!supabase) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set')
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
    console.error('Stripe webhook signature verification failed:', message)
    return NextResponse.json({ error: message }, { status: 400 })
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent
    const invoiceId = paymentIntent.metadata?.invoice_id
    if (invoiceId) {
      const { error } = await supabase.from('invoices').update({ status: 'Paid' }).eq('id', Number(invoiceId))
      if (error) {
        console.error('Failed to update invoice to Paid:', error)
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
      }
    }
  } else if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const invoiceId = session.metadata?.invoice_id
    if (invoiceId) {
      const { error } = await supabase.from('invoices').update({ status: 'Paid' }).eq('id', Number(invoiceId))
      if (error) {
        console.error('Failed to update invoice to Paid:', error)
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ received: true })
}
