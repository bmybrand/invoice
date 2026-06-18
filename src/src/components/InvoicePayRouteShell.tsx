'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DashboardLayout } from '@/components/DashboardLayout'
import { logFetchError } from '@/lib/fetch-error'
import InvoicePayForm from '@/components/InvoicePayForm'

type InvoicePaymentSummary = {
  grandTotal: number
  currency: 'USD' | 'CAD'
  brand_name?: string
  email?: string
  phone?: string
}

function normalizeInvoiceCurrency(value: unknown): 'USD' | 'CAD' {
  return String(value ?? '').trim().toUpperCase() === 'CAD' ? 'CAD' : 'USD'
}

export default function InvoicePayRouteShell({
  invoiceId,
  invoiceToken,
  tokenExpired = false,
  tokenExpiresAt = null,
}: {
  invoiceId: number
  invoiceToken: string | null
  tokenExpired?: boolean
  tokenExpiresAt?: number | null
}) {
  const router = useRouter()
  const [resolved, setResolved] = useState(false)
  const [isEmployee, setIsEmployee] = useState(false)
  const [invoice, setInvoice] = useState<InvoicePaymentSummary | null>(null)
  const [accessError, setAccessError] = useState<string | null>(null)
  const [liveTokenExpired, setLiveTokenExpired] = useState(() =>
    tokenExpiresAt != null ? Date.now() >= tokenExpiresAt * 1000 : false
  )

  const publicInvoiceUrl = useMemo(() => {
    if (!invoiceToken) return null
    return `/invoice?token=${encodeURIComponent(invoiceToken)}`
  }, [invoiceToken])

  useEffect(() => {
    if (tokenExpiresAt == null) {
      setLiveTokenExpired(false)
      return
    }

    const remainingMs = tokenExpiresAt * 1000 - Date.now()
    if (remainingMs <= 0) {
      setLiveTokenExpired(true)
      return
    }

    setLiveTokenExpired(false)
    const timeoutId = window.setTimeout(() => {
      setLiveTokenExpired(true)
      setInvoice(null)
      setAccessError('Token expired')
    }, remainingMs)

    return () => window.clearTimeout(timeoutId)
  }, [tokenExpiresAt])

  useEffect(() => {
    async function resolveViewer() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user?.id) {
        setIsEmployee(false)
        setResolved(true)
        return
      }

      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('auth_id', user.id)
        .neq('isdeleted', true)
        .maybeSingle()

      setIsEmployee(!!employee)
      setResolved(true)
    }

    void resolveViewer()
  }, [])

  useEffect(() => {
    async function fetchInvoice() {
      if (!resolved || !Number.isFinite(invoiceId) || invoiceId <= 0) return

      setAccessError(null)

      if (!isEmployee && (tokenExpired || liveTokenExpired)) {
        setInvoice(null)
        setAccessError('Token expired')
        return
      }

      let data: {
        service?: unknown
        status?: string | null
        brand_name?: string | null
        email?: string | null
        phone?: string | null
        payable_amount?: number | string | null
        currency?: string | null
      } | null = null
      let error: { message?: string } | null = null

      if (isEmployee) {
        const result = await supabase
          .from('invoices')
          .select('service, status, brand_name, email, phone, payable_amount, currency')
          .eq('id', invoiceId)
          .maybeSingle()

        data = result.data
        error = result.error
      } else if (invoiceToken) {
        const response = await fetch(`/api/public/invoice?token=${encodeURIComponent(invoiceToken)}`)
        const payload = (await response.json().catch(() => null)) as {
          invoice?: {
            service?: unknown
            status?: string | null
            brand_name?: string | null
            email?: string | null
            phone?: string | null
            payable_amount?: number | string | null
            currency?: string | null
          }
          error?: string
        } | null

        if (!response.ok || !payload?.invoice) {
          error = { message: payload?.error ?? 'Failed to fetch invoice' }
        } else {
          data = payload.invoice
        }
      } else {
        setInvoice(null)
        setAccessError('Missing invoice token')
        return
      }

      if (error || !data) {
        if (error) logFetchError('Failed to fetch invoice for payment', error)
        setInvoice(null)
        setAccessError(error?.message ?? 'Invoice not found or already paid.')
        return
      }

      const normalizedStatus = (data.status || '').toLowerCase()
      if (!isEmployee && publicInvoiceUrl) {
        if (normalizedStatus.includes('paid') || normalizedStatus.includes('completed')) {
          router.replace(`${publicInvoiceUrl}&payment=success`)
          return
        }
        if (normalizedStatus.includes('processing')) {
          router.replace(`${publicInvoiceUrl}&payment=processing`)
          return
        }
      }

      const services = Array.isArray(data.service) ? data.service : []
      const grandTotal = services.reduce(
        (sum: number, line: { qty?: number; price?: string }) =>
          sum + (Number(line.qty) || 0) * Number((line.price || '').replace(/[^0-9.-]/g, '')),
        0
      )
      const payableAmount = data.payable_amount != null ? Math.min(Number(data.payable_amount), grandTotal) : null
      const amountToPay = payableAmount != null && payableAmount > 0 ? payableAmount : grandTotal

      setInvoice({
        grandTotal: amountToPay,
        currency: normalizeInvoiceCurrency(data.currency),
        brand_name: data.brand_name ?? '',
        email: data.email ?? '',
        phone: data.phone ?? '',
      })
    }

    void fetchInvoice()
  }, [invoiceId, invoiceToken, isEmployee, liveTokenExpired, publicInvoiceUrl, resolved, router, tokenExpired])

  if (!resolved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 p-6">
        <p className="text-sm text-slate-400">Loading...</p>
      </div>
    )
  }

  if (!invoice) {
    const message =
      accessError === 'Token expired'
        ? 'This payment link has expired. Ask an employee for a new link.'
        : accessError ?? 'Invoice not found or already paid.'

    const content = (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 p-6">
        <div className="max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center">
          <p className="text-sm font-semibold text-white">
            {accessError === 'Token expired' ? 'Token expired' : 'Payment link unavailable'}
          </p>
          <p className="mt-2 text-sm text-slate-400">{message}</p>
          <button
            type="button"
            onClick={() => router.push(isEmployee ? '/dashboard/invoices' : publicInvoiceUrl ?? '/')}
            className="mt-4 rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
          >
            {isEmployee ? 'Back to Invoices' : 'Back'}
          </button>
        </div>
      </div>
    )

    return isEmployee ? <DashboardLayout>{content}</DashboardLayout> : content
  }

  const invoiceTitle = invoice.brand_name ? `${invoice.brand_name} - Payment` : undefined

  if (isEmployee) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-gray-900">
          <div className="border-b border-slate-700 px-4 py-4 sm:px-6">
            <h1 className="mb-2 text-xl font-bold text-white">Pay Invoice</h1>
            <button
              type="button"
              onClick={() => router.push(`/invoice?id=${invoiceId}`)}
              className="text-sm font-medium text-slate-400 hover:text-white"
            >
              Back to Invoice
            </button>
          </div>
          <InvoicePayForm
            invoiceId={invoiceId}
            invoiceToken={invoiceToken}
            grandTotal={invoice.grandTotal}
            invoiceTitle={invoiceTitle}
          initialEmail={invoice.email}
          initialPhone={invoice.phone}
          currency={invoice.currency}
        />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="border-b border-slate-700 px-4 py-4 sm:px-6">
        <button
          type="button"
          onClick={() => router.push(publicInvoiceUrl ?? '/')}
          className="text-sm font-medium text-slate-400 hover:text-white"
        >
          Back to Invoice
        </button>
      </div>
      <InvoicePayForm
        invoiceId={invoiceId}
        invoiceToken={invoiceToken}
        grandTotal={invoice.grandTotal}
        invoiceTitle={invoiceTitle}
        initialEmail={invoice.email}
        initialPhone={invoice.phone}
      />
    </div>
  )
}
