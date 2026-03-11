import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const stripeSecretKey = process.env.STRIPE_SECRET_KEY

const supabase = serviceRoleKey
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)
  : null

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const invoiceId = Number(id)

  if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
    return NextResponse.json({ error: 'Invalid invoice ID' }, { status: 400 })
  }

  if (!supabase) {
    return NextResponse.json(
      { error: 'Server not configured. Add SUPABASE_SERVICE_ROLE_KEY to .env.local' },
      { status: 503 }
    )
  }

  if (!stripe) {
    return NextResponse.json(
      { error: 'Server not configured. Add STRIPE_SECRET_KEY to .env.local' },
      { status: 503 }
    )
  }

  const body = (await req.json().catch(() => null)) as { paymentIntentId?: string } | null
  const paymentIntentId = body?.paymentIntentId?.trim()

  if (!paymentIntentId) {
    return NextResponse.json({ error: 'Missing payment intent ID' }, { status: 400 })
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
  const intentInvoiceId = Number(paymentIntent.metadata?.invoice_id ?? 0)

  if (paymentIntent.status !== 'succeeded') {
    return NextResponse.json({ error: 'Payment is not confirmed yet' }, { status: 409 })
  }

  if (intentInvoiceId !== invoiceId) {
    return NextResponse.json({ error: 'Payment intent does not match this invoice' }, { status: 400 })
  }

  const { error } = await supabase
    .from('invoices')
    .update({ status: 'Paid' })
    .eq('id', invoiceId)

  if (error) {
    console.error('Failed to update invoice status:', error)
    return NextResponse.json({ error: error.message ?? 'Failed to update status' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
