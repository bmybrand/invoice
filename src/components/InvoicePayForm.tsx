'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import {
  CardCvcElement,
  CardExpiryElement,
  CardNumberElement,
  Elements,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js'
import { clearRequiredFieldInvalid, handleRequiredFieldInvalid } from '@/lib/form-validation'

const inputClass =
  'mt-2 h-12 w-full rounded-[10px] border border-[#252d41] bg-[#262b40] px-4 text-sm font-medium text-white placeholder:text-[#6f7ca0] focus:border-[#ff6400] focus:outline-none focus:ring-2 focus:ring-[#ff6400]/20'

const textareaClass =
  'mt-2 w-full rounded-[10px] border border-[#252d41] bg-[#262b40] px-4 py-3 text-sm font-medium text-white placeholder:text-[#6f7ca0] focus:border-[#ff6400] focus:outline-none focus:ring-2 focus:ring-[#ff6400]/20'

const sectionClass =
  'rounded-[18px] border border-[#252d41] bg-[#0f172b] p-4 sm:p-5'

const stripeBaseStyle = {
  color: '#ffffff',
  fontSize: '16px',
  fontFamily: 'system-ui, sans-serif',
  fontWeight: '500',
  '::placeholder': {
    color: '#6f7ca0',
  },
}

const stripeInvalidStyle = {
  color: '#fca5a5',
  iconColor: '#fca5a5',
}

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

function UserInfoIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.118a7.5 7.5 0 0115 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.5-1.632z" />
    </svg>
  )
}

function PaymentDetailsIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 7.5h16.5m-15-2.25h13.5A1.5 1.5 0 0120.25 6.75v10.5a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V6.75a1.5 1.5 0 011.5-1.5z" />
    </svg>
  )
}

function PaymentMetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-[#252d41] bg-[#262b40] px-4 py-3 text-center">
      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/85">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  )
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
    <section className={sectionClass}>
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2d2235] text-[#ff8a00]">
          <UserInfoIcon />
        </div>
        <div>
          <p className="text-[15px] font-bold text-white">User Information</p>
          <p className="text-sm text-white/85">Billing and contact details for this payment.</p>
        </div>
      </div>
      <div className="space-y-4">
      <div>
        <label htmlFor="pay-full-name" className="block text-[13px] font-semibold text-white">
          Your Name
        </label>
        <input
          id="pay-full-name"
          type="text"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className={inputClass}
          placeholder="Full name"
        />
      </div>
      <div>
        <label htmlFor="pay-phone" className="block text-[13px] font-semibold text-white">
          Your Phone
        </label>
        <input
          id="pay-phone"
          type="tel"
          required
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          className={inputClass}
          placeholder="(555) 000-0000"
        />
      </div>
      <div>
        <label htmlFor="pay-email" className="block text-[13px] font-semibold text-white">
          Your Email
        </label>
        <input
          id="pay-email"
          type="email"
          required
          value={emailAddress}
          onChange={(e) => setEmailAddress(e.target.value)}
          className={inputClass}
          placeholder="email@example.com"
        />
      </div>
      <div>
        <label htmlFor="pay-address" className="block text-[13px] font-semibold text-white">
          Your Address
        </label>
        <textarea
          id="pay-address"
          required
          value={streetAddress}
          onChange={(e) => setStreetAddress(e.target.value)}
          rows={3}
          className={textareaClass}
          placeholder="Street number and name..."
        />
      </div>
      <div>
        <label htmlFor="pay-city" className="block text-[13px] font-semibold text-white">
          City
        </label>
        <input
          id="pay-city"
          type="text"
          required
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className={inputClass}
          placeholder="City"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="pay-state" className="block text-[13px] font-semibold text-white">
            State
          </label>
          <input
            id="pay-state"
            type="text"
            required
            value={stateRegion}
            onChange={(e) => setStateRegion(e.target.value)}
            className={inputClass}
            placeholder="State"
          />
        </div>
        <div>
          <label htmlFor="pay-zip" className="block text-[13px] font-semibold text-white">
            Zip Code
          </label>
          <input
            id="pay-zip"
            type="text"
            required
            value={zipCode}
            onChange={(e) => setZipCode(e.target.value)}
            className={inputClass}
            placeholder="Zip"
          />
        </div>
      </div>
      </div>
    </section>
  )
}

type InvoicePayFormProps = {
  invoiceId: number
  invoiceToken?: string | null
  grandTotal: number
  invoiceTitle?: string
  initialEmail?: string
  initialPhone?: string
  embedded?: boolean
  onPaymentSuccess?: () => void
}

