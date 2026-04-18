import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { findMatchingStripeGatewayForAmount, getInvoicePaymentContext } from '@/lib/server-stripe-gateways'
import { requireBoundInvoiceToken } from '@/lib/server-invoice-access'

type PaymentIntentRequestBody = {
  invoiceId?: number | string
  token?: string
  fullName?: string
  phoneNumber?: string
  emailAddress?: string
  streetAddress?: string
  city?: string
  stateRegion?: string
  zipCode?: string
}

export async function POST(req: Request) {
  try {
    const {
      invoiceId,
      token,
      fullName,
      phoneNumber,
      emailAddress,
      streetAddress,
      city,
      stateRegion,
      zipCode,
    } = (await req.json()) as PaymentIntentRequestBody
    const parsedInvoiceId = Number(invoiceId)

    if (!Number.isFinite(parsedInvoiceId) || parsedInvoiceId <= 0) {
      return NextResponse.json({ error: 'Invalid invoice ID' }, { status: 400 })
    }

    const payerName = String(fullName ?? '').trim()
    const payerPhone = String(phoneNumber ?? '').trim()
    const payerEmail = String(emailAddress ?? '').trim()
    const payerStreet = String(streetAddress ?? '').trim()
    const payerCity = String(city ?? '').trim()
    const payerState = String(stateRegion ?? '').trim()
    const payerZip = String(zipCode ?? '').trim()

    if (!payerName || !payerPhone || !payerEmail || !payerStreet || !payerCity || !payerState || !payerZip) {
      return NextResponse.json({ error: 'Missing payment contact details' }, { status: 400 })
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

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      receipt_email: payerEmail,
      metadata: {
        invoice_id: String(parsedInvoiceId),
        gateway_id: gatewayLookup.gateway.id == null ? '' : String(gatewayLookup.gateway.id),
        gateway_name: gatewayLookup.gateway.name,
      },
    })

    const { error: paymentSubmissionError } = await invoiceContext.supabase.from('payment_submissions').insert({
      invoice_id: parsedInvoiceId,
      full_name: payerName,
      phone: payerPhone,
      email: payerEmail,
      street_address: payerStreet,
      city: payerCity,
      state_region: payerState,
      zip_code: payerZip,
      amount_paid: invoiceContext.amount,
      payment_method: 'Stripe',
      payment_status: paymentIntent.status,
      stripe_payment_intent_id: paymentIntent.id,
      stripe_transaction_id: null,
      name_on_card: null,
      card_last4: null,
      card_expiry_month: null,
      card_expiry_year: null,
    })

    if (paymentSubmissionError) {
      await stripe.paymentIntents.cancel(paymentIntent.id).catch(() => undefined)
      return NextResponse.json(
        { error: paymentSubmissionError.message || 'Failed to save payment details' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      gateway: gatewayLookup.gateway.name,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create payment intent'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
