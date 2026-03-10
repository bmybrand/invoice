'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DashboardLayout } from '@/components/DashboardLayout'
import InvoicePayForm from '@/components/InvoicePayForm'

export default function InvoicePayRouteShell({ invoiceId }: { invoiceId: number }) {
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
        .maybeSingle()

      setIsEmployee(!!employee)
      setResolved(true)
    }

    resolveViewer()
  }, [])

  useEffect(() => {
    async function fetchInvoice() {
      if (!Number.isFinite(invoiceId) || invoiceId <= 0) return
      const { data, error } = await supabase
        .from('invoices')
        .select('service, status, brand_name, email, phone, payable_amount')
        .eq('id', invoiceId)
        .maybeSingle()

      if (error || !data) {
        setInvoice(null)
        return
      }

      const normalizedStatus = (data.status || '').toLowerCase()
      if (normalizedStatus.includes('paid') || normalizedStatus.includes('completed')) {
        router.replace(`/invoice?id=${invoiceId}`)
        return
      }
      if (normalizedStatus.includes('processing')) {
        router.replace(`/invoice?id=${invoiceId}&payment=processing`)
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
  }, [invoiceId, router])

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

  const invoiceTitle = invoice.brand_name ? `${invoice.brand_name} – Payment` : undefined

  if (isEmployee) {
    return (
      <DashboardLayout title="Pay Invoice">
        <div className="min-h-screen bg-gray-900">
          <div className="border-b border-slate-700 px-4 py-4 sm:px-6">
            <button
              type="button"
              onClick={() => router.push(`/invoice?id=${invoiceId}`)}
              className="text-sm font-medium text-slate-400 hover:text-white"
            >
              ← Back to Invoice
            </button>
          </div>
          <InvoicePayForm
            invoiceId={invoiceId}
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
          onClick={() => router.push(`/invoice?id=${invoiceId}`)}
          className="text-sm font-medium text-slate-400 hover:text-white"
        >
          ← Back to Invoice
        </button>
      </div>
      <InvoicePayForm
        invoiceId={invoiceId}
        grandTotal={invoice.grandTotal}
        invoiceTitle={invoiceTitle}
        initialEmail={invoice.email}
        initialPhone={invoice.phone}
      />
    </div>
  )
}
