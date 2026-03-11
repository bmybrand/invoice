'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js'
import { supabase } from '@/lib/supabase'

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null

const inputClass =
  'mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-sm text-white placeholder:text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20'

const COUNTRY_OPTIONS = [
  { code: 'US', label: 'United States' },
  { code: 'CA', label: 'Canada' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'AU', label: 'Australia' },
  { code: 'NZ', label: 'New Zealand' },
  { code: 'AE', label: 'United Arab Emirates' },
  { code: 'SA', label: 'Saudi Arabia' },
  { code: 'PK', label: 'Pakistan' },
  { code: 'IN', label: 'India' },
] as const

function normalizeCountryCode(value: string): string {
  return value.trim().toUpperCase()
}

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
  setFullName: (value: string) => void
  phoneNumber: string
  setPhoneNumber: (value: string) => void
  emailAddress: string
  setEmailAddress: (value: string) => void
  streetAddress: string
  setStreetAddress: (value: string) => void
  city: string
  setCity: (value: string) => void
  stateRegion: string
  setStateRegion: (value: string) => void
  zipCode: string
  setZipCode: (value: string) => void
}) {
  return (
    <div className="rounded-[28px] border border-slate-700/80 bg-[linear-gradient(180deg,rgba(15,23,42,0.96)_0%,rgba(2,6,23,0.96)_100%)] p-5 shadow-[0_22px_50px_rgba(2,6,23,0.28)] sm:p-6">
      <div className="mb-5 flex items-center gap-3 border-b border-slate-800 pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-400">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.118a7.5 7.5 0 0115 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.5-1.632z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">User Information</p>
          <p className="text-xs text-slate-500">Billing and contact details for this payment.</p>
        </div>
      </div>
      <div className="space-y-4">
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
      <div className="grid gap-4 sm:grid-cols-2">
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
    </div>
  )
}

