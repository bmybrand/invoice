'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DashboardLayout } from '@/components/DashboardLayout'
import InvoicePayForm from '@/components/InvoicePayForm'

export default function InvoicePayRouteShell({ invoiceId, invoiceToken }: { invoiceId: number; invoiceToken: string | null }) {
  const router = useRouter()
  const [resolved, setResolved] = useState(false)
  const [isEmployee, setIsEmployee] = useState(false)
  const [invoice, setInvoice] = useState<{ grandTotal: number; brand_name?: string; email?: string; phone?: string } | null>(null)

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

    resolveViewer()
  }, [])

  useEffect(() => {
    async function fetchInvoice() {
      if (!Number.isFinite(invoiceId) || invoiceId <= 0) return

      let data: {
        service?: unknown
        status?: string | null
        brand_name?: string | null
        email?: string | null
        phone?: string | null
        payable_amount?: number | string | null
      } | null = null
      let error: { message?: string } | null = null

      if (invoiceToken) {
        const response = await fetch(`/api/public/invoice?token=${encodeURIComponent(invoiceToken)}`)
        const payload = (await response.json().catch(() => null)) as {
          invoice?: {
            service?: unknown
            status?: string | null
            brand_name?: string | null
            email?: string | null
            phone?: string | null
            payable_amount?: number | string | null
          }
          error?: string
        } | null

        if (!response.ok || !payload?.invoice) {
          error = { message: payload?.error ?? 'Failed to fetch invoice' }
        } else {
          data = payload.invoice
        }
      } else {
        const result = await supabase
          .from('invoices')
          .select('service, status, brand_name, email, phone, payable_amount')
          .eq('id', invoiceId)
          .maybeSingle()

        data = result.data
        error = result.error
      }

      if (error || !data) {
        setInvoice(null)
        return
      }

      const normalizedStatus = (data.status || '').toLowerCase()
      const invoiceUrl = invoiceToken ? `/invoice?token=${encodeURIComponent(invoiceToken)}` : `/invoice?id=${invoiceId}`
      if (normalizedStatus.includes('paid') || normalizedStatus.includes('completed')) {
        router.replace(invoiceUrl)
        return
      }
      if (normalizedStatus.includes('processing')) {
        router.replace(`${invoiceUrl}&payment=processing`)
        return
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
        brand_name: data.brand_name as string,
        email: (data.email as string) ?? '',
        phone: (data.phone as string) ?? '',
      })
    }

    fetchInvoice()
  }, [invoiceId, invoiceToken, router])

  if (!resolved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 p-6">
        <p className="text-sm text-slate-400">Loading...</p>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 p-6">
        <div className="text-center">
          <p className="text-sm text-slate-400">Invoice not found or already paid.</p>
          <button
            type="button"
            onClick={() => router.push('/dashboard/invoices')}
            className="mt-4 rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
          >
            Back to Invoices
          </button>
        </div>
      </div>
    )
  }

  const invoiceTitle = invoice.brand_name ? `${invoice.brand_name} â€“ Payment` : undefined

  if (isEmployee) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-gray-900">
          <div className="border-b border-slate-700 px-4 py-4 sm:px-6">
            <h1 className="text-xl font-bold text-white mb-2">Pay Invoice</h1>
            <button
              type="button"
              onClick={() => router.push(invoiceToken ? `/invoice?token=${encodeURIComponent(invoiceToken)}` : `/invoice?id=${invoiceId}`)}
              className="text-sm font-medium text-slate-400 hover:text-white"
            >
              â† Back to Invoice
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
      </DashboardLayout>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="border-b border-slate-700 px-4 py-4 sm:px-6">
        <button
          type="button"
          onClick={() => router.push(invoiceToken ? `/invoice?token=${encodeURIComponent(invoiceToken)}` : `/invoice?id=${invoiceId}`)}
          className="text-sm font-medium text-slate-400 hover:text-white"
        >
          â† Back to Invoice
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
