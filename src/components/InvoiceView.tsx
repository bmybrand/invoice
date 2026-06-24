'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { logFetchError } from '@/lib/fetch-error'
import { getInvoiceLink as getSignedInvoiceLink } from '@/app/actions/invoice-link'
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
  client_id: number | null
  client_name: string
  brand_name: string
  email: string
  service: { description: string; qty: number; price: string }[]
  phone: string
  amount: string
  status: string
  payable_amount: number | null
  paid_amount: number
  invoice_type: string
  currency: 'USD' | 'CAD'
  payment_gateway_id: number | null
}

function normalizeInvoiceCurrency(value: unknown): 'USD' | 'CAD' {
  return String(value ?? '').trim().toUpperCase() === 'CAD' ? 'CAD' : 'USD'
}

function isSuccessfulPaymentStatus(status: string | null | undefined): boolean {
  const normalized = (status || '').trim().toLowerCase()
  return (
    normalized.includes('paid') ||
    normalized.includes('success') ||
    normalized.includes('succeed') ||
    normalized.includes('completed')
  )
}

function parseAmountValue(amount: unknown): number {
  const n = Number(String(amount ?? '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function formatCurrencyAmount(amount: number, currency: 'USD' | 'CAD'): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0
  const formattedAmount = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(safeAmount)

  return `$${formattedAmount} ${currency}`
}

export default function InvoiceView({
  invoiceId,
  invoiceToken,
  publicView = false,
  tokenExpired = false,
}: {
  invoiceId: number
  invoiceToken: string | null
  publicView?: boolean
  tokenExpired?: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const paymentParam = searchParams.get('payment')
  const downloadParam = searchParams.get('download')
  const showPaymentCompleteBanner = paymentParam === 'complete' || paymentParam === 'success'
  const showPaymentProcessingBanner = paymentParam === 'processing'
  const [loading, setLoading] = useState(true)
  const [invoice, setInvoice] = useState<InvoiceRow | null>(null)
  const [brands, setBrands] = useState<BrandOption[]>([])
  const [paymentCompletedLocally, setPaymentCompletedLocally] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [renewingToken, setRenewingToken] = useState(false)
  const [renewMessage, setRenewMessage] = useState<string | null>(null)
  const autoDownloadTriggeredRef = useRef(false)

  const loadInvoice = useCallback(async () => {
    if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
      setLoading(false)
      setInvoice(null)
      return
    }

    let invoiceData: Record<string, unknown> | null = null
    let brandData: BrandOption[] = []
    let invoiceError: { message?: string } | null = null
    let brandError: { message?: string } | null = null

    if (publicView && invoiceToken) {
      const response = await fetch(`/api/public/invoice?token=${encodeURIComponent(invoiceToken)}`, {
        cache: 'no-store',
      })
      const payload = (await response.json().catch(() => null)) as {
        invoice?: Record<string, unknown>
        brands?: BrandOption[]
        tokenExpired?: boolean
        error?: string
      } | null

      if (!response.ok || !payload?.invoice) {
        invoiceError = { message: payload?.error ?? 'Failed to fetch invoice' }
      } else {
        invoiceData = payload.invoice
        brandData = payload.brands ?? []
      }
    } else if (publicView) {
      invoiceError = { message: 'Missing invoice token' }
    } else {
      const result = await Promise.all([
        supabase.from('invoices').select('*, employees!invoice_creator_id(employee_name), clients!client_id(name)').eq('id', invoiceId).maybeSingle(),
        supabase.from('brands').select('id, brand_name, brand_url, logo_url').neq('isdeleted', true).order('brand_name'),
      ])

      invoiceData = (result[0].data as Record<string, unknown> | null) ?? null
      invoiceError = result[0].error
      brandData = (result[1].data as BrandOption[] | null) ?? []
      brandError = result[1].error
    }

    if (brandError) logFetchError('Failed to fetch brands', brandError)
    setBrands(brandData)

    if (invoiceError || !invoiceData) {
      if (invoiceError) logFetchError('Failed to fetch invoice', invoiceError)
      setInvoice(null)
      setLoading(false)
      return
    }

    const emp = invoiceData.employees as { employee_name?: string } | { employee_name?: string }[] | null
    const empObj = Array.isArray(emp) ? emp[0] : emp
    const clientObj = invoiceData.clients as { name?: string } | { name?: string }[] | null
    const relatedClientName = (Array.isArray(clientObj) ? clientObj[0] : clientObj)?.name ?? ''
    const storedClientName = typeof invoiceData.client_name === 'string' ? invoiceData.client_name : ''
    const clientName = storedClientName || relatedClientName
    const serviceRaw = invoiceData.service
    const normalizedServices = Array.isArray(serviceRaw) ? serviceRaw : []
    const resolvedInvoiceId = Number(invoiceData.id ?? 0)
    let paidAmount = Number(invoiceData.paid_amount ?? 0)

    if ((!Number.isFinite(paidAmount) || paidAmount <= 0) && Number.isFinite(resolvedInvoiceId) && resolvedInvoiceId > 0 && !publicView) {
      const { data: paymentRows, error: paymentError } = await supabase
        .from('payment_submissions')
        .select('amount_paid, payment_status')
        .eq('invoice_id', resolvedInvoiceId)

      if (paymentError) {
        logFetchError('Failed to fetch invoice payment totals', paymentError)
      } else {
        paidAmount = ((paymentRows as Array<{ amount_paid?: unknown; payment_status?: string | null }> | null) ?? []).reduce(
          (sum, payment) => sum + (isSuccessfulPaymentStatus(payment.payment_status) ? parseAmountValue(payment.amount_paid) : 0),
          0
        )
      }
    }

    setInvoice({
      id: resolvedInvoiceId,
      invoice_date: (invoiceData.invoice_date as string) ?? '',
      invoice_creator_id: (invoiceData.invoice_creator_id as number) ?? 0,
      invoice_creator: empObj?.employee_name ?? '--',
      client_id: (invoiceData.client_id as number) ?? null,
      client_name: clientName,
      brand_name: (invoiceData.brand_name as string) ?? '',
      email: (invoiceData.email as string) ?? '',
      service: normalizedServices as InvoiceRow['service'],
      phone: (invoiceData.phone as string) ?? '',
      amount: (invoiceData.amount as string) ?? '',
      status: (invoiceData.status as string) ?? 'Pending',
      payable_amount: invoiceData.payable_amount == null ? null : Number(invoiceData.payable_amount),
      paid_amount: Number(paidAmount.toFixed(2)),
      invoice_type: (invoiceData.invoice_type as string) ?? 'Standard',
      currency: normalizeInvoiceCurrency(invoiceData.currency),
      payment_gateway_id:
        invoiceData.payment_gateway_id == null || invoiceData.payment_gateway_id === ''
          ? null
          : Number(invoiceData.payment_gateway_id),
    })
    setLoading(false)
  }, [invoiceId, invoiceToken, publicView])

  useEffect(() => {
    void loadInvoice()
  }, [loadInvoice, tokenExpired])

  const brandMeta = useMemo(() => {
    if (!invoice) return null
    return brands.find((b) => b.brand_name === invoice.brand_name) ?? null
  }, [brands, invoice])
  const normalizedStatus = (invoice?.status || '').toLowerCase()
  const paidAmount = Number(invoice?.paid_amount ?? 0)
  const invoiceTotal = parseAmountValue(invoice?.amount)
  const remainingBalance = Math.max(invoiceTotal - paidAmount, 0)
  const isPartiallyPaid = paidAmount > 0 && remainingBalance > 0
  const isPaid = invoiceTotal > 0
    ? remainingBalance <= 0
    : normalizedStatus.includes('paid') || normalizedStatus.includes('completed')
  const isProcessing = normalizedStatus.includes('processing')
  const canDownloadPdf = isPaid
  const showPaidWatermark = isPaid
  const grandTotal = (invoice?.service ?? []).reduce((sum, line) => sum + (Number(line.qty) || 0) * parseAmountValue(line.price), 0)
  const payableAmount = Math.min(Number(invoice?.payable_amount ?? 0), grandTotal)
  const remainingAmount = Math.max(grandTotal - payableAmount, 0)
  const showPayableDetails = invoice?.payable_amount != null
  const amountToPay = paidAmount > 0 && remainingBalance > 0
    ? remainingBalance
    : showPayableDetails && payableAmount > 0
      ? payableAmount
      : grandTotal
  const shouldShowPaymentForm = !tokenExpired && !isPaid && !isProcessing && !isPartiallyPaid
  const partialPaymentMessage = invoice
    ? `This invoice is partially paid. Generate a new due invoice for the remaining balance of ${formatCurrencyAmount(remainingBalance, invoice.currency)} to collect another payment.`
    : ''

  const handleRenewToken = useCallback(async () => {
    if (renewingToken || !Number.isFinite(invoiceId) || invoiceId <= 0) return

    setRenewingToken(true)
    setRenewMessage(null)

    try {
      const invoicePath = await getSignedInvoiceLink(invoiceId)
      const renewedInvoiceUrl = `${window.location.origin}${invoicePath}`
      await navigator.clipboard.writeText(renewedInvoiceUrl)
      window.location.assign(renewedInvoiceUrl)
      setRenewMessage('A fresh invoice link has been copied and opened. It is valid for the next 30 days.')
    } catch (error) {
      console.error('Failed to renew invoice token', error)
      setRenewMessage('Failed to renew the invoice link.')
    } finally {
      setRenewingToken(false)
    }
  }, [invoiceId, renewingToken])

  const handleDownloadPdf = useCallback(async () => {
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
            summaryGrid.style.cssText =
              (summaryGrid.style.cssText || '') +
              '; display:grid !important; grid-template-columns:minmax(0,1fr) 320px !important; align-items:start !important; gap:32px !important; width:100% !important;'
          }
          if (totalsBlock instanceof HTMLElement) {
            totalsBlock.style.cssText =
              (totalsBlock.style.cssText || '') +
              '; width:100% !important; max-width:320px !important; justify-self:end !important; margin-left:0 !important; margin-right:0 !important;'
          }
        },
        ignoreElements: (element) =>
          element.classList?.contains('no-print') || element.classList?.contains('print-hide-download'),
      })

      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()

      const drawRepeatedHeader = () => {
        const headerBrand = (invoice.brand_name || 'bmy brand').trim() || 'bmy brand'
        pdf.setFillColor(15, 23, 42)
        pdf.rect(0, 0, pageWidth, 14, 'F')
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(11)
        pdf.setTextColor(255, 255, 255)
        pdf.text(headerBrand, 10, 9)
        pdf.setTextColor(234, 88, 12)
        pdf.text('Invoice', pageWidth - 10, 9, { align: 'right' })
      }

      const repeatHeaderHeight = 14
      const repeatedPageTopPadding = 3
      const repeatedPageTopInset = repeatHeaderHeight + repeatedPageTopPadding

      const pxPerMm = canvas.width / pageWidth
      const firstPageSliceHeightPx = Math.max(1, Math.floor(pageHeight * pxPerMm))
      const repeatedPageSliceHeightPx = Math.max(1, Math.floor((pageHeight - repeatedPageTopInset) * pxPerMm))

      const createSlice = (startY: number, maxHeightPx: number) => {
        const remaining = Math.max(0, canvas.height - startY)
        const sliceHeightPx = Math.min(maxHeightPx, remaining)
        if (sliceHeightPx <= 0) return null

        const sliceCanvas = document.createElement('canvas')
        sliceCanvas.width = canvas.width
        sliceCanvas.height = sliceHeightPx
        const ctx = sliceCanvas.getContext('2d')
        if (!ctx) return null

        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height)
        ctx.drawImage(canvas, 0, startY, canvas.width, sliceHeightPx, 0, 0, sliceCanvas.width, sliceCanvas.height)

        return {
          dataUrl: sliceCanvas.toDataURL('image/png'),
          heightMm: sliceHeightPx / pxPerMm,
          heightPx: sliceHeightPx,
        }
      }

      const firstSlice = createSlice(0, firstPageSliceHeightPx)
      if (!firstSlice) {
        throw new Error('Failed to render first PDF page')
      }
      pdf.addImage(firstSlice.dataUrl, 'PNG', 0, 0, pageWidth, firstSlice.heightMm)

      let sourceOffsetPx = firstSlice.heightPx
      while (sourceOffsetPx < canvas.height) {
        pdf.addPage()
        drawRepeatedHeader()

        const pageSlice = createSlice(sourceOffsetPx, repeatedPageSliceHeightPx)
        if (!pageSlice) break
        pdf.addImage(pageSlice.dataUrl, 'PNG', 0, repeatedPageTopInset, pageWidth, pageSlice.heightMm)

        sourceOffsetPx += pageSlice.heightPx
      }

      const fileStem = invoice.brand_name?.trim() ? invoice.brand_name.trim().replace(/[^a-z0-9]+/gi, '-').toLowerCase() : `invoice-${invoice.id}`
      pdf.save(`${fileStem || `invoice-${invoice.id}`}.pdf`)
    } catch (error) {
      console.error('Failed to download PDF', error)
    } finally {
      setDownloadingPdf(false)
    }
  }, [canDownloadPdf, downloadingPdf, invoice])

  useEffect(() => {
    if (downloadParam !== 'pdf' || autoDownloadTriggeredRef.current || !canDownloadPdf || !invoice || loading) {
      return
    }

    autoDownloadTriggeredRef.current = true
    void handleDownloadPdf()
  }, [canDownloadPdf, downloadParam, handleDownloadPdf, invoice, loading])

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

  return (
    <div id="invoice-view-root" className={publicView ? 'space-y-4 print:space-y-0 p-4 sm:p-6 print:p-0 print:m-0' : 'p-4 sm:p-6 space-y-4 print:space-y-0 print:p-0 print:m-0'}>
      {publicView && tokenExpired && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">Token expired</p>
          <p className="mt-1 text-sm text-amber-700">
            This invoice link has expired. You can still review the invoice, but payment is disabled. Please ask an employee for a new payment link.
          </p>
        </div>
      )}
      {!publicView && tokenExpired && (
        <div className="no-print rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-400">Token expired</p>
              <p className="mt-1 text-xs text-slate-400">
                This customer link has expired. Only employees can renew it for the next 30 days.
              </p>
              {renewMessage ? <p className="mt-2 text-xs text-slate-300">{renewMessage}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => void handleRenewToken()}
              disabled={renewingToken}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
            >
              {renewingToken ? 'Renewing...' : 'Renew Link'}
            </button>
          </div>
        </div>
      )}
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
          paymentFormContent={
            isPartiallyPaid ? (
              <div className="rounded-xl border border-sky-300 bg-sky-50 p-4">
                <p className="text-sm font-bold text-sky-800">Partially paid</p>
                <p className="mt-1 text-xs font-medium leading-5 text-slate-700">{partialPaymentMessage}</p>
              </div>
            ) : shouldShowPaymentForm ? (
              <InvoicePayForm
                invoiceId={invoice.id}
                invoiceToken={invoiceToken}
                grandTotal={amountToPay}
                initialEmail={invoice.email}
                initialPhone={invoice.phone}
                currency={invoice.currency}
                embedded
                onPaymentSuccess={() => {
                  setPaymentCompletedLocally(true)
                  void loadInvoice()
                }}
              />
            ) : null
          }
          showPayableSummary={showPayableDetails}
          payableAmount={payableAmount}
          remainingAmount={remainingAmount}
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
            height: auto !important;
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
            padding-top: 0 !important;
            padding-right: 0 !important;
            padding-bottom: 0 !important;
            padding-left: 0 !important;
            margin-top: 0 !important;
            margin-right: 0 !important;
            margin-bottom: 0 !important;
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

          #invoice-print-root .invoice-print-header {
            position: static !important;
            width: 100% !important;
            z-index: auto !important;
          }

          #invoice-print-root {
            margin: 0 !important;
            min-height: 100vh !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: visible !important;
            page-break-inside: auto !important;
            box-shadow: none !important;
          }

          #invoice-print-root > div.flex {
            flex: 1 1 auto !important;
            padding-top: 0 !important;
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
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) 320px !important;
            align-items: start !important;
            gap: 2rem !important;
            width: 100% !important;
          }

          #invoice-print-root .invoice-totals-block {
            width: 100% !important;
            max-width: 320px !important;
            justify-self: end !important;
            margin-left: 0 !important;
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
