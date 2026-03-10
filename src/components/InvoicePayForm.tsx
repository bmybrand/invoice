'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { supabase } from '@/lib/supabase'

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null

const inputClass =
  'mt-1 w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20'

function ContactFields({
  fullName,
  setFullName,
  phoneNumber,
  setPhoneNumber,
  emailAddress,
  setEmailAddress,
  streetAddress,
  setStreetAddress,
  city,
  setCity,
  stateRegion,
  setStateRegion,
  zipCode,
  setZipCode,
}: {
  fullName: string
  setFullName: (v: string) => void
  phoneNumber: string
  setPhoneNumber: (v: string) => void
  emailAddress: string
  setEmailAddress: (v: string) => void
  streetAddress: string
  setStreetAddress: (v: string) => void
  city: string
  setCity: (v: string) => void
  stateRegion: string
  setStateRegion: (v: string) => void
  zipCode: string
  setZipCode: (v: string) => void
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-slate-400">User Information</p>
      <div>
        <label htmlFor="pay-full-name" className="block text-xs font-semibold text-slate-400">
          Your Name
        </label>
        <input
          id="pay-full-name"
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className={inputClass}
          placeholder="Full name"
        />
      </div>
      <div>
        <label htmlFor="pay-phone" className="block text-xs font-semibold text-slate-400">
          Your Phone
        </label>
        <input
          id="pay-phone"
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          className={inputClass}
          placeholder="(555) 000-0000"
        />
      </div>
      <div>
        <label htmlFor="pay-email" className="block text-xs font-semibold text-slate-400">
          Your Email
        </label>
        <input
          id="pay-email"
          type="email"
          value={emailAddress}
          onChange={(e) => setEmailAddress(e.target.value)}
          className={inputClass}
          placeholder="email@example.com"
        />
      </div>
      <div>
        <label htmlFor="pay-address" className="block text-xs font-semibold text-slate-400">
          Your Address
        </label>
        <textarea
          id="pay-address"
          value={streetAddress}
          onChange={(e) => setStreetAddress(e.target.value)}
          rows={3}
          className={inputClass}
          placeholder="Street number and name..."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="pay-city" className="block text-xs font-semibold text-slate-400">
            City
          </label>
          <input
            id="pay-city"
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className={inputClass}
            placeholder="City"
          />
        </div>
        <div>
          <label htmlFor="pay-state" className="block text-xs font-semibold text-slate-400">
            State
          </label>
          <input
            id="pay-state"
            type="text"
            value={stateRegion}
            onChange={(e) => setStateRegion(e.target.value)}
            className={inputClass}
            placeholder="State"
          />
        </div>
        <div>
          <label htmlFor="pay-zip" className="block text-xs font-semibold text-slate-400">
            Zip Code
          </label>
          <input
            id="pay-zip"
            type="text"
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value)}
            className={inputClass}
            placeholder="Zip"
          />
        </div>
      </div>
    </div>
  )
}

type InvoicePayFormProps = {
  invoiceId: number
  grandTotal: number
  invoiceTitle?: string
  initialEmail?: string
  initialPhone?: string
}

