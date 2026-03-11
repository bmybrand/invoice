import { redirect } from 'next/navigation'
import Stripe from 'stripe'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY

export default async function InvoicePayReturnPage({
  searchParams,
}: {
  searchParams?: Promise<{ invoice_id?: string; payment_intent?: string }> | { invoice_id?: string; payment_intent?: string }
}) {
  const params = searchParams instanceof Promise ? await searchParams : searchParams
  const invoiceId = Number(params?.invoice_id)

  if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
    redirect('/')
  }

  if (!stripeSecretKey) {
    redirect(`/invoice?id=${invoiceId}&payment=processing`)
  }

  const paymentIntentId = params?.payment_intent
  if (!paymentIntentId) {
    redirect(`/invoice?id=${invoiceId}&payment=processing`)
  }

  const stripe = new Stripe(stripeSecretKey)
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

  if (paymentIntent.status === 'succeeded') {
    redirect(`/invoice?id=${invoiceId}&payment=success`)
  }

  redirect(`/invoice?id=${invoiceId}&payment=processing`)
}
