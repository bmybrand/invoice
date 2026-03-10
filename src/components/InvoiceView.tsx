'use client'

import { useEffect, useMemo, useState } from 'react'
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
}

export default function InvoiceView({ invoiceId, publicView = false }: { invoiceId: number; publicView?: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [invoice, setInvoice] = useState<InvoiceRow | null>(null)
  const [brands, setBrands] = useState<BrandOption[]>([])

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
      })
      setLoading(false)
    }

    fetchData()
  }, [invoiceId])

  const brandMeta = useMemo(() => {
    if (!invoice) return null
    return brands.find((b) => b.brand_name === invoice.brand_name) ?? null
  }, [brands, invoice])

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

  const canDownloadPdf = !(invoice.status || '').toLowerCase().includes('pending')
  const showPaidWatermark = (invoice.status || '').toLowerCase().includes('paid') || (invoice.status || '').toLowerCase().includes('completed')

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
        />
      </div>
      {typeof document !== 'undefined' &&
        createPortal(
          <div id="invoice-print-footer-portal" className="hidden">
            <div className="invoice-print-footer-fixed">
              <div className="px-10 pb-6">
                <p className="text-sm font-bold text-slate-900">Terms & Conditions</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Please pay within 15 days of receiving this invoice. A late fee of 5% per month will be applied to overdue balances.
                </p>
              </div>
              <div className="border-t border-slate-200 bg-slate-50 px-10 py-6 text-sm text-slate-500">
                +1 (555) 000-1234 | www.studioshodwe.com | 456 Design Blvd, Creative City, NY
              </div>
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

          #invoice-print-footer-portal {
            display: block !important;
          }

          .invoice-print-footer-fixed {
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            background: #fff !important;
            z-index: 99999 !important;
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