function PaymentFormInner({
  invoiceId,
  grandTotal,
  fullName,
  setFullName,
  phoneNumber,
  setPhoneNumber,
  emailAddress,
  setEmailAddress,
  streetAddress,
  setStreetAddress,
  city,
  setCity,
  stateRegion,
  setStateRegion,
  zipCode,
  setZipCode,
}: {
  invoiceId: number
  grandTotal: number
  fullName: string
  setFullName: (v: string) => void
  phoneNumber: string
  setPhoneNumber: (v: string) => void
  emailAddress: string
  setEmailAddress: (v: string) => void
  streetAddress: string
  setStreetAddress: (v: string) => void
  city: string
  setCity: (v: string) => void
  stateRegion: string
  setStateRegion: (v: string) => void
  zipCode: string
  setZipCode: (v: string) => void
}) {
  const router = useRouter()
  const stripe = useStripe()
  const elements = useElements()
  const [paying, setPaying] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [paymentSubmitted, setPaymentSubmitted] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (
      !fullName.trim() ||
      !phoneNumber.trim() ||
      !emailAddress.trim() ||
      !streetAddress.trim() ||
      !city.trim() ||
      !stateRegion.trim() ||
      !zipCode.trim()
    ) {
      setPaymentError('Please fill in all contact and address fields.')
      return
    }

    if (!stripe || !elements) return

    setPaying(true)
    setPaymentError(null)

    const { error: insertError } = await supabase.from('payment_submissions').insert({
      invoice_id: invoiceId,
      full_name: fullName.trim(),
      phone: phoneNumber.trim(),
      email: emailAddress.trim(),
      street_address: streetAddress.trim(),
      city: city.trim(),
      state_region: stateRegion.trim(),
      zip_code: zipCode.trim(),
      name_on_card: null,
      card_last4: null,
      card_expiry_month: null,
      card_expiry_year: null,
      amount_paid: grandTotal,
    })

    if (insertError) {
      setPaying(false)
      console.error('Failed to save payment data', insertError)
      setPaymentError('Could not save payment details. Please try again.')
      return
    }

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: {
        return_url: `${typeof window !== 'undefined' ? window.location.origin : ''}/invoice/pay/return?invoice_id=${invoiceId}`,
        receipt_email: emailAddress.trim(),
        payment_method_data: {
          billing_details: {
            name: fullName.trim(),
            email: emailAddress.trim(),
            phone: phoneNumber.trim(),
            address: {
              line1: streetAddress.trim(),
              city: city.trim(),
              state: stateRegion.trim(),
              postal_code: zipCode.trim(),
            },
          },
        },
      },
    })

    if (confirmError) {
      setPaying(false)
      const msg = confirmError.message ?? 'Payment could not be completed. Please try again.'
      console.error('Stripe payment error:', confirmError)
      setPaymentError(
        msg === 'A processing error occurred.'
          ? 'Payment could not be processed. Try card 4242 4242 4242 4242, or check amount is at least $0.50.'
          : msg
      )
      return
    }

    const res = await fetch(`/api/invoices/${invoiceId}/mark-paid`, { method: 'POST' })
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      const msg = data?.error ?? `Request failed (${res.status})`
      console.error('Failed to update invoice status', res.status, msg)
      setPaymentError(
        msg.startsWith('Server not configured') || msg.includes('Processing') || msg.includes('migration')
          ? msg
          : 'Payment submitted but status could not be updated. Please contact support.'
      )
      setPaying(false)
      return
    }

    setPaying(false)
    setPaymentSubmitted(true)
  }

  if (paymentSubmitted) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center">
        <h2 className="text-xl font-bold text-emerald-400">Your payment is being processed</h2>
        <p className="mt-2 text-sm text-slate-400">
          You will receive a confirmation once the payment is complete. You can close this page or return to view the invoice.
        </p>
        <button
          type="button"
          onClick={() => router.push(`/invoice?id=${invoiceId}`)}
          className="mt-6 rounded-xl bg-orange-600 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-700"
        >
          View Invoice
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <ContactFields
            fullName={fullName}
            setFullName={setFullName}
            phoneNumber={phoneNumber}
            setPhoneNumber={setPhoneNumber}
            emailAddress={emailAddress}
            setEmailAddress={setEmailAddress}
            streetAddress={streetAddress}
            setStreetAddress={setStreetAddress}
            city={city}
            setCity={setCity}
            stateRegion={stateRegion}
            setStateRegion={setStateRegion}
            zipCode={zipCode}
            setZipCode={setZipCode}
          />
        </div>
        <div className="space-y-4">
          <p className="text-sm font-semibold text-slate-400">Payment Details</p>
          <div className="rounded-xl border border-slate-600 bg-slate-900 p-4">
            <PaymentElement
              options={{
                layout: 'tabs',
                appearance: {
                  theme: 'night',
                  variables: {
                    colorPrimary: '#ea580c',
                    colorBackground: '#0f172a',
                    colorText: '#f8fafc',
                    colorDanger: '#ef4444',
                    borderRadius: '12px',
                  },
                },
              }}
            />
          </div>
        </div>
      </div>
      {paymentError && (
        <p className="rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {paymentError}
        </p>
      )}
      <div className="flex items-center justify-between gap-4 border-t border-slate-700 pt-6">
        <p className="text-lg font-bold text-white">
          Total: ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <button
          type="submit"
          disabled={paying || !stripe || !elements}
          className="rounded-xl bg-orange-600 px-8 py-3 text-sm font-semibold text-white shadow-[0px_4px_20px_0px_rgba(249,115,22,0.2)] hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {paying ? 'Processing...' : 'Pay Now'}
        </button>
      </div>
    </form>
  )
}

