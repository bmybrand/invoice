import { redirect } from 'next/navigation'
import Stripe from 'stripe'
import { decryptInvoiceToken } from '@/lib/invoice-token'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY

export default async function InvoicePayReturnPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string; invoice_id?: string; payment_intent?: string }> | { token?: string; invoice_id?: string; payment_intent?: string }
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

  if (!stripeSecretKey) {
    redirect(`${invoiceUrl}&payment=processing`)
  }

  const paymentIntentId = params?.payment_intent
  if (!paymentIntentId) {
    redirect(`${invoiceUrl}&payment=processing`)
  }

  const stripe = new Stripe(stripeSecretKey)
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

  if (paymentIntent.status === 'succeeded') {
    redirect(`${invoiceUrl}&payment=success`)
  }

  redirect(`${invoiceUrl}&payment=processing`)
}
