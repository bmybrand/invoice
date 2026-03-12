'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { InvoiceDocument } from '@/components/Invoice'
import InvoicePayForm from '@/components/InvoicePayForm'

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
  invoice_type: string
}

export default function InvoiceView({ invoiceId, invoiceToken, publicView = false }: { invoiceId: number; invoiceToken: string | null; publicView?: boolean }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const paymentParam = searchParams.get('payment')
  const showPaymentCompleteBanner = paymentParam === 'complete' || paymentParam === 'success'
  const showPaymentProcessingBanner = paymentParam === 'processing'
  const [loading, setLoading] = useState(true)
  const [invoice, setInvoice] = useState<InvoiceRow | null>(null)
  const [brands, setBrands] = useState<BrandOption[]>([])
  const [paymentCompletedLocally, setPaymentCompletedLocally] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

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
        invoice_type: (invoiceData.invoice_type as string) ?? 'Standard',
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

  const normalizedStatus = (invoice.status || '').toLowerCase()
  const isPaid = normalizedStatus.includes('paid') || normalizedStatus.includes('completed')
  const isProcessing = normalizedStatus.includes('processing')
  const canDownloadPdf = isPaid
  const showPaidWatermark = isPaid
  const grandTotal = invoice.service.reduce((sum, line) => sum + (Number(line.qty) || 0) * Number((line.price || '').replace(/[^0-9.-]/g, '')), 0)
  const payableAmount = Math.min(Number(invoice.payable_amount ?? 0), grandTotal)
  const remainingAmount = Math.max(grandTotal - payableAmount, 0)
  const showPayableDetails = invoice.payable_amount != null
  const amountToPay = showPayableDetails && payableAmount > 0 ? payableAmount : grandTotal
  const shouldShowPaymentForm = !isPaid && !isProcessing

  async function handleDownloadPdf() {
    if (!canDownloadPdf || downloadingPdf || !invoice) return

    const root = document.getElementById('invoice-print-root')
    if (!root) return

    setDownloadingPdf(true)

    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas-pro'),
        import('jspdf'),
      ])

      const imageMap = new Map<string, string>()
      const imgs = root.querySelectorAll<HTMLImageElement>('img[src^="http"]')
      await Promise.all(
        Array.from(imgs).map(async (img) => {
          const src = img.getAttribute('src') || ''
          if (!src || src.startsWith(window.location.origin)) return
          try {
            const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(src)}`)
            if (res.ok) {
              const { dataUrl } = await res.json()
              if (dataUrl) imageMap.set(src, dataUrl)
            }
          } catch {
            /* ignore */
          }
        })
      )

      const canvas = await html2canvas(root, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        windowWidth: root.scrollWidth,
        onclone: (clonedDocument) => {
          const clonedRoot = clonedDocument.getElementById('invoice-print-root')
          if (!clonedRoot) return
          const a4MinHeight = Math.ceil((root.scrollWidth * 297) / 210)

          const transparentPixel = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
          clonedRoot.querySelectorAll('img[src^="http"]').forEach((img) => {
            const src = img.getAttribute('src') || ''
            if (!src.startsWith('http')) return
            const dataUrl = imageMap.get(src)
            if (dataUrl) {
              img.setAttribute('src', dataUrl)
            } else if (!src.startsWith(window.location.origin)) {
              img.setAttribute('src', transparentPixel)
            }
          })

          const summaryGrid = clonedRoot.querySelector('.invoice-summary-grid')
          const totalsBlock = clonedRoot.querySelector('.invoice-totals-block')

          const sourceElements = [root, ...Array.from(root.querySelectorAll('*'))]
          const clonedElements = [clonedRoot, ...Array.from(clonedRoot.querySelectorAll('*'))]

          clonedElements.forEach((clonedEl, index) => {
            const sourceEl = sourceElements[index]
            if (!(clonedEl instanceof clonedDocument.defaultView!.HTMLElement) || !(sourceEl instanceof HTMLElement)) {
              return
            }

            const computed = window.getComputedStyle(sourceEl)
            const styleText =
              computed.cssText ||
              Array.from(computed)
                .map((prop) => `${prop}: ${computed.getPropertyValue(prop)};`)
                .join(' ')

            clonedEl.setAttribute('style', styleText)
            clonedEl.removeAttribute('class')
          })

          if (clonedRoot instanceof clonedDocument.defaultView!.HTMLElement) {
            clonedRoot.style.boxShadow = 'none'
            clonedRoot.style.border = 'none'
            clonedRoot.style.borderWidth = '0'
            clonedRoot.style.borderRadius = '0'
            clonedRoot.style.margin = '0'
            clonedRoot.style.width = `${root.scrollWidth}px`
            clonedRoot.style.minHeight = `${Math.max(root.scrollHeight, a4MinHeight)}px`
            clonedRoot.style.display = 'flex'
            clonedRoot.style.flexDirection = 'column'
          }

          if (summaryGrid instanceof HTMLElement) {
            summaryGrid.style.cssText = (summaryGrid.style.cssText || '') + '; display:block !important; width:100% !important;'
          }
          if (totalsBlock instanceof HTMLElement) {
            totalsBlock.style.cssText = (totalsBlock.style.cssText || '') + '; width:320px !important; max-width:320px !important; margin-left:auto !important; margin-right:0 !important;'
          }
        },
        ignoreElements: (element) =>
          element.classList?.contains('no-print') || element.classList?.contains('print-hide-download'),
      })

      const imageData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imageWidth = pageWidth
      const imageHeight = (canvas.height * imageWidth) / canvas.width

      let heightLeft = imageHeight
      let position = 0

      pdf.addImage(imageData, 'PNG', 0, position, imageWidth, imageHeight)
      heightLeft -= pageHeight

      while (heightLeft > 0) {
        position -= pageHeight
        pdf.addPage()
        pdf.addImage(imageData, 'PNG', 0, position, imageWidth, imageHeight)
        heightLeft -= pageHeight
      }

      const fileStem = invoice.brand_name?.trim() ? invoice.brand_name.trim().replace(/[^a-z0-9]+/gi, '-').toLowerCase() : `invoice-${invoice.id}`
      pdf.save(`${fileStem || `invoice-${invoice.id}`}.pdf`)
    } catch (error) {
      console.error('Failed to download PDF', error)
    } finally {
      setDownloadingPdf(false)
    }
  }

  return (
    <div id="invoice-view-root" className={publicView ? 'space-y-4 p-4 sm:p-6 print:p-0 print:m-0' : 'p-4 sm:p-6 space-y-4 print:p-0 print:m-0'}>
      {(showPaymentCompleteBanner || paymentCompletedLocally) && (
        <div className="no-print mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-sm font-semibold text-emerald-400">Payment complete</p>
          <p className="mt-1 text-xs text-slate-400">Your invoice has been marked as paid.</p>
        </div>
      )}
      {showPaymentProcessingBanner && (
        <div className="no-print mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-amber-400">Your payment is being processed</p>
          <p className="mt-1 text-xs text-slate-400">You will receive a confirmation once the payment is complete.</p>
        </div>
      )}
      {!publicView && (
        <button
          type="button"
          onClick={() => router.push('/dashboard/invoices')}
          className="no-print rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
        >
          Back to Invoices
        </button>
      )}
      <div className="mx-auto max-w-[1120px] overflow-hidden rounded-sm border border-[#2e3b52] print:max-w-none print:m-0 print:border-0">
        <InvoiceDocument
          invoice={invoice as never}
          brandMeta={brandMeta as never}
          canDownloadPdf={canDownloadPdf}
          showPaidWatermark={showPaidWatermark}
          onDownload={handleDownloadPdf}
          onPrint={() => canDownloadPdf && window.print()}
          rootId="invoice-print-root"
          includeDownloadButton
          showStatusBadge
          showPaymentDetails={shouldShowPaymentForm}
          paymentFormContent={shouldShowPaymentForm ? (
            <InvoicePayForm
              invoiceId={invoice.id}
              invoiceToken={invoiceToken}
              grandTotal={amountToPay}
              initialEmail={invoice.email}
              initialPhone={invoice.phone}
              embedded
              onPaymentSuccess={() => {
                setPaymentCompletedLocally(true)
                setInvoice((current) => (current ? { ...current, status: 'Paid' } : current))
              }}
            />
          ) : null}
          totalNote={showPayableDetails ? (
            <div className="space-y-1 text-right text-xs font-semibold uppercase tracking-wide text-amber-600">
              <p>Payable Amount: ${payableAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p>Remaining: ${remainingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          ) : null}
          summaryActions={null}
        />
      </div>
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
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            z-index: 2147483647 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          #invoice-print-root .invoice-meta-grid {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            align-items: start !important;
          }

          #invoice-print-root .invoice-meta-grid > :last-child {
            justify-self: end !important;
          }

          #invoice-print-root .invoice-summary-grid {
            display: block !important;
            width: 100% !important;
          }

          #invoice-print-root .invoice-totals-block {
            width: 320px !important;
            max-width: 320px !important;
            margin-left: auto !important;
            margin-right: 0 !important;
          }

          #invoice-print-root .invoice-grand-total {
            display: flex !important;
            justify-content: space-between !important;
            width: 100% !important;
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
