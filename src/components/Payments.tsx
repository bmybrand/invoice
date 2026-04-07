'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useDashboardProfile } from '@/components/DashboardLayout'
import { useClientDashboardData } from '@/context/ClientDashboardDataContext'
import { formatInvoiceCode } from '@/lib/invoice-code'
import { getInvoiceLink } from '@/lib/invoice-token'

const plusJakarta = Plus_Jakarta_Sans({ subsets: ['latin'] })

const PAGE_SIZE = 4
const TABLE_REFRESH_INTERVAL_MS = 5000
const PAYMENT_GRID =
  '52px minmax(88px,0.75fr) minmax(120px,1fr) minmax(140px,1fr) minmax(220px,1.5fr) minmax(110px,0.85fr) minmax(130px,1fr) minmax(130px,0.95fr) minmax(220px,1.7fr) minmax(120px,0.95fr) minmax(160px,1.1fr) minmax(100px,0.9fr) 72px'

type PaymentSubmissionRow = {
  id: number
  invoice_id: number | null
  full_name: string | null
  phone: string | null
  email: string | null
  amount_paid: number | null
  payment_method: string | null
  payment_status: string | null
  stripe_payment_intent_id: string | null
  stripe_transaction_id: string | null
  created_at?: string | null
  invoices?: {
    id?: number | null
    invoice_creator_id?: number | null
    brand_name?: string | null
    status?: string | null
    employees?: { employee_name?: string | null } | Array<{ employee_name?: string | null }> | null
  } | Array<{
    id?: number | null
    invoice_creator_id?: number | null
    brand_name?: string | null
    status?: string | null
    employees?: { employee_name?: string | null } | Array<{ employee_name?: string | null }> | null
  }> | null
}

type PaymentRow = {
  id: number
  invoiceId: number | null
  invoiceCreator: string
  customer: string
  email: string
  amount: number
  phone: string
  paymentMethod: string
  stripeTransactionId: string
  source: string
  createdAt: string
  rawCreatedAt: string | null
  status: 'Success' | 'Processing' | 'Recorded'
}

type PaymentsScopedCache = {
  ownerAuthId: string | null
  rows: PaymentRow[]
}

let paymentsTableCache: PaymentsScopedCache | null = null

function SearchIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  )
}

function InfoIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25h1.5v5.25h-1.5zM12 8.25h.008v.008H12z" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}

function ChevronLeftIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  )
}

function ChevronRightIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  )
}

function CloseIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

function getPaymentStatusLabel(value: string | null | undefined): 'Success' | 'Processing' | 'Recorded' {
  const normalized = (value || '').trim().toLowerCase()
  if (
    normalized.includes('paid') ||
    normalized.includes('success') ||
    normalized.includes('succeed') ||
    normalized.includes('completed')
  ) {
    return 'Success'
  }
  if (normalized.includes('processing') || normalized.includes('pending')) return 'Processing'
  return 'Recorded'
}

