import { NextResponse } from 'next/server'
import Stripe from 'stripe'

const secretKey = process.env.STRIPE_SECRET_KEY
const stripe = secretKey ? new Stripe(secretKey) : null

export async function POST(req: Request) {
  if (!stripe) {
    return NextResponse.json(
      { error: 'Stripe is not configured. Add STRIPE_SECRET_KEY to .env.local' },
      { status: 503 }
    )
  }

  try {
    const { invoiceId, amount } = await req.json()

    if (!invoiceId || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Invalid invoiceId or amount' }, { status: 400 })
    }

    const amountInCents = Math.round(Number(amount) * 100)
    if (amountInCents < 50) {
      return NextResponse.json({ error: 'Amount must be at least $0.50' }, { status: 400 })
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: { invoice_id: String(invoiceId) },
    })

    return NextResponse.json({ clientSecret: paymentIntent.client_secret })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create payment intent'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
