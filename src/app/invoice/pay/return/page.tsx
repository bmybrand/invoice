import { redirect } from 'next/navigation'
import Stripe from 'stripe'
import { decryptInvoiceToken } from '@/lib/invoice-token'
import { findMatchingStripeGatewayForAmount, getInvoicePaymentContext } from '@/lib/server-stripe-gateways'

export default async function InvoicePayReturnPage({
  searchParams,
}: {
  searchParams?:
    | Promise<{ token?: string; invoice_id?: string; payment_intent?: string; session_id?: string }>
    | { token?: string; invoice_id?: string; payment_intent?: string; session_id?: string }
}) {
  const params = searchParams instanceof Promise ? await searchParams : searchParams
  const tokenParam = params?.token
  const legacyId = params?.invoice_id

  let invoiceToken: string | null = null
  let invoiceId = 0

  if (tokenParam) {
    invoiceId = decryptInvoiceToken(tokenParam) ?? 0
    if (invoiceId > 0) invoiceToken = tokenParam
  } else if (legacyId) {
    invoiceId = Number(legacyId)
  }

  if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
    redirect('/')
  }

  const invoiceUrl = invoiceToken
    ? `/invoice?token=${encodeURIComponent(invoiceToken)}`
    : `/invoice?id=${invoiceId}`

  const invoiceContext = await getInvoicePaymentContext(invoiceId)
  if (!invoiceContext.ok) {
    redirect(`${invoiceUrl}&payment=processing`)
  }

  const gatewayLookup = await findMatchingStripeGatewayForAmount(invoiceContext.supabase, invoiceContext.amount)
  if (!gatewayLookup.ok) {
    redirect(`${invoiceUrl}&payment=processing`)
  }

  const stripe = new Stripe(gatewayLookup.gateway.secretKey)
  const sessionId = params?.session_id?.trim()
  const paymentIntentId = params?.payment_intent

  if (sessionId) {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    })
    const sessionPaymentIntent =
      typeof session.payment_intent === 'string' ? null : session.payment_intent

    if (session.payment_status === 'paid' || sessionPaymentIntent?.status === 'succeeded') {
      redirect(`${invoiceUrl}&payment=success`)
    }

    redirect(`${invoiceUrl}&payment=processing`)
  }

  if (!paymentIntentId) {
    redirect(`${invoiceUrl}&payment=processing`)
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

  if (paymentIntent.status === 'succeeded') {
    redirect(`${invoiceUrl}&payment=success`)
  }

  redirect(`${invoiceUrl}&payment=processing`)
}
