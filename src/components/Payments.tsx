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
const TABLE_REFRESH_INTERVAL_MS = 3000
const PAYMENT_GRID =
  'minmax(88px,0.75fr) minmax(120px,1fr) minmax(140px,1fr) minmax(220px,1.5fr) minmax(110px,0.85fr) minmax(130px,1fr) minmax(130px,0.95fr) minmax(220px,1.7fr) minmax(120px,0.95fr) minmax(160px,1.1fr) minmax(100px,0.9fr) 72px'

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
}

type InvoiceMetaRow = {
  id: number
  invoice_creator_id: number | null
  brand_name: string | null
  status: string | null
}

type EmployeeMetaRow = {
  id: number
  employee_name: string | null
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
  const { accountType } = useDashboardProfile()
  const clientData = useClientDashboardData()
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    let active = true

    async function fetchPayments(options?: { background?: boolean }) {
      const isBackgroundRefresh = options?.background ?? false
      if (!isBackgroundRefresh) {
        setPaymentsLoading(true)
      }

      const isClient = accountType === 'client'
      const clientId = clientData?.client?.id ?? null

      if (isClient && (clientData?.loading || !clientId)) {
        setPayments([])
        if (!isBackgroundRefresh) {
          setPaymentsLoading(false)
        }
        return
      }

      let submissionData: PaymentSubmissionRow[] | null = null
      let submissionError: Error | null = null

      if (isClient && clientId) {
        const { data: invoiceData } = await supabase
          .from('invoices')
          .select('id')
          .eq('client_id', clientId)

        if (!active) return

        const invoiceIds = ((invoiceData ?? []) as { id: number }[]).map((r) => r.id).filter((id) => Number.isFinite(id))

        if (invoiceIds.length === 0) {
          setPayments([])
          if (!isBackgroundRefresh) {
            setPaymentsLoading(false)
          }
          return
        }

        const res = await supabase
          .from('payment_submissions')
          .select(
            'id, invoice_id, full_name, phone, email, amount_paid, payment_method, payment_status, stripe_payment_intent_id, stripe_transaction_id, created_at'
          )
          .in('invoice_id', invoiceIds)
          .order('created_at', { ascending: false })

        submissionData = (res.data ?? []) as PaymentSubmissionRow[]
        submissionError = res.error as Error | null
      } else {
        const res = await supabase
          .from('payment_submissions')
          .select(
            'id, invoice_id, full_name, phone, email, amount_paid, payment_method, payment_status, stripe_payment_intent_id, stripe_transaction_id, created_at'
          )
          .order('created_at', { ascending: false })

        submissionData = (res.data ?? []) as PaymentSubmissionRow[]
        submissionError = res.error as Error | null
      }

      if (!active) return

      if (submissionError) {
        console.error('Failed to fetch payments', submissionError)
        setPayments([])
        if (!isBackgroundRefresh) {
          setPaymentsLoading(false)
        }
        return
      }

      const submissions = (submissionData ?? []) as PaymentSubmissionRow[]
      const invoiceIds = Array.from(
        new Set(
          submissions
            .map((row) => row.invoice_id)
            .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
        )
      )

      let invoiceMap = new Map<number, InvoiceMetaRow>()
      if (invoiceIds.length > 0) {
        const { data: invoiceData, error: invoiceError } = await supabase
          .from('invoices')
          .select('id, invoice_creator_id, brand_name, status')
          .in('id', invoiceIds)

        if (!active) return

        if (invoiceError) {
          console.error('Failed to fetch invoice metadata for payments', invoiceError)
        } else {
          invoiceMap = new Map(((invoiceData ?? []) as InvoiceMetaRow[]).map((row) => [row.id, row]))
        }
      }

      const creatorIds = Array.from(
        new Set(
          Array.from(invoiceMap.values())
            .map((row) => row.invoice_creator_id)
            .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
        )
      )

      let employeeMap = new Map<number, EmployeeMetaRow>()
      if (creatorIds.length > 0) {
        const { data: employeeData, error: employeeError } = await supabase
          .from('employees')
          .select('id, employee_name')
          .in('id', creatorIds)

        if (!active) return

        if (employeeError) {
          console.error('Failed to fetch employee metadata for payments', employeeError)
        } else {
          employeeMap = new Map(((employeeData ?? []) as EmployeeMetaRow[]).map((row) => [row.id, row]))
        }
      }

      const mappedPayments: PaymentRow[] = submissions.map((submission) => {
        const invoice = submission.invoice_id != null ? invoiceMap.get(submission.invoice_id) : undefined
        const creator = invoice?.invoice_creator_id != null ? employeeMap.get(invoice.invoice_creator_id) : undefined
        return {
          id: submission.id,
          invoiceId: submission.invoice_id,
          invoiceCreator: creator?.employee_name?.trim() || '--',
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
  }, [accountType, clientData?.client?.id, clientData?.loading])

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

  function openPaymentInvoice(invoiceId: number | null) {
    if (invoiceId == null) return
    router.push(getInvoiceLink(invoiceId))
  }

  return (
    <div className={`${plusJakarta.className} flex w-full flex-col text-white`}>
      <div className="w-full pb-6">
        <div className="flex w-full flex-col gap-1 p-4">
          <h1 className="text-2xl font-black leading-tight text-white sm:text-3xl">Payments</h1>
          <p className="text-sm font-normal leading-5 text-slate-400">
            Review completed payment records across your invoices.
          </p>
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
                  <span className="block truncate whitespace-nowrap text-xs font-bold uppercase tracking-wide text-slate-400">
                    {label}
                  </span>
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
    </div>
  )
}