function getPaymentStatusStyle(status: PaymentRow['status']): string {
  if (status === 'Success') return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
  if (status === 'Processing') return 'border-amber-500/20 bg-amber-500/10 text-amber-400'
  return 'border-slate-500/20 bg-slate-500/10 text-slate-400'
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export default function Payments() {
  const router = useRouter()
  const { accountType, currentUserAuthId, displayRole, currentEmployeeId, profileLoaded } = useDashboardProfile()
  const normalizedRole = (displayRole || '').trim().toLowerCase().replace(/\s+/g, '')
  const isUserRole = normalizedRole === 'user'
  const isAdmin = normalizedRole === 'admin'
  const isSuperAdmin = normalizedRole === 'superadmin'
  const clientData = useClientDashboardData()
  const scopedPaymentsCache = paymentsTableCache?.ownerAuthId === currentUserAuthId ? paymentsTableCache.rows : null
  const [payments, setPayments] = useState<PaymentRow[]>(() => scopedPaymentsCache ?? [])
  const [paymentsLoading, setPaymentsLoading] = useState(() => !scopedPaymentsCache)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<number[]>([])
  const [showBulkDownloadModal, setShowBulkDownloadModal] = useState(false)
  const [bulkDownloading, setBulkDownloading] = useState(false)

  useEffect(() => {
    let active = true

    async function fetchPayments(options?: { background?: boolean }) {
      const isBackgroundRefresh = options?.background ?? false
      if (!isBackgroundRefresh && !scopedPaymentsCache) {
        setPaymentsLoading(true)
      }

      const isClient = accountType === 'client'
      const clientId = clientData?.client?.id ?? null

      if (isUserRole && !profileLoaded) {
        return
      }

      if (isUserRole && !currentUserAuthId) {
        setPayments([])
        if (!isBackgroundRefresh) {
          setPaymentsLoading(false)
        }
        return
      }

      if (isClient && (clientData?.loading || !clientId)) {
        setPayments([])
        if (!isBackgroundRefresh) {
          setPaymentsLoading(false)
        }
        return
      }

      let submissionData: PaymentSubmissionRow[] | null = null
      let submissionError: Error | null = null

      const baseFields =
        'id, invoice_id, full_name, phone, email, amount_paid, payment_method, payment_status, stripe_payment_intent_id, stripe_transaction_id, created_at'

      if (isClient && clientId) {
        const res = await supabase
          .from('payment_submissions')
          .select(
            `${baseFields}, invoices!inner(id, brand_name, status, invoice_creator_id, client_id, employees:invoice_creator_id(employee_name))`
          )
          .eq('invoices.client_id', clientId)
          .order('created_at', { ascending: false })

        submissionData = (res.data ?? []) as PaymentSubmissionRow[]
        submissionError = res.error as Error | null
      } else if (isUserRole && currentUserAuthId) {
        const res = await supabase
          .from('payment_submissions')
          .select(
            `${baseFields}, invoices!inner(id, brand_name, status, invoice_creator_id, client_id, employees:invoice_creator_id(employee_name), clients!inner(handler_id))`
          )
          .eq('invoices.clients.handler_id', currentUserAuthId)
          .order('created_at', { ascending: false })

        submissionData = (res.data ?? []) as PaymentSubmissionRow[]
        submissionError = res.error as Error | null
      } else {
        const res = await supabase
          .from('payment_submissions')
          .select(
            `${baseFields}, invoices:invoice_id(id, brand_name, status, invoice_creator_id, employees:invoice_creator_id(employee_name))`
          )
          .order('created_at', { ascending: false })

        submissionData = (res.data ?? []) as PaymentSubmissionRow[]
        submissionError = res.error as Error | null
      }

      if (!active) return

      if (submissionError) {
        console.error('Failed to fetch payments', submissionError)
        if (!isBackgroundRefresh) {
          setPayments([])
          paymentsTableCache = null
        }
        if (!isBackgroundRefresh) {
          setPaymentsLoading(false)
        }
        return
      }

      const submissions = (submissionData ?? []) as PaymentSubmissionRow[]

      const mappedPayments: PaymentRow[] = submissions.map((submission) => {
        const invoice = Array.isArray(submission.invoices) ? submission.invoices[0] : submission.invoices
        const employeesRel = invoice?.employees
        const creatorRecord = Array.isArray(employeesRel) ? employeesRel[0] : employeesRel
        return {
          id: submission.id,
          invoiceId: submission.invoice_id,
          invoiceCreator: creatorRecord?.employee_name?.trim() || '--',
          customer: submission.full_name?.trim() || '--',
          email: submission.email?.trim() || '--',
          amount: Number(submission.amount_paid ?? 0),
          phone: submission.phone?.trim() || '--',
          paymentMethod: submission.payment_method?.trim() || 'Stripe',
          stripeTransactionId:
            submission.stripe_transaction_id?.trim() ||
            submission.stripe_payment_intent_id?.trim() ||
            '-',
          source: invoice?.brand_name?.trim() || '--',
          createdAt: formatDateTime(submission.created_at),
          rawCreatedAt: submission.created_at ?? null,
          status: getPaymentStatusLabel(submission.payment_status ?? invoice?.status),
        }
      })

      if (!active) return

      setPayments(mappedPayments)
      paymentsTableCache = {
        ownerAuthId: currentUserAuthId,
        rows: mappedPayments,
      }
      if (!isBackgroundRefresh) {
        setPaymentsLoading(false)
      }
    }

    void fetchPayments()

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchPayments({ background: true })
      }
    }, TABLE_REFRESH_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
      active = false
    }
  }, [accountType, clientData?.client?.id, clientData?.loading, currentEmployeeId, currentUserAuthId, isAdmin, isSuperAdmin, isUserRole, profileLoaded, scopedPaymentsCache])

  const filteredPayments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return payments
    return payments.filter((payment) =>
      [
        payment.invoiceId == null ? '' : formatInvoiceCode(payment.invoiceId),
        payment.invoiceId == null ? '' : `#${formatInvoiceCode(payment.invoiceId)}`,
        payment.invoiceCreator,
        payment.customer,
        payment.email,
        payment.phone,
        payment.paymentMethod,
        payment.stripeTransactionId,
        payment.source,
        payment.createdAt,
        payment.status,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q)
    )
  }, [payments, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / PAGE_SIZE))
  const effectivePage = Math.min(currentPage, totalPages)
  const start = (effectivePage - 1) * PAGE_SIZE
  const end = start + PAGE_SIZE
  const paginatedPayments = filteredPayments.slice(start, end)
  const paidPayments = useMemo(
    () => filteredPayments.filter((payment) => payment.status === 'Success' && payment.invoiceId != null),
    [filteredPayments]
  )
  const selectedPaidPayments = useMemo(
    () => paidPayments.filter((payment) => selectedPaymentIds.includes(payment.id)),
    [paidPayments, selectedPaymentIds]
  )
  const selectablePagePaymentIds = paginatedPayments
    .filter((payment) => payment.status === 'Success' && payment.invoiceId != null)
    .map((payment) => payment.id)
  const allPagePaidSelected =
    selectablePagePaymentIds.length > 0 && selectablePagePaymentIds.every((id) => selectedPaymentIds.includes(id))

  function openPaymentInvoice(invoiceId: number | null) {
    if (invoiceId == null) return
    router.push(getInvoiceLink(invoiceId))
  }

  function togglePaymentSelection(paymentId: number, checked: boolean) {
    setSelectedPaymentIds((prev) =>
      checked ? (prev.includes(paymentId) ? prev : [...prev, paymentId]) : prev.filter((id) => id !== paymentId)
    )
  }

  function toggleSelectAllPagePaid(checked: boolean) {
    setSelectedPaymentIds((prev) => {
      if (checked) {
        return Array.from(new Set([...prev, ...selectablePagePaymentIds]))
      }
      return prev.filter((id) => !selectablePagePaymentIds.includes(id))
    })
  }

  async function handleBulkDownloadSelected() {
    if (selectedPaidPayments.length === 0 || bulkDownloading) return
    setBulkDownloading(true)

    for (const payment of selectedPaidPayments) {
      if (payment.invoiceId == null) continue
      const url = new URL(getInvoiceLink(payment.invoiceId), window.location.origin)
      url.searchParams.set('download', 'pdf')
      window.open(url.toString(), '_blank', 'noopener,noreferrer')
      await new Promise((resolve) => window.setTimeout(resolve, 180))
    }

    setBulkDownloading(false)
    setShowBulkDownloadModal(false)
  }

  return (
    <div className={`${plusJakarta.className} flex w-full flex-col text-white`}>
      <div className="w-full pb-6">
        <div className="flex w-full flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-black leading-tight text-white sm:text-3xl">Payments</h1>
            <p className="text-sm font-normal leading-5 text-slate-400">
              Review completed payment records across your invoices.
            </p>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowBulkDownloadModal(true)}
              disabled={selectedPaidPayments.length === 0}
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-orange-500 px-5 text-sm font-semibold text-white shadow-[0_12px_30px_-14px_rgba(249,115,22,0.9)] transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none"
            >
              Bulk Download
              {selectedPaidPayments.length > 0 ? ` (${selectedPaidPayments.length})` : ''}
            </button>
          </div>
        </div>
      </div>

      <div className="w-full pb-6">
        <div className="flex w-full flex-col gap-4 rounded-xl border border-slate-700 bg-slate-800/80 p-4 sm:flex-row sm:p-6">
          <div className="min-w-0 flex-1">
            <div className="flex h-12 w-full items-center gap-3 overflow-hidden rounded-xl border border-slate-700 bg-slate-900/50 pl-4">
              <SearchIcon className="h-4 w-4 shrink-0 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                placeholder="Search by invoice number, creator, customer, email, source or status..."
                className="h-full min-w-0 flex-1 bg-transparent text-sm text-slate-300 placeholder:text-slate-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-800/80">
        <div className="w-full overflow-x-auto scrollbar-thin">
          <div className="w-full" style={{ minWidth: '1880px' }}>
            <div className="grid w-full border-b border-slate-700 bg-slate-900/50" style={{ gridTemplateColumns: PAYMENT_GRID }}>
              {[ 
                '',
                'No.',
                'Invoice Creator',
                'Customer',
                'Email',
                'Amount',
                'Phone',
                'Payment Method',
                'Stripe Transaction ID',
                'Source',
                'Created',
                'Status',
              ].map((label) => (
                <div key={label} className="flex min-w-0 items-center px-4 py-4 sm:px-6">
                  {label ? (
                    <span className="block truncate whitespace-nowrap text-xs font-bold uppercase tracking-wide text-slate-400">
                      {label}
                    </span>
                  ) : (
                    <input
                      type="checkbox"
                      checked={allPagePaidSelected}
                      onChange={(e) => toggleSelectAllPagePaid(e.target.checked)}
                      disabled={selectablePagePaymentIds.length === 0}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-orange-500 focus:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Select all paid payments on this page"
                    />
                  )}
                </div>
              ))}
              <div className="flex items-center justify-end px-4 py-4 text-right sm:px-6">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Action</span>
              </div>
            </div>

            {paymentsLoading ? (
              <div className="w-full px-4 py-12 text-center text-sm text-slate-400 sm:px-6">
                Loading payments...
              </div>
            ) : paginatedPayments.length === 0 ? (
              <div className="w-full px-4 py-12 text-center text-sm text-slate-400 sm:px-6">
                {searchQuery.trim() ? 'No matching payments found.' : 'No payments recorded yet.'}
              </div>
            ) : (
              paginatedPayments.map((payment, index) => (
                <div
                  key={payment.id}
                  className="grid w-full items-center border-t border-slate-700"
                  style={{ gridTemplateColumns: PAYMENT_GRID }}
                >
                  <div className="min-w-0 px-4 py-4 sm:px-6">
                    {payment.status === 'Success' && payment.invoiceId != null ? (
                      <input
                        type="checkbox"
                        checked={selectedPaymentIds.includes(payment.id)}
                        onChange={(e) => togglePaymentSelection(payment.id, e.target.checked)}
                        className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-orange-500 focus:ring-orange-500"
                        aria-label={`Select payment ${payment.id}`}
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 px-4 py-4 sm:px-6">
                    <span
                      className="block truncate whitespace-nowrap font-mono text-sm font-bold text-white"
                      title={`Row ${start + index + 1}`}
                    >
                      {start + index + 1}
                    </span>
                  </div>
                  <div className="min-w-0 px-4 py-4 sm:px-6">
                    <span className="block truncate whitespace-nowrap text-sm text-white" title={payment.invoiceCreator}>
                      {payment.invoiceCreator}
                    </span>
                  </div>
                  <div className="min-w-0 px-4 py-4 sm:px-6">
                    <span className="block truncate whitespace-nowrap text-sm text-white" title={payment.customer}>
                      {payment.customer}
                    </span>
                  </div>
                  <div className="min-w-0 px-4 py-4 sm:px-6">
                    <span className="block truncate whitespace-nowrap text-sm text-slate-300" title={payment.email}>
                      {payment.email}
                    </span>
                  </div>
                  <div className="min-w-0 px-4 py-4 sm:px-6">
                    <span
                      className="block truncate whitespace-nowrap text-sm font-semibold text-white"
                      title={formatAmount(payment.amount)}
                    >
                      {formatAmount(payment.amount)}
                    </span>
                  </div>
                  <div className="min-w-0 px-4 py-4 sm:px-6">
                    <span className="block truncate whitespace-nowrap text-sm text-slate-300" title={payment.phone}>
                      {payment.phone}
                    </span>
                  </div>
                  <div className="min-w-0 px-4 py-4 sm:px-6">
                    <span className="block truncate whitespace-nowrap text-sm text-slate-300" title={payment.paymentMethod}>
                      {payment.paymentMethod}
                    </span>
                  </div>
                  <div className="min-w-0 px-4 py-4 sm:px-6">
                    <span className="block truncate whitespace-nowrap text-sm text-slate-300" title={payment.stripeTransactionId}>
                      {payment.stripeTransactionId}
                    </span>
                  </div>
                  <div className="min-w-0 px-4 py-4 sm:px-6">
                    <span className="block truncate whitespace-nowrap text-sm text-slate-300" title={payment.source}>
                      {payment.source}
                    </span>
                  </div>
                  <div className="min-w-0 px-4 py-4 sm:px-6">
                    <span className="block text-sm text-slate-300" title={payment.createdAt}>
                      {payment.createdAt}
                    </span>
                  </div>
                  <div className="min-w-0 px-4 py-4 sm:px-6">
                    <span
                      className={`inline-block max-w-full truncate whitespace-nowrap rounded-lg border px-2 py-1 text-xs font-medium ${getPaymentStatusStyle(payment.status)}`}
                      title={payment.status}
                    >
                      {payment.status}
                    </span>
                  </div>
                  <div className="flex justify-end px-4 py-4 sm:px-6">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        openPaymentInvoice(payment.invoiceId)
                      }}
                      disabled={payment.invoiceId == null}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-700/50 hover:text-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="View invoice"
                      title={payment.invoiceId == null ? 'Invoice unavailable' : 'View invoice'}
                    >
                      <InfoIcon />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex w-full flex-col items-center justify-between gap-3 border-t border-slate-700 bg-slate-900/50 px-4 py-4 sm:flex-row sm:px-6">
          <p className="text-sm text-slate-400">
            {paymentsLoading
              ? 'Loading...'
              : filteredPayments.length === 0
                ? 'No payments'
                : `Showing ${start + 1} to ${Math.min(start + PAGE_SIZE, filteredPayments.length)} of ${filteredPayments.length} payments`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={effectivePage <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-slate-400 transition hover:bg-slate-700/50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeftIcon />
            </button>
            {(() => {
              const pages: (number | 'ellipsis')[] =
                totalPages <= 4 ? Array.from({ length: totalPages }, (_, index) => index + 1) : [1, 2, 'ellipsis', totalPages]

              return pages.map((page) =>
                page === 'ellipsis' ? (
                  <span key="ellipsis" className="w-8 text-center text-xs text-slate-500">
                    ...
                  </span>
                ) : (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition ${
                      effectivePage === page
                        ? 'bg-orange-500 text-white'
                        : 'border border-slate-700 text-slate-400 hover:bg-slate-700/50'
                    }`}
                  >
                    {page}
                  </button>
                )
              )
            })()}
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={effectivePage >= totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-slate-400 transition hover:bg-slate-700/50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRightIcon />
            </button>
          </div>
        </div>
      </div>

      {showBulkDownloadModal ? (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => !bulkDownloading && setShowBulkDownloadModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
              <div className="flex items-start justify-between border-b border-slate-700 px-5 py-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Bulk Download Paid Invoices</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Download only paid invoices. Each selected invoice will open in PDF-download mode.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => !bulkDownloading && setShowBulkDownloadModal(false)}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                  aria-label="Close bulk download modal"
                >
                  <CloseIcon />
                </button>
              </div>

              <div className="max-h-[55vh] overflow-y-auto px-5 py-4">
                {selectedPaidPayments.length === 0 ? (
                  <p className="text-sm text-slate-400">Select paid invoice rows from the table first.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedPaidPayments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">
                            {payment.invoiceId == null ? '--' : `#${formatInvoiceCode(payment.invoiceId)}`} • {payment.customer}
                          </p>
                          <p className="mt-1 truncate text-xs text-slate-400">
                            {payment.email} • {formatAmount(payment.amount)} • {payment.createdAt}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => togglePaymentSelection(payment.id, false)}
                          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-700"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-slate-700 px-5 py-4">
                <p className="text-sm text-slate-400">
                  {selectedPaidPayments.length} paid invoice{selectedPaidPayments.length === 1 ? '' : 's'} selected
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowBulkDownloadModal(false)}
                    className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleBulkDownloadSelected()}
                    disabled={selectedPaidPayments.length === 0 || bulkDownloading}
                    className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {bulkDownloading ? 'Opening...' : 'Download Selected'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