export default function InvoicePayForm({
  invoiceId,
  grandTotal,
  invoiceTitle,
  initialEmail = '',
  initialPhone = '',
}: InvoicePayFormProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loadingPayment, setLoadingPayment] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState(initialPhone)
  const [emailAddress, setEmailAddress] = useState(initialEmail)
  const [streetAddress, setStreetAddress] = useState('')
  const [city, setCity] = useState('')
  const [stateRegion, setStateRegion] = useState('')
  const [zipCode, setZipCode] = useState('')

  async function handleContinueToPayment() {
    if (
      !fullName.trim() ||
      !phoneNumber.trim() ||
      !emailAddress.trim() ||
      !streetAddress.trim() ||
      !city.trim() ||
      !stateRegion.trim() ||
      !zipCode.trim()
    ) {
      setLoadError('Please fill in all contact and address fields.')
      return
    }
    setLoadError(null)
    setLoadingPayment(true)
    try {
      const res = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId, amount: grandTotal }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create payment')
      setClientSecret(data.clientSecret)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load payment form')
    } finally {
      setLoadingPayment(false)
    }
  }

  if (!stripePublishableKey) {
    return (
      <div className="mx-auto max-w-4xl p-4 sm:p-6">
        <p className="rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          Payment form is not configured. Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to .env.local
        </p>
      </div>
    )
  }

  if (!clientSecret) {
    return (
      <div className="mx-auto max-w-4xl p-4 sm:p-6">
        {invoiceTitle && (
          <p className="mb-6 text-sm font-semibold text-slate-400">{invoiceTitle}</p>
        )}
        <div className="rounded-2xl border border-slate-700 bg-slate-800/80 p-6 sm:p-8">
          <h1 className="mb-8 text-xl font-bold text-white">Your Information</h1>
          <ContactFields
            fullName={fullName}
            setFullName={setFullName}
            phoneNumber={phoneNumber}
            setPhoneNumber={setPhoneNumber}
            emailAddress={emailAddress}
            setEmailAddress={setEmailAddress}
            streetAddress={streetAddress}
            setStreetAddress={setStreetAddress}
            city={city}
            setCity={setCity}
            stateRegion={stateRegion}
            setStateRegion={setStateRegion}
            zipCode={zipCode}
            setZipCode={setZipCode}
          />
          {loadError && (
            <p className="mt-4 rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {loadError}
            </p>
          )}
          <div className="mt-8 flex items-center justify-between gap-4 border-t border-slate-700 pt-6">
            <p className="text-lg font-bold text-white">
              Total: ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <button
              type="button"
              onClick={handleContinueToPayment}
              disabled={loadingPayment}
              className="rounded-xl bg-orange-600 px-8 py-3 text-sm font-semibold text-white shadow-[0px_4px_20px_0px_rgba(249,115,22,0.2)] hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingPayment ? 'Loading...' : 'Continue to Payment'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const options = {
    clientSecret,
    appearance: {
      theme: 'night' as const,
      variables: {
        colorPrimary: '#ea580c',
        colorBackground: '#0f172a',
        colorText: '#f8fafc',
        borderRadius: '12px',
      },
    },
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      {invoiceTitle && (
        <p className="mb-6 text-sm font-semibold text-slate-400">{invoiceTitle}</p>
      )}
      <div className="rounded-2xl border border-slate-700 bg-slate-800/80 p-6 sm:p-8">
        <h1 className="mb-8 text-xl font-bold text-white">Your Information</h1>
        <Elements stripe={stripePromise!} options={options}>
          <PaymentFormInner
            invoiceId={invoiceId}
            grandTotal={grandTotal}
            fullName={fullName}
            setFullName={setFullName}
            phoneNumber={phoneNumber}
            setPhoneNumber={setPhoneNumber}
            emailAddress={emailAddress}
            setEmailAddress={setEmailAddress}
            streetAddress={streetAddress}
            setStreetAddress={setStreetAddress}
            city={city}
            setCity={setCity}
            stateRegion={stateRegion}
            setStateRegion={setStateRegion}
            zipCode={zipCode}
            setZipCode={setZipCode}
          />
        </Elements>
      </div>
    </div>
  )
}
