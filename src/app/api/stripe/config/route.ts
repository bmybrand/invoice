import { NextResponse } from 'next/server'
import { findMatchingStripeGatewayForAmount, getInvoicePaymentContext } from '@/lib/server-stripe-gateways'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const invoiceId = Number(url.searchParams.get('invoiceId') ?? '')

  if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
    return NextResponse.json({ error: 'Invalid invoice ID' }, { status: 400 })
  }

  const invoiceContext = await getInvoicePaymentContext(invoiceId)
  if (!invoiceContext.ok) {
    return NextResponse.json({ error: invoiceContext.error }, { status: invoiceContext.status })
  }

  const gatewayLookup = await findMatchingStripeGatewayForAmount(invoiceContext.supabase, invoiceContext.amount)
  if (!gatewayLookup.ok) {
    return NextResponse.json({ error: gatewayLookup.error }, { status: gatewayLookup.status })
  }

  if (!gatewayLookup.gateway.publishableKey) {
    return NextResponse.json(
      { error: 'Stripe publishable key is not configured for the selected gateway' },
      { status: 503 }
    )
  }

  return NextResponse.json({
    publishableKey: gatewayLookup.gateway.publishableKey,
    gateway: gatewayLookup.gateway.name,
    source: gatewayLookup.gateway.source,
    warning:
      gatewayLookup.gateway.source === 'environment'
        ? 'No active matching payment gateway was found in settings. Falling back to environment Stripe keys.'
        : null,
  })
}