function PaymentFormInner({
  invoiceId,
  invoiceToken,
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
  gatewayName,
}: {
  invoiceId: number
  invoiceToken?: string | null
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
  gatewayName: string
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
  const [submitLocked, setSubmitLocked] = useState(false)

  const invoiceUrl = invoiceToken
    ? `/invoice?token=${encodeURIComponent(invoiceToken)}`
    : `/invoice?id=${invoiceId}`

  useEffect(() => {
    if (!paymentSubmitted) return

    const timeoutId = window.setTimeout(() => {
      if (submittedPaymentStatus === 'succeeded') {
        onPaymentSuccess?.()
        if (!embedded) {
          router.replace(`${invoiceUrl}&payment=success`)
        }
        return
      }

      if (!embedded) {
        router.replace(`${invoiceUrl}&payment=processing`)
      }
    }, 1600)

    return () => window.clearTimeout(timeoutId)
  }, [embedded, invoiceUrl, onPaymentSuccess, paymentSubmitted, router, submittedPaymentStatus])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (submitLockRef.current || paying) {
      return
    }

    setPaymentError(null)

    if (!e.currentTarget.reportValidity()) {
      return
    }

    const countryCode = normalizeCountryCode(country)
    if (!/^[A-Z]{2}$/.test(countryCode)) {
      setPaymentError('Country must be a 2-letter code such as US.')
      return
    }

    if (!stripe || !elements) return

    const cardElement = elements.getElement(CardNumberElement)
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
        body: JSON.stringify({
          invoiceId,
          token: invoiceToken,
          fullName,
          phoneNumber,
          emailAddress,
          streetAddress,
          city,
          stateRegion,
          zipCode,
        }),
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

    const paymentStatus = paymentIntent?.status ?? 'processing'

    if (paymentStatus === 'succeeded') {
      setSubmittedPaymentStatus('succeeded')
      setPaymentSubmittedTitle('Payment submitted successfully')
      setPaymentSubmittedMessage('Your payment has been confirmed. Invoice status will update shortly.')
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
      <div className="rounded-[18px] border border-emerald-500/30 bg-[#0f172b] p-8 text-center shadow-[0_24px_60px_rgba(4,10,31,0.45)]">
        <h2 className="text-xl font-bold text-emerald-400">{paymentSubmittedTitle}</h2>
        <p className="mt-2 text-sm text-slate-300">{paymentSubmittedMessage}</p>
      </div>
    )
  }

  return (
    <form
      onSubmit={async (e) => {
        if (submitLocked) return;
        setSubmitLocked(true);
        try {
          await handleSubmit(e);
        } finally {
          setSubmitLocked(false);
        }
      }}
      onInvalidCapture={handleRequiredFieldInvalid}
      onInputCapture={clearRequiredFieldInvalid}
      onChangeCapture={clearRequiredFieldInvalid}
      className="space-y-7"
    >
      <div className="grid items-stretch gap-8 lg:grid-cols-2">
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
        <section className={`${sectionClass} h-full`}>
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#072949] text-[#00b7ff]">
              <PaymentDetailsIcon />
            </div>
            <div>
              <p className="text-[15px] font-bold text-white">Payment Details</p>
              <p className="text-sm text-white/85">Secure card payment powered by Stripe.</p>
            </div>
          </div>
          <div className="pt-2">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-[12px] font-black uppercase tracking-[0.28em] text-white/90">Card</p>
                <p className="mt-2 text-[18px] font-bold text-white">Debit or Credit Card</p>
              </div>
              <span className="pt-1 text-[12px] font-black uppercase tracking-[0.14em] text-white">Secure</span>
            </div>
            <div className="rounded-[10px] border border-[#252d41] bg-[#262b40] px-4 py-3.5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <CardNumberElement
                    options={{
                      showIcon: true,
                      iconStyle: 'solid',
                      style: {
                        base: {
                          ...stripeBaseStyle,
                          iconColor: '#6f7ca0',
                        },
                        invalid: stripeInvalidStyle,
                      },
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 sm:w-[190px] sm:flex-none">
                  <div className="sm:border-l sm:border-[#3a4a70] sm:pl-3">
                    <CardExpiryElement
                      options={{
                        style: {
                          base: stripeBaseStyle,
                          invalid: stripeInvalidStyle,
                        },
                      }}
                    />
                  </div>
                  <div className="sm:border-l sm:border-[#3a4a70] sm:pl-3">
                    <CardCvcElement
                      options={{
                        style: {
                          base: stripeBaseStyle,
                          invalid: stripeInvalidStyle,
                        },
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <label htmlFor="pay-country" className="block text-[13px] font-semibold text-white">
                Country
              </label>
              <div className="relative">
                <select
                  id="pay-country"
                  required
                  value={country}
                  onChange={(e) => setCountry(normalizeCountryCode(e.target.value))}
                  className={`${inputClass} appearance-none pr-10`}
                >
                  {COUNTRY_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label} ({option.code})
                    </option>
                  ))}
                </select>
                <svg
                  className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/80"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <PaymentMetaPill label="Network" value="Visa / MC" />
              <PaymentMetaPill label="Protection" value="3D Secure" />
              <PaymentMetaPill label="Gateway" value={gatewayName} />
            </div>
          </div>
        </section>
      </div>
      {paymentError && (
        <p className="rounded-[12px] border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {paymentError}
        </p>
      )}
      <div className="flex items-center justify-between gap-4 border-t border-[#22375a] pt-6">
        <p className="text-[20px] font-bold text-white sm:text-[22px]">
          Total: ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <button
          type="submit"
          disabled={paying || !stripe || !elements || submitLocked}
          className="min-w-[124px] rounded-[12px] bg-[#ff5d00] px-8 py-3 text-sm font-semibold text-white transition hover:bg-[#ff7a1f] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {paying ? 'Processing...' : 'Pay Now'}
        </button>
      </div>
    </form>
  )
}

export default function InvoicePayForm({
  invoiceId,
  invoiceToken,
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
  const [stripePublishableKey, setStripePublishableKey] = useState<string | null>(null)
  const [stripeGatewayName, setStripeGatewayName] = useState('Stripe')
  const [stripeConfigLoading, setStripeConfigLoading] = useState(true)
  const [stripeConfigError, setStripeConfigError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadStripeConfig() {
      setStripeConfigLoading(true)
      setStripeConfigError(null)

      try {
        const tokenParam = invoiceToken ? `&token=${encodeURIComponent(invoiceToken)}` : ''
        const res = await fetch(
          `/api/stripe/config?invoiceId=${encodeURIComponent(String(invoiceId))}${tokenParam}`
        )
        const data = (await res.json().catch(() => ({}))) as {
          publishableKey?: string
          gateway?: string
          error?: string
        }

        if (!active) return

        if (!res.ok || !data.publishableKey) {
          throw new Error(data.error ?? 'Failed to load payment gateway configuration')
        }

        setStripePublishableKey(data.publishableKey)
        setStripeGatewayName(data.gateway?.trim() || 'Stripe')
      } catch (err) {
        if (!active) return
        setStripePublishableKey(null)
        setStripeConfigError(err instanceof Error ? err.message : 'Failed to load payment gateway configuration')
      } finally {
        if (active) {
          setStripeConfigLoading(false)
        }
      }
    }

    void loadStripeConfig()

    return () => {
      active = false
    }
  }, [invoiceId, invoiceToken])

  const stripePromise = useMemo(
    () => (stripePublishableKey ? loadStripe(stripePublishableKey) : null),
    [stripePublishableKey]
  )

  if (stripeConfigLoading) {
    return (
      <div className={embedded ? 'w-full' : 'mx-auto max-w-[1120px] p-4 sm:p-6'}>
        <p className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
          Loading payment configuration...
        </p>
      </div>
    )
  }

  if (stripeConfigError || !stripePublishableKey || !stripePromise) {
    return (
      <div className={embedded ? 'w-full' : 'mx-auto max-w-[1120px] p-4 sm:p-6'}>
        <p className="rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          {stripeConfigError ?? 'Payment form is not configured.'}
        </p>
      </div>
    )
  }

  return (
    <div className={embedded ? 'w-full' : 'mx-auto max-w-[1120px] p-4 sm:p-6'}>
      {invoiceTitle ? <p className="sr-only">{invoiceTitle}</p> : null}
      <div className={`rounded-[20px] border border-[#1a2d4c] bg-[#0f172b] shadow-[0_24px_60px_rgba(4,10,31,0.45)] ${embedded ? 'p-6 sm:p-7' : 'p-6 sm:p-8'}`}>
        <h1 className="mb-8 text-[18px] font-bold text-white sm:text-[20px]">Pay Invoice</h1>
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
            invoiceToken={invoiceToken}
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
            gatewayName={stripeGatewayName}
          />
        </Elements>
      </div>
    </div>
  )
}
