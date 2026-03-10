'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { InvoiceDocument } from '@/components/Invoice'

type BrandOption = {
  id: number
  brand_name: string
  brand_url: string
  logo_url: string
}

type InvoiceRow = {
  id: number
  invoice_date: string
  invoice_creator_id: number
  invoice_creator: string
  brand_name: string
  email: string
  service: { description: string; qty: number; price: string }[]
  phone: string
  amount: string
  status: string
  payable_amount: number | null
}

export default function InvoiceView({ invoiceId, publicView = false }: { invoiceId: number; publicView?: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [invoice, setInvoice] = useState<InvoiceRow | null>(null)
  const [brands, setBrands] = useState<BrandOption[]>([])
  const [bankName, setBankName] = useState('')
  const [accountName, setAccountName] = useState('')
  const [mounted, setMounted] = useState(false)
  const [accountNumber, setAccountNumber] = useState('')
  const [paying, setPaying] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    async function fetchData() {
      if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
        setLoading(false)
        setInvoice(null)
        return
      }

      const [{ data: invoiceData, error: invoiceError }, { data: brandData, error: brandError }] = await Promise.all([
        supabase.from('invoices').select('*, employees!invoice_creator_id(employee_name)').eq('id', invoiceId).maybeSingle(),
        supabase.from('brands').select('id, brand_name, brand_url, logo_url').order('brand_name'),
      ])

      if (brandError) console.error('Failed to fetch brands', brandError)
      setBrands((brandData as BrandOption[]) ?? [])

      if (invoiceError || !invoiceData) {
        if (invoiceError) console.error('Failed to fetch invoice', invoiceError)
        setInvoice(null)
        setLoading(false)
        return
      }

      const emp = invoiceData.employees as { employee_name?: string } | { employee_name?: string }[] | null
      const empObj = Array.isArray(emp) ? emp[0] : emp
      const serviceRaw = invoiceData.service
      const normalizedServices = Array.isArray(serviceRaw) ? serviceRaw : []

      setInvoice({
        id: (invoiceData.id as number) ?? 0,
        invoice_date: (invoiceData.invoice_date as string) ?? '',
        invoice_creator_id: (invoiceData.invoice_creator_id as number) ?? 0,
        invoice_creator: empObj?.employee_name ?? '--',
        brand_name: (invoiceData.brand_name as string) ?? '',
        email: (invoiceData.email as string) ?? '',
        service: normalizedServices as InvoiceRow['service'],
        phone: (invoiceData.phone as string) ?? '',
        amount: (invoiceData.amount as string) ?? '',
        status: (invoiceData.status as string) ?? 'Pending',
        payable_amount: invoiceData.payable_amount == null ? null : Number(invoiceData.payable_amount),
      })
      setLoading(false)
    }

    fetchData()
  }, [invoiceId])

  const brandMeta = useMemo(() => {
    if (!invoice) return null
    return brands.find((b) => b.brand_name === invoice.brand_name) ?? null
  }, [brands, invoice])

  async function handlePaymentSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!invoice) return

    if (!bankName.trim() || !accountName.trim() || !accountNumber.trim()) {
      setPaymentError('Enter your bank name, account name, and account number.')
      return
    }

    setPaying(true)
    setPaymentError(null)

    const { error } = await supabase.from('invoices').update({ status: 'Paid' }).eq('id', invoice.id)

    setPaying(false)

    if (error) {
      console.error('Failed to mark invoice as paid', error)
      setPaymentError('Payment could not be completed. Please try again.')
      return
    }

    setInvoice((prev) => (prev ? { ...prev, status: 'Paid' } : prev))
    setBankName('')
    setAccountName('')
    setAccountNumber('')
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-400">Loading invoice...</div>
  }

  if (!invoice) {
    return (
      <div className="p-6 space-y-4">
        <p className="text-sm text-slate-400">Invoice not found.</p>
        {!publicView && (
          <button
            type="button"
            onClick={() => router.push('/dashboard/invoices')}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Back to Invoices
          </button>
        )}
      </div>
    )
  }

  const normalizedStatus = (invoice.status || '').toLowerCase()
  const isPaid = normalizedStatus.includes('paid') || normalizedStatus.includes('completed')
  const isPayable = normalizedStatus.includes('payable') || normalizedStatus.includes('pending')
  const canDownloadPdf = isPaid
  const showPaidWatermark = isPaid
  const grandTotal = invoice.service.reduce((sum, line) => sum + (Number(line.qty) || 0) * Number((line.price || '').replace(/[^0-9.-]/g, '')), 0)
  const payableAmount = Math.min(Number(invoice.payable_amount ?? 0), grandTotal)
  const remainingAmount = Math.max(grandTotal - payableAmount, 0)
  const showPayableDetails = payableAmount > 0

  const paymentForm = isPaid ? (
    <div className="no-print rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
      Payment confirmed. You can now download the invoice PDF.
    </div>
  ) : (
    <form onSubmit={handlePaymentSubmit} className="no-print space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <p className="text-sm font-bold text-slate-900">Pay Invoice</p>
        <p className="mt-1 text-xs text-slate-500">Enter your bank details to complete payment and unlock PDF download.</p>
      </div>
      <div>
        <label htmlFor="pay-bank-name" className="block text-xs font-bold uppercase tracking-wide text-slate-500">
          Bank Name
        </label>
        <input
          id="pay-bank-name"
          type="text"
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
        />
      </div>
      <div>
        <label htmlFor="pay-account-name" className="block text-xs font-bold uppercase tracking-wide text-slate-500">
          Account Name
        </label>
        <input
          id="pay-account-name"
          type="text"
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
        />
      </div>
      <div>
        <label htmlFor="pay-account-number" className="block text-xs font-bold uppercase tracking-wide text-slate-500">
          Account Number
        </label>
        <input
          id="pay-account-number"
          type="text"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
        />
      </div>
      {paymentError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{paymentError}</p>}
      <button
        type="submit"
        disabled={paying}
        className="w-full rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {paying ? 'Processing...' : 'Pay'}
      </button>
    </form>
  )

  return (
    <div id="invoice-view-root" className={publicView ? 'space-y-4 p-4 sm:p-6 print:p-0 print:m-0' : 'p-4 sm:p-6 space-y-4 print:p-0 print:m-0'}>
      {!publicView && (
        <button
          type="button"
          onClick={() => router.push('/dashboard/invoices')}
          className="no-print rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
        >
          Back to Invoices
        </button>
      )}
      <div className="mx-auto max-w-[1120px] print:max-w-none print:m-0">
        <InvoiceDocument
          invoice={invoice as never}
          brandMeta={brandMeta as never}
          canDownloadPdf={canDownloadPdf}
          showPaidWatermark={showPaidWatermark}
          onDownload={() => canDownloadPdf && window.print()}
          rootId="invoice-print-root"
          includeDownloadButton
          showStatusBadge
          totalNote={showPayableDetails ? (
            <div className="space-y-1 text-right text-xs font-semibold uppercase tracking-wide text-amber-600">
              <p>Payable Amount: ${payableAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p>Remaining: ${remainingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          ) : null}
          summaryActions={paymentForm}
        />
      </div>
      {mounted &&
        typeof document !== 'undefined' &&
        document.body &&
        createPortal(
          <div id="invoice-print-footer" style={{ display: 'none' }}>
            <div style={{ padding: '0 2.5rem 1.5rem' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>Terms & Conditions</p>
              <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', lineHeight: 1.25, color: '#64748b' }}>
                Please pay within 15 days of receiving this invoice. A late fee of 5% per month will be applied to overdue balances.
              </p>
            </div>
            <div style={{ borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc', padding: '1.5rem 2.5rem', fontSize: '0.875rem', color: '#64748b' }}>
              +1 (555) 000-1234 | www.studioshodwe.com | 456 Design Blvd, Creative City, NY
            </div>
          </div>,
          document.body
        )}
      <style jsx global>{`
        @media print {
          @page {
            size: auto;
            margin: 0 !important;
          }

          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            overflow: visible !important;
          }

          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          aside,
          header {
            display: none !important;
          }

          main {
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
          }

          #dashboard-main-shell,
          #dashboard-main-content,
          #dashboard-root-shell {
            padding-left: 0 !important;
            margin-left: 0 !important;
            overflow: visible !important;
            height: auto !important;
            min-height: 0 !important;
            background: #fff !important;
          }

          main > div {
            padding-left: 0 !important;
            padding-right: 0 !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
          }

          #invoice-view-root {
            position: static !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            background: #fff !important;
            overflow: visible !important;
            height: auto !important;
          }

          .no-print {
            display: none !important;
          }

          #invoice-print-root .print-hide-download {
            display: none !important;
          }

          #invoice-print-root {
            margin: 0 !important;
            padding-bottom: 100px !important;
            min-height: 100vh !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: visible !important;
            page-break-inside: auto !important;
            box-shadow: none !important;
          }

          #invoice-print-root > div.flex {
            flex: 1 1 auto !important;
          }

          #invoice-print-root .invoice-bottom-block {
            display: none !important;
          }

          #invoice-print-footer {
            display: block !important;
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            background: #fff !important;
            z-index: 2147483647 !important;
            visibility: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          #invoice-print-root .invoice-meta-grid,
          #invoice-print-root .invoice-summary-grid {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            align-items: start !important;
          }

          #invoice-print-root .invoice-meta-grid > :last-child {
            justify-self: end !important;
          }

          #invoice-print-root,
          #invoice-view-root,
          #invoice-view-root > div {
            transform: none !important;
            overflow: visible !important;
          }

          #invoice-print-root .invoice-services-wrap,
          #invoice-print-root .invoice-services-row {
            break-inside: auto !important;
            page-break-inside: auto !important;
          }

        }
      `}</style>
    </div>
  )
}
