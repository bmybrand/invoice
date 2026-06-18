import { redirect } from 'next/navigation'
import Stripe from 'stripe'
// Token support removed; use invoice_id query param instead
import { findMatchingStripeGatewayForAmount, getInvoicePaymentContext } from '@/lib/server-stripe-gateways'

async function reconcileSuccessfulPayment(
  invoiceContext: Extract<Awaited<ReturnType<typeof getInvoicePaymentContext>>, { ok: true }>,
  paymentIntent: Stripe.PaymentIntent
) {
  const transactionId =
    typeof paymentIntent.latest_charge === 'string'
      ? paymentIntent.latest_charge
      : paymentIntent.latest_charge?.id ?? null

  await Promise.all([
    invoiceContext.supabase
      .from('payment_submissions')
      .update({
        payment_status: paymentIntent.status,
        stripe_transaction_id: transactionId,
      })
      .eq('invoice_id', invoiceContext.invoice.id)
      .eq('stripe_payment_intent_id', paymentIntent.id),
    invoiceContext.supabase
      .from('invoices')
      .update({ status: 'Paid' })
      .eq('id', invoiceContext.invoice.id),
  ])
}

export default async function InvoicePayReturnPage({
  searchParams,
}: {
  searchParams?:
    | Promise<{ token?: string; invoice_id?: string; payment_intent?: string; session_id?: string }>
    | { token?: string; invoice_id?: string; payment_intent?: string; session_id?: string }
}) {
  const params = searchParams instanceof Promise ? await searchParams : searchParams
  const legacyId = params?.invoice_id

  let invoiceId = 0

  if (legacyId) {
    invoiceId = Number(legacyId)
  }

  if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
    redirect('/')
  }

  const invoiceUrl = `/invoice?id=${invoiceId}`

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
      typeof session.payment_intent === 'string'
        ? await stripe.paymentIntents.retrieve(session.payment_intent)
        : session.payment_intent

    if (session.payment_status === 'paid' || sessionPaymentIntent?.status === 'succeeded') {
      if (sessionPaymentIntent?.status === 'succeeded') {
        await reconcileSuccessfulPayment(invoiceContext, sessionPaymentIntent)
      }
      redirect(`${invoiceUrl}&payment=success`)
    }

    redirect(`${invoiceUrl}&payment=processing`)
  }

  if (!paymentIntentId) {
    redirect(`${invoiceUrl}&payment=processing`)
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

  if (paymentIntent.status === 'succeeded') {
    await reconcileSuccessfulPayment(invoiceContext, paymentIntent)
    redirect(`${invoiceUrl}&payment=success`)
  }

  redirect(`${invoiceUrl}&payment=processing`)
}