type InvoicePayFormProps = {
  invoiceId: number
  grandTotal: number
  invoiceTitle?: string
  initialEmail?: string
  initialPhone?: string
  embedded?: boolean
  onPaymentSuccess?: () => void
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
  country,
  setCountry,
  stateRegion,
  setStateRegion,
  zipCode,
  setZipCode,
  embedded,
  onPaymentSuccess,
}: {
  invoiceId: number
  grandTotal: number
  fullName: string
  setFullName: (value: string) => void
  phoneNumber: string
  setPhoneNumber: (value: string) => void
  emailAddress: string
  setEmailAddress: (value: string) => void
  streetAddress: string
  setStreetAddress: (value: string) => void
  city: string
  setCity: (value: string) => void
  country: string
  setCountry: (value: string) => void
  stateRegion: string
  setStateRegion: (value: string) => void
  zipCode: string
  setZipCode: (value: string) => void
  embedded: boolean
  onPaymentSuccess?: () => void
}) {
  const router = useRouter()
  const stripe = useStripe()
  const elements = useElements()
  const [paying, setPaying] = useState(false)
  const submitLockRef = useRef(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [paymentSubmitted, setPaymentSubmitted] = useState(false)
  const [paymentSubmittedTitle, setPaymentSubmittedTitle] = useState('Your payment is being processed')
  const [paymentSubmittedMessage, setPaymentSubmittedMessage] = useState(
    'You will receive a confirmation once the payment is complete. You can close this page or return to view the invoice.'
  )
  const [submittedPaymentStatus, setSubmittedPaymentStatus] = useState<'succeeded' | 'processing'>('processing')

  useEffect(() => {
    if (!paymentSubmitted) return

    const timeoutId = window.setTimeout(() => {
      if (submittedPaymentStatus === 'succeeded') {
        onPaymentSuccess?.()
        if (!embedded) {
          router.replace(`/invoice?id=${invoiceId}&payment=success`)
        }
        return
      }

      if (!embedded) {
        router.replace(`/invoice?id=${invoiceId}&payment=processing`)
      }
    }, 1600)

    return () => window.clearTimeout(timeoutId)
  }, [embedded, invoiceId, onPaymentSuccess, paymentSubmitted, router, submittedPaymentStatus])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (submitLockRef.current || paying) {
      return
    }

    if (
      !fullName.trim() ||
      !phoneNumber.trim() ||
      !emailAddress.trim() ||
      !streetAddress.trim() ||
      !city.trim() ||
      !country.trim() ||
      !stateRegion.trim() ||
      !zipCode.trim()
    ) {
      setPaymentError('Please fill in all contact and address fields.')
      return
    }

    const countryCode = normalizeCountryCode(country)
    if (!/^[A-Z]{2}$/.test(countryCode)) {
      setPaymentError('Country must be a 2-letter code such as US.')
      return
    }

    if (!stripe || !elements) return

    const cardElement = elements.getElement(CardElement)
    if (!cardElement) {
      setPaymentError('Card form is not ready yet. Please try again.')
      return
    }

    submitLockRef.current = true
    setPaying(true)
    setPaymentError(null)

    let clientSecret: string

    try {
      const res = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId, amount: grandTotal }),
      })
      const data = (await res.json().catch(() => ({}))) as { clientSecret?: string; error?: string }
      if (!res.ok || !data.clientSecret) {
        throw new Error(data.error ?? 'Failed to create payment')
      }
      clientSecret = data.clientSecret
    } catch (err) {
      submitLockRef.current = false
      setPaying(false)
      setPaymentError(err instanceof Error ? err.message : 'Failed to start payment. Please try again.')
      return
    }

    const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: cardElement,
        billing_details: {
          name: fullName.trim(),
          email: emailAddress.trim(),
          phone: phoneNumber.trim(),
          address: {
            line1: streetAddress.trim(),
            city: city.trim(),
            country: countryCode,
            state: stateRegion.trim(),
            postal_code: zipCode.trim(),
          },
        },
      },
      receipt_email: emailAddress.trim(),
    })

    if (confirmError) {
      submitLockRef.current = false
      setPaying(false)
      const msg = confirmError.message ?? 'Payment could not be completed. Please try again.'
      console.error('Stripe payment error:', {
        type: confirmError.type,
        code: 'code' in confirmError ? confirmError.code : undefined,
        decline_code: 'decline_code' in confirmError ? confirmError.decline_code : undefined,
        message: confirmError.message,
      })
      setPaymentError(
        msg === 'A processing error occurred.'
          ? 'Payment could not be processed. Try card 4242 4242 4242 4242, or check amount is at least $0.50.'
          : msg
      )
      return
    }

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
      submitLockRef.current = false
      console.error('Failed to save payment data', insertError)
      setPaymentError('Payment succeeded, but we could not save the payment details. Please contact support.')
      setPaying(false)
      return
    }

    const paymentStatus = paymentIntent?.status ?? 'processing'

    if (paymentStatus === 'succeeded') {
      const paymentIntentId = paymentIntent?.id

      if (!paymentIntentId) {
        submitLockRef.current = false
        setPaymentError('Payment succeeded, but the payment intent could not be verified. Please contact support.')
        setPaying(false)
        return
      }

      const res = await fetch(`/api/invoices/${invoiceId}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIntentId }),
      })

      if (!res.ok) {
        submitLockRef.current = false
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setPaymentError(data.error ?? 'Failed to update invoice status.')
        setPaying(false)
        return
      }

      setSubmittedPaymentStatus('succeeded')
      setPaymentSubmittedTitle('Payment submitted successfully')
      setPaymentSubmittedMessage('Your payment has been confirmed.')
    } else {
      setSubmittedPaymentStatus('processing')
      setPaymentSubmittedTitle('Your payment is being processed')
      setPaymentSubmittedMessage(
        'You will receive a confirmation once the payment is complete. You can close this page or return to view the invoice.'
      )
    }

    setPaying(false)
    setPaymentSubmitted(true)
  }

  if (paymentSubmitted) {
    return (
      <div className="rounded-[28px] border border-emerald-500/30 bg-[linear-gradient(180deg,rgba(6,95,70,0.22)_0%,rgba(6,78,59,0.12)_100%)] p-8 text-center shadow-[0_22px_60px_rgba(6,78,59,0.22)]">
        <h2 className="text-xl font-bold text-emerald-400">{paymentSubmittedTitle}</h2>
        <p className="mt-2 text-sm text-slate-400">{paymentSubmittedMessage}</p>
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
        <div className="rounded-[28px] border border-slate-700/80 bg-[linear-gradient(180deg,rgba(15,23,42,0.96)_0%,rgba(2,6,23,0.96)_100%)] p-5 shadow-[0_22px_50px_rgba(2,6,23,0.28)] sm:p-6">
          <div className="mb-5 flex items-center gap-3 border-b border-slate-800 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M3.75 6h16.5A1.5 1.5 0 0121.75 7.5v9A1.5 1.5 0 0120.25 18h-16.5a1.5 1.5 0 01-1.5-1.5v-9A1.5 1.5 0 013.75 6z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Payment Details</p>
              <p className="text-xs text-slate-500">Secure card payment powered by Stripe.</p>
            </div>
          </div>
          <div className="rounded-[24px] border border-slate-700 bg-[linear-gradient(135deg,rgba(30,41,59,0.98)_0%,rgba(15,23,42,0.98)_50%,rgba(2,6,23,0.98)_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Card</p>
                <p className="mt-1 text-lg font-bold text-white">Debit or Credit Card</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Secure</span>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-600 bg-slate-950/80 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <CardElement
                options={{
                  hidePostalCode: true,
                  style: {
                    base: {
                      color: '#f8fafc',
                      fontSize: '16px',
                      fontFamily: 'system-ui, sans-serif',
                      '::placeholder': {
                        color: '#64748b',
                      },
                    },
                    invalid: {
                      color: '#f87171',
                    },
                  },
                }}
              />
            </div>
            <div className="mt-4">
              <label htmlFor="pay-country" className="block text-xs font-semibold text-slate-400">
                Country
              </label>
              <select
                id="pay-country"
                value={country}
                onChange={(e) => setCountry(normalizeCountryCode(e.target.value))}
                className={inputClass}
              >
                {COUNTRY_OPTIONS.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label} ({option.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl border border-slate-700 bg-slate-900/70 px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Network</p>
                <p className="mt-1 text-xs font-semibold text-slate-300">Visa / MC</p>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-900/70 px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Protection</p>
                <p className="mt-1 text-xs font-semibold text-slate-300">3D Secure</p>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-900/70 px-3 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Gateway</p>
                <p className="mt-1 text-xs font-semibold text-slate-300">Stripe</p>
              </div>
            </div>
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
          className="rounded-2xl bg-[linear-gradient(135deg,#f97316_0%,#ea580c_100%)] px-8 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(249,115,22,0.28)] hover:from-orange-600 hover:to-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
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
  embedded = false,
  onPaymentSuccess,
}: InvoicePayFormProps) {
  const [fullName, setFullName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState(initialPhone)
  const [emailAddress, setEmailAddress] = useState(initialEmail)
  const [streetAddress, setStreetAddress] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('US')
  const [stateRegion, setStateRegion] = useState('')
  const [zipCode, setZipCode] = useState('')

  if (!stripePublishableKey) {
    return (
      <div className={embedded ? 'w-full' : 'mx-auto max-w-4xl p-4 sm:p-6'}>
        <p className="rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          Payment form is not configured. Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to .env.local
        </p>
      </div>
    )
  }

  return (
    <div className={embedded ? 'w-full' : 'mx-auto max-w-4xl p-4 sm:p-6'}>
      {invoiceTitle && <p className="mb-6 text-sm font-semibold text-slate-400">{invoiceTitle}</p>}
      <div className={`relative overflow-hidden rounded-[32px] border border-slate-700 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.10),transparent_28%),linear-gradient(180deg,rgba(30,41,59,0.92)_0%,rgba(15,23,42,0.96)_100%)] shadow-[0_30px_70px_rgba(2,6,23,0.36)] ${embedded ? 'p-5 sm:p-6' : 'p-6 sm:p-8'}`}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent)]" />
        <h1 className="mb-8 text-xl font-bold text-white">{embedded ? 'Pay Invoice' : 'Your Information'}</h1>
        <Elements
          stripe={stripePromise!}
          options={{
            appearance: {
              theme: 'night' as const,
              variables: {
                colorPrimary: '#ea580c',
                colorBackground: '#0f172a',
                colorText: '#f8fafc',
                borderRadius: '12px',
              },
            },
          }}
        >
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
            country={country}
            setCountry={setCountry}
            stateRegion={stateRegion}
            setStateRegion={setStateRegion}
            zipCode={zipCode}
            setZipCode={setZipCode}
            embedded={embedded}
            onPaymentSuccess={onPaymentSuccess}
          />
        </Elements>
      </div>
    </div>
  )
}
