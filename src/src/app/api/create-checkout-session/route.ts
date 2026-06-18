import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { findMatchingStripeGatewayForAmount, getInvoicePaymentContext } from '@/lib/server-stripe-gateways'
import { requireBoundInvoiceToken } from '@/lib/server-invoice-access'

export async function POST(req: Request) {
  try {
    const { invoiceId, email, origin: clientOrigin, token } = await req.json()
    const parsedInvoiceId = Number(invoiceId)

    if (!Number.isFinite(parsedInvoiceId) || parsedInvoiceId <= 0) {
      return NextResponse.json({ error: 'Invalid invoice ID' }, { status: 400 })
    }

    const access = requireBoundInvoiceToken(typeof token === 'string' ? token : null, parsedInvoiceId, 'pay')
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const invoiceContext = await getInvoicePaymentContext(parsedInvoiceId)
    if (!invoiceContext.ok) {
      return NextResponse.json({ error: invoiceContext.error }, { status: invoiceContext.status })
    }

    const invoiceStatus = (invoiceContext.invoice.status || '').trim().toLowerCase()
    if (invoiceStatus.includes('paid') || invoiceStatus.includes('completed')) {
      return NextResponse.json({ error: 'This invoice has already been paid' }, { status: 409 })
    }

    const gatewayLookup = await findMatchingStripeGatewayForAmount(invoiceContext.supabase, invoiceContext.amount)
    if (!gatewayLookup.ok) {
      return NextResponse.json({ error: gatewayLookup.error }, { status: gatewayLookup.status })
    }

    const stripe = new Stripe(gatewayLookup.gateway.secretKey)
    const amountInCents = Math.round(invoiceContext.amount * 100)
    if (amountInCents < 50) {
      return NextResponse.json({ error: 'Amount must be at least $0.50' }, { status: 400 })
    }

    const origin = req.headers.get('origin') || clientOrigin || req.headers.get('referer')?.replace(/\/$/, '') || 'http://localhost:3000'
    const encodedToken =
      typeof token === 'string' && token.trim() ? encodeURIComponent(token.trim()) : null
    const successUrl = encodedToken
      ? `${origin}/invoice/pay/return?invoice_id=${parsedInvoiceId}&token=${encodedToken}&session_id={CHECKOUT_SESSION_ID}`
      : `${origin}/invoice/pay/return?invoice_id=${parsedInvoiceId}&session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = encodedToken
      ? `${origin}/invoice/pay?token=${encodedToken}`
      : `${origin}/invoice/pay?invoice_id=${parsedInvoiceId}`

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      client_reference_id: String(parsedInvoiceId),
      line_items: [
        {
          price_data: {
            currency: invoiceContext.currency,
            product_data: {
              name: `Invoice #${parsedInvoiceId}`,
              description: 'Invoice payment',
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: typeof email === 'string' && email.trim() ? email.trim() : undefined,
      metadata: {
        invoice_id: String(parsedInvoiceId),
        gateway_id: gatewayLookup.gateway.id == null ? '' : String(gatewayLookup.gateway.id),
        gateway_name: gatewayLookup.gateway.name,
      },
      payment_intent_data: {
        metadata: {
          invoice_id: String(parsedInvoiceId),
          gateway_id: gatewayLookup.gateway.id == null ? '' : String(gatewayLookup.gateway.id),
          gateway_name: gatewayLookup.gateway.name,
        },
      },
    })

    return NextResponse.json({ url: session.url, gateway: gatewayLookup.gateway.name })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create checkout session'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
