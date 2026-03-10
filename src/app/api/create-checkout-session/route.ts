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
    const { invoiceId, amount, email, origin: clientOrigin } = await req.json()

    if (!invoiceId || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Invalid invoiceId or amount' }, { status: 400 })
    }

    const amountInCents = Math.round(Number(amount) * 100)
    if (amountInCents < 50) {
      return NextResponse.json({ error: 'Amount must be at least $0.50' }, { status: 400 })
    }

    const origin = req.headers.get('origin') || clientOrigin || req.headers.get('referer')?.replace(/\/$/, '') || 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Invoice #${invoiceId}`,
              description: 'Invoice payment',
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/invoice/pay/return?invoice_id=${invoiceId}`,
      cancel_url: `${origin}/invoice/pay?id=${invoiceId}`,
      customer_email: typeof email === 'string' && email.trim() ? email.trim() : undefined,
      metadata: { invoice_id: String(invoiceId) },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create checkout session'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
