'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { useRouter, useSearchParams } from 'next/navigation'
import JSZip from 'jszip'
import { supabase } from '@/lib/supabase'
import { useDashboardProfile } from '@/components/DashboardLayout'
import { InvoiceDocument } from '@/components/Invoice'
import { useClientDashboardData } from '@/context/ClientDashboardDataContext'
import { formatInvoiceCode } from '@/lib/invoice-code'
import { getInvoiceLink } from '@/lib/invoice-token'
import { logFetchError } from '@/lib/fetch-error'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'

const plusJakarta = Plus_Jakarta_Sans({ subsets: ['latin'] })

const PAGE_SIZE = 4
const MODAL_PREVIEW_INITIAL = 1
const MODAL_PREVIEW_STEP = 50
const BULK_PRINT_ROOT_ID = 'bulk-invoice-print-root'
const PAYMENT_GRID_FINANCE =
  '52px minmax(88px,0.75fr) minmax(120px,1fr) minmax(140px,1fr) minmax(220px,1.5fr) minmax(110px,0.85fr) minmax(130px,1fr) minmax(130px,0.95fr) minmax(220px,1.7fr) minmax(120px,0.95fr) minmax(160px,1.1fr) minmax(100px,0.9fr) 72px'
const PAYMENT_GRID_STANDARD =
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

type QuickDownloadType = 'all' | 'week' | 'month' | 'day'

type BulkBrandOption = {
  id: number
  brand_name: string
  brand_url: string
  logo_url: string
}

type BulkInvoiceRow = {
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
}

type BulkRenderPayload = {
  invoice: BulkInvoiceRow
  brandMeta: BulkBrandOption | null
}

type UserInvoiceMetaRow = {
  id: number
  invoice_creator_id: number | null
  brand_name: string | null
  employees?: { employee_name?: string | null } | Array<{ employee_name?: string | null }> | null
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

function PlusIcon({ className = 'h-4 w-3' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
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

function getIsoWeek(date: Date): number {
  const normalized = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = normalized.getUTCDay() || 7
  normalized.setUTCDate(normalized.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(normalized.getUTCFullYear(), 0, 1))
  return Math.ceil((((normalized.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function getIsoWeekYear(date: Date): number {
  const normalized = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = normalized.getUTCDay() || 7
  normalized.setUTCDate(normalized.getUTCDate() + 4 - day)
  return normalized.getUTCFullYear()
}

function getIsoWeekRange(year: number, week: number): { start: Date; end: Date } {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7
  const week1Monday = new Date(jan4)
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1))

  const weekStart = new Date(week1Monday)
  weekStart.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7)

  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6)

  return {
    start: new Date(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), weekStart.getUTCDate()),
    end: new Date(weekEnd.getUTCFullYear(), weekEnd.getUTCMonth(), weekEnd.getUTCDate()),
  }
}

function formatWeekOptionLabel(year: number, week: number): string {
  const { start, end } = getIsoWeekRange(year, week)
  const startText = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endText = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `Week ${week} - ${startText} to ${endText}`
}

function sanitizeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim()
}

export default function Payments() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { accountType, currentUserAuthId, displayRole, displayDepartment, currentEmployeeId, profileLoaded } = useDashboardProfile()
  const normalizedRole = (displayRole || '').trim().toLowerCase().replace(/\s+/g, '')
  const normalizedDepartment = (displayDepartment || '').trim().toLowerCase()
  const isFinanceDepartment = normalizedDepartment.includes('finance')
  const isUserRole = normalizedRole === 'user'
  const isSuperAdmin = normalizedRole === 'superadmin'
  const clientData = useClientDashboardData()
  const scopedPaymentsCache = paymentsTableCache?.ownerAuthId === currentUserAuthId ? paymentsTableCache.rows : null
  const [payments, setPayments] = useState<PaymentRow[]>(() => scopedPaymentsCache ?? [])
  const [paymentsLoading, setPaymentsLoading] = useState(() => !scopedPaymentsCache)
  const [searchQuery, setSearchQuery] = useState(() => (searchParams.get('globalSearch') || '').trim())
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<number[]>([])
  const [showBulkDownloadModal, setShowBulkDownloadModal] = useState(false)
  const [bulkDownloading, setBulkDownloading] = useState(false)
  const [downloadMode, setDownloadMode] = useState<'selected' | 'filtered'>('selected')
  const paymentGridTemplate = isFinanceDepartment ? PAYMENT_GRID_FINANCE : PAYMENT_GRID_STANDARD
  const paymentTableMinWidth = isFinanceDepartment ? '1880px' : '1828px'
  const now = new Date()
  const [quickDownloadType, setQuickDownloadType] = useState<QuickDownloadType | null>(null)
  const [quickYear, setQuickYear] = useState(now.getFullYear())
  const [quickWeek, setQuickWeek] = useState(getIsoWeek(now))
  const [quickMonth, setQuickMonth] = useState(now.getMonth() + 1)
  const [quickDay, setQuickDay] = useState(now.getDate())
  const [downloadFromDate, setDownloadFromDate] = useState('')
  const [downloadToDate, setDownloadToDate] = useState('')
  const [modalPreviewVisibleCount, setModalPreviewVisibleCount] = useState(MODAL_PREVIEW_INITIAL)
  const [bulkRenderPayload, setBulkRenderPayload] = useState<BulkRenderPayload | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [downloadStatusMessage, setDownloadStatusMessage] = useState('')
  const paymentsRefreshTimeoutRef = useRef<number | null>(null)

  useBodyScrollLock(showBulkDownloadModal && isFinanceDepartment)

  useEffect(() => {
    let active = true

    async function fetchPayments(options?: { background?: boolean }) {
      const isBackground = options?.background ?? false

      if (!profileLoaded || !accountType) {
        if (!isBackground && active) {
          setPaymentsLoading(true)
        }
        return
      }

      if (!isBackground && !scopedPaymentsCache && active) {
        setPaymentsLoading(true)
      }

      if (accountType === 'client') {
        if (clientData?.loading) {
          if (!isBackground && active) {
            setPaymentsLoading(true)
          }
          return
        }

        const invoiceIds = (clientData?.invoices ?? [])
          .map((invoice) => Number(invoice.id))
          .filter((id) => Number.isFinite(id) && id > 0)

        let paymentsQuery = supabase
          .from('payment_submissions')
          .select('id, invoice_id, full_name, phone, email, amount_paid, payment_method, payment_status, stripe_payment_intent_id, stripe_transaction_id, created_at')
          .order('created_at', { ascending: false })

        if (invoiceIds.length > 0) {
          paymentsQuery = paymentsQuery.in('invoice_id', invoiceIds)
        } else if (clientData?.clientEmail?.trim()) {
          paymentsQuery = paymentsQuery.ilike('email', clientData.clientEmail.trim())
        } else {
          if (active) {
            setPayments([])
            setPaymentsLoading(false)
          }
          return
        }

        const { data, error } = await paymentsQuery

        if (error) {
          logFetchError('Failed to fetch client payments', error)
          if (active) {
            setPayments([])
            setPaymentsLoading(false)
          }
          return
        }

        const nextRows = (((data as PaymentSubmissionRow[] | null) ?? []).map((row) => ({
          id: Number(row.id),
          invoiceId: row.invoice_id == null ? null : Number(row.invoice_id),
          invoiceCreator: '--',
          customer: (row.full_name || '').trim() || 'Customer',
          email: (row.email || '').trim() || '--',
          amount: Number(row.amount_paid ?? 0) || 0,
          phone: (row.phone || '').trim() || '--',
          paymentMethod: (row.payment_method || '').trim() || '--',
          stripeTransactionId: (row.stripe_transaction_id || row.stripe_payment_intent_id || '').trim() || '--',
          source: 'Client portal',
          createdAt: formatDateTime(row.created_at),
          rawCreatedAt: row.created_at ?? null,
          status: getPaymentStatusLabel(row.payment_status),
        })) as PaymentRow[])

        if (active) {
          setPayments(nextRows)
          setPaymentsLoading(false)
        }
        return
      }

      let data: PaymentSubmissionRow[] | null = null
      let error: { message?: string } | null = null

      if (isUserRole && currentEmployeeId != null) {
        const { data: invoiceMetaRows, error: invoiceMetaError } = await supabase
          .from('invoices')
          .select(`
            id,
            invoice_creator_id,
            brand_name,
            employees (
              employee_name
            )
          `)
          .eq('invoice_creator_id', currentEmployeeId)

        if (invoiceMetaError) {
          error = invoiceMetaError
        } else {
          const invoiceMetaList = (invoiceMetaRows as UserInvoiceMetaRow[] | null) ?? []
          const invoiceIds = invoiceMetaList
            .map((row) => Number(row.id))
            .filter((id) => Number.isFinite(id) && id > 0)

          if (invoiceIds.length === 0) {
            data = []
          } else {
            const invoiceMetaById = new Map<number, PaymentSubmissionRow['invoices']>()
            invoiceMetaList.forEach((row) => {
              invoiceMetaById.set(Number(row.id), {
                id: row.id,
                invoice_creator_id: row.invoice_creator_id,
                brand_name: row.brand_name,
                employees: row.employees ?? null,
              })
            })

            const { data: paymentRows, error: paymentError } = await supabase
              .from('payment_submissions')
              .select(`
                id,
                invoice_id,
                full_name,
                phone,
                email,
                amount_paid,
                payment_method,
                payment_status,
                stripe_payment_intent_id,
                stripe_transaction_id,
                created_at
              `)
              .in('invoice_id', invoiceIds)
              .order('created_at', { ascending: false })

            if (paymentError) {
              error = paymentError
            } else {
              data = (((paymentRows as Omit<PaymentSubmissionRow, 'invoices'>[] | null) ?? []).map((row) => ({
                ...row,
                invoices: row.invoice_id == null ? null : invoiceMetaById.get(Number(row.invoice_id)) ?? null,
              }))) as PaymentSubmissionRow[]
            }
          }
        }
      } else {
        const result = await supabase
          .from('payment_submissions')
          .select(`
            id,
            invoice_id,
            full_name,
            phone,
            email,
            amount_paid,
            payment_method,
            payment_status,
            stripe_payment_intent_id,
            stripe_transaction_id,
            created_at,
            invoices (
              id,
              invoice_creator_id,
              brand_name,
              status,
              employees (
                employee_name
              )
            )
          `)
          .order('created_at', { ascending: false })

        data = (result.data as PaymentSubmissionRow[] | null) ?? null
        error = result.error
      }

      if (error) {
        logFetchError('Failed to fetch payments', error)
        if (active) {
          setPayments([])
          setPaymentsLoading(false)
        }
        return
      }

      const rows = ((data as PaymentSubmissionRow[] | null) ?? []).map((row) => {
        const invoiceMeta = Array.isArray(row.invoices) ? row.invoices[0] ?? null : row.invoices ?? null
        const employeeMeta = Array.isArray(invoiceMeta?.employees)
          ? invoiceMeta?.employees[0] ?? null
          : invoiceMeta?.employees ?? null

        return {
          id: Number(row.id),
          invoiceId: row.invoice_id == null ? null : Number(row.invoice_id),
          invoiceCreator: (employeeMeta?.employee_name || '').trim() || '--',
          customer: (row.full_name || '').trim() || 'Customer',
          email: (row.email || '').trim() || '--',
          amount: Number(row.amount_paid ?? 0) || 0,
          phone: (row.phone || '').trim() || '--',
          paymentMethod: (row.payment_method || '').trim() || '--',
          stripeTransactionId: (row.stripe_transaction_id || row.stripe_payment_intent_id || '').trim() || '--',
          source: (invoiceMeta?.brand_name || '').trim() || '--',
          createdAt: formatDateTime(row.created_at),
          rawCreatedAt: row.created_at ?? null,
          status: getPaymentStatusLabel(row.payment_status),
          invoiceCreatorId: Number(invoiceMeta?.invoice_creator_id ?? 0) || null,
        }
      })

      const nextRows: PaymentRow[] = rows.map(({ invoiceCreatorId: _invoiceCreatorId, ...row }) => row)

      if (active) {
        paymentsTableCache = {
          ownerAuthId: currentUserAuthId,
          rows: nextRows,
        }
        setPayments(nextRows)
        setPaymentsLoading(false)
      }
    }

    void fetchPayments()

    // Supabase Realtime subscription for payment_submissions table
    const channelName = `payments-table-sync-${currentUserAuthId || 'unknown'}`
    const channel = supabase.channel(channelName)

    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'payment_submissions',
      },
      () => {
        if (paymentsRefreshTimeoutRef.current !== null) {
          window.clearTimeout(paymentsRefreshTimeoutRef.current)
        }
        paymentsRefreshTimeoutRef.current = window.setTimeout(() => {
          paymentsRefreshTimeoutRef.current = null
          void fetchPayments({ background: true })
        }, 180)
      }
    )
    channel.subscribe()

    return () => {
      active = false
      if (paymentsRefreshTimeoutRef.current !== null) {
        window.clearTimeout(paymentsRefreshTimeoutRef.current)
        paymentsRefreshTimeoutRef.current = null
      }
      void supabase.removeChannel(channel)
    }
  }, [accountType, clientData?.client?.id, clientData?.loading, currentEmployeeId, currentUserAuthId, isUserRole, profileLoaded, scopedPaymentsCache])

  useEffect(() => {
    const nextQuery = (searchParams.get('globalSearch') || '').trim()
    setSearchQuery((prev) => (prev === nextQuery ? prev : nextQuery))
  }, [searchParams])

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
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    paidPayments.forEach((payment) => {
      if (!payment.rawCreatedAt) return
      const parsed = new Date(payment.rawCreatedAt)
      if (!Number.isNaN(parsed.getTime())) {
        years.add(parsed.getFullYear())
      }
    })
    return Array.from(years).sort((a, b) => b - a)
  }, [paidPayments])
  const availableWeeks = useMemo(() => {
    const weeks = new Set<number>()
    paidPayments.forEach((payment) => {
      if (!payment.rawCreatedAt) return
      const parsed = new Date(payment.rawCreatedAt)
      if (Number.isNaN(parsed.getTime())) return
      if (getIsoWeekYear(parsed) === quickYear) {
        weeks.add(getIsoWeek(parsed))
      }
    })
    return Array.from(weeks).sort((a, b) => a - b)
  }, [paidPayments, quickYear])
  const availableMonths = useMemo(() => {
    const months = new Set<number>()
    paidPayments.forEach((payment) => {
      if (!payment.rawCreatedAt) return
      const parsed = new Date(payment.rawCreatedAt)
      if (Number.isNaN(parsed.getTime())) return
      if (parsed.getFullYear() === quickYear) {
        months.add(parsed.getMonth() + 1)
      }
    })
    return Array.from(months).sort((a, b) => a - b)
  }, [paidPayments, quickYear])
  const availableDays = useMemo(() => {
    const days = new Set<number>()
    paidPayments.forEach((payment) => {
      if (!payment.rawCreatedAt) return
      const parsed = new Date(payment.rawCreatedAt)
      if (Number.isNaN(parsed.getTime())) return
      if (parsed.getFullYear() === quickYear && parsed.getMonth() + 1 === quickMonth) {
        days.add(parsed.getDate())
      }
    })
    return Array.from(days).sort((a, b) => a - b)
  }, [paidPayments, quickMonth, quickYear])

  useEffect(() => {
    if (availableYears.length === 0) return
    if (!availableYears.includes(quickYear)) {
      setQuickYear(availableYears[0])
    }
  }, [availableYears, quickYear])

  useEffect(() => {
    if (quickDownloadType !== 'week') return
    if (availableWeeks.length === 0) return
    if (!availableWeeks.includes(quickWeek)) {
      setQuickWeek(availableWeeks[0])
    }
  }, [availableWeeks, quickDownloadType, quickWeek])

  useEffect(() => {
    if (quickDownloadType !== 'month' && quickDownloadType !== 'day') return
    if (availableMonths.length === 0) return
    if (!availableMonths.includes(quickMonth)) {
      setQuickMonth(availableMonths[0])
    }
  }, [availableMonths, quickDownloadType, quickMonth])

  useEffect(() => {
    if (quickDownloadType !== 'day') return
    if (availableDays.length === 0) return
    if (!availableDays.includes(quickDay)) {
      setQuickDay(availableDays[0])
    }
  }, [availableDays, quickDay, quickDownloadType])
  const filteredPaidPaymentsForModal = useMemo(() => {
    if (quickDownloadType) {
      return paidPayments.filter((payment) => {
        if (!payment.rawCreatedAt) return false
        const parsed = new Date(payment.rawCreatedAt)
        if (Number.isNaN(parsed.getTime())) return false

        if (quickDownloadType === 'all') return true
        if (quickDownloadType === 'week') {
          return getIsoWeekYear(parsed) === quickYear && getIsoWeek(parsed) === quickWeek
        }
        if (quickDownloadType === 'month') {
          return parsed.getFullYear() === quickYear && parsed.getMonth() + 1 === quickMonth
        }
        return parsed.getFullYear() === quickYear && parsed.getMonth() + 1 === quickMonth && parsed.getDate() === quickDay
      })
    }

    if (!downloadFromDate && !downloadToDate) return paidPayments

    const from = downloadFromDate ? new Date(`${downloadFromDate}T00:00:00`) : null
    const to = downloadToDate ? new Date(`${downloadToDate}T23:59:59.999`) : null

    return paidPayments.filter((payment) => {
      if (!payment.rawCreatedAt) return false
      const parsed = new Date(payment.rawCreatedAt)
      if (Number.isNaN(parsed.getTime())) return false
      if (from && parsed < from) return false
      if (to && parsed > to) return false
      return true
    })
  }, [downloadFromDate, downloadToDate, paidPayments, quickDay, quickDownloadType, quickMonth, quickWeek, quickYear])
  const modalDownloadCandidates = downloadMode === 'selected' ? selectedPaidPayments : filteredPaidPaymentsForModal
  const modalPreviewCandidates = useMemo(
    () => modalDownloadCandidates.slice(0, modalPreviewVisibleCount),
    [modalDownloadCandidates, modalPreviewVisibleCount]
  )
  const hiddenModalCandidatesCount = Math.max(0, modalDownloadCandidates.length - modalPreviewCandidates.length)
  const isDateRangeDisabled = quickDownloadType !== null
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

  function toggleQuickType(type: QuickDownloadType) {
    setQuickDownloadType((prev) => {
      const next = prev === type ? null : type
      if (next) {
        setDownloadFromDate('')
        setDownloadToDate('')
        setDownloadMode('filtered')
      }
      return next
    })
  }

  useEffect(() => {
    if (showBulkDownloadModal) {
      setModalPreviewVisibleCount(MODAL_PREVIEW_INITIAL)
      setDownloadProgress(0)
      setDownloadStatusMessage('')
    }
  }, [downloadMode, downloadFromDate, downloadToDate, quickDay, quickDownloadType, quickMonth, quickWeek, quickYear, selectedPaidPayments.length, showBulkDownloadModal])

  function showMoreModalCandidates() {
    setModalPreviewVisibleCount((prev) => Math.min(prev + MODAL_PREVIEW_STEP, modalDownloadCandidates.length))
  }

  function getProgressMessage(progress: number): string {
    if (progress >= 100) return 'Done!'
    if (progress >= 85) return 'Almost there, we are real close.'
    if (progress >= 50) return 'Half way there, hang on.'
    return 'We are downloading your files.'
  }

  function updateDownloadProgress(step: number, total: number) {
    const safeTotal = Math.max(1, total)
    const percent = Math.min(100, Math.max(1, Math.round((step / safeTotal) * 100)))
    setDownloadProgress(percent)
    setDownloadStatusMessage(getProgressMessage(percent))
  }

  function triggerBrowserDownload(blob: Blob, filename: string) {
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)
  }

  async function mapInvoicesForBulk(invoiceIds: number[]): Promise<Map<number, BulkRenderPayload>> {
    if (invoiceIds.length === 0) return new Map()

    const [{ data: invoiceData, error: invoiceError }, { data: brandData, error: brandError }] = await Promise.all([
      supabase
        .from('invoices')
        .select('*, employees!invoice_creator_id(employee_name), clients!client_id(name)')
        .in('id', invoiceIds),
      supabase.from('brands').select('id, brand_name, brand_url, logo_url').neq('isdeleted', true),
    ])

    if (invoiceError) throw invoiceError
    if (brandError) throw brandError

    const brands = (brandData ?? []) as BulkBrandOption[]
    const byId = new Map<number, BulkRenderPayload>()

    for (const row of (invoiceData ?? []) as Array<Record<string, unknown>>) {
      const invoiceId = Number(row.id ?? 0)
      if (!Number.isFinite(invoiceId) || invoiceId <= 0) continue

      const emp = row.employees as { employee_name?: string } | { employee_name?: string }[] | null
      const empObj = Array.isArray(emp) ? emp[0] : emp
      const clientObj = row.clients as { name?: string } | { name?: string }[] | null
      const relatedClientName = (Array.isArray(clientObj) ? clientObj[0] : clientObj)?.name ?? ''
      const storedClientName = typeof row.client_name === 'string' ? row.client_name : ''
      const clientName = storedClientName || relatedClientName
      const serviceRaw = Array.isArray(row.service) ? row.service : []

      const invoice: BulkInvoiceRow = {
        id: invoiceId,
        invoice_date: String(row.invoice_date ?? ''),
        invoice_creator_id: Number(row.invoice_creator_id ?? 0),
        invoice_creator: empObj?.employee_name ?? '--',
        client_id: row.client_id == null ? null : Number(row.client_id),
        client_name: clientName,
        brand_name: String(row.brand_name ?? ''),
        email: String(row.email ?? ''),
        service: serviceRaw as BulkInvoiceRow['service'],
        phone: String(row.phone ?? ''),
        amount: String(row.amount ?? ''),
        status: String(row.status ?? 'Pending'),
        payable_amount: row.payable_amount == null ? null : Number(row.payable_amount),
        paid_amount: Number(row.paid_amount ?? 0),
        invoice_type: String(row.invoice_type ?? 'Standard'),
      }

      byId.set(invoiceId, {
        invoice,
        brandMeta: brands.find((brand) => brand.brand_name === invoice.brand_name) ?? null,
      })
    }

    return byId
  }

  async function renderRootAsPdfBlob(root: HTMLElement, fallbackFileName: string, headerLabel: string): Promise<Blob> {
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
        const clonedRoot = clonedDocument.getElementById(BULK_PRINT_ROOT_ID)
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
      const headerBrand = (headerLabel || 'bmy brand').trim() || 'bmy brand'
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
      throw new Error(`Failed to render first PDF page for ${fallbackFileName}`)
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

    const out = pdf.output('blob')
    if (!out) {
      throw new Error(`Failed to create PDF blob for ${fallbackFileName}`)
    }
    return out
  }

  async function handleBulkDownloadSelected() {
    if (modalDownloadCandidates.length === 0 || bulkDownloading) return
    setBulkDownloading(true)
    setDownloadProgress(1)
    setDownloadStatusMessage('We are downloading your files.')

    try {
      const invoiceIds = Array.from(
        new Set(modalDownloadCandidates.map((payment) => payment.invoiceId).filter((id): id is number => id != null))
      )
      const totalSteps = Math.max(3, modalDownloadCandidates.length + 2)
      let completedSteps = 0

      const invoiceMap = await mapInvoicesForBulk(invoiceIds)
      completedSteps += 1
      updateDownloadProgress(completedSteps, totalSteps)

      if (modalDownloadCandidates.length > 1) {
        const zip = new JSZip()

        for (const payment of modalDownloadCandidates) {
          if (payment.invoiceId != null) {
            const payload = invoiceMap.get(payment.invoiceId)

            if (payload) {
              setBulkRenderPayload(payload)
              await new Promise((resolve) => window.setTimeout(resolve, 120))

              const root = document.getElementById(BULK_PRINT_ROOT_ID)
              if (root) {
                const brand = sanitizeFileName(payload.invoice.brand_name || payment.source || 'invoice') || 'invoice'
                const pdfName = `${brand}-${formatInvoiceCode(payload.invoice.id)}.pdf`
                const pdfBlob = await renderRootAsPdfBlob(root, pdfName, payload.invoice.brand_name || 'bmy brand')
                zip.file(pdfName, pdfBlob)
              }
            }
          }

          completedSteps += 1
          updateDownloadProgress(completedSteps, totalSteps)
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' })
        const zipName = `invoice-download-${new Date().toISOString().slice(0, 10)}.zip`
        triggerBrowserDownload(zipBlob, zipName)

        completedSteps += 1
        updateDownloadProgress(completedSteps, totalSteps)
      } else {
        const payment = modalDownloadCandidates[0]
        if (payment?.invoiceId != null) {
          const payload = invoiceMap.get(payment.invoiceId)
          if (payload) {
            setBulkRenderPayload(payload)
            await new Promise((resolve) => window.setTimeout(resolve, 120))

            const root = document.getElementById(BULK_PRINT_ROOT_ID)
            if (root) {
              const brand = sanitizeFileName(payload.invoice.brand_name || payment.source || 'invoice') || 'invoice'
              const pdfName = `${brand}-${formatInvoiceCode(payload.invoice.id)}.pdf`
              const pdfBlob = await renderRootAsPdfBlob(root, pdfName, payload.invoice.brand_name || 'bmy brand')
              triggerBrowserDownload(pdfBlob, pdfName)
            }
          }
        }

        completedSteps += 2
        updateDownloadProgress(completedSteps, totalSteps)
      }

      setDownloadProgress(100)
      setDownloadStatusMessage('Done!')
      await new Promise((resolve) => window.setTimeout(resolve, 500))
    } catch (error) {
      console.error('Bulk download failed', error)
    } finally {
      setBulkRenderPayload(null)
      setBulkDownloading(false)
      setShowBulkDownloadModal(false)
      setDownloadProgress(0)
      setDownloadStatusMessage('')
    }
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
          {isFinanceDepartment ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowBulkDownloadModal(true)}
                disabled={paidPayments.length === 0}
                className="flex h-12 min-w-36 shrink-0 items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 text-sm font-bold text-white shadow-[0px_4px_20px_0px_rgba(249,115,22,0.2)] transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none"
              >
                <PlusIcon className="h-4 w-3 text-white" />
                <span>Bulk Download</span>
              </button>
            </div>
          ) : null}
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
          <div className="w-full" style={{ minWidth: paymentTableMinWidth }}>
            <div className="grid w-full border-b border-slate-700 bg-slate-900/50" style={{ gridTemplateColumns: paymentGridTemplate }}>
              {[
                ...(isFinanceDepartment ? [''] : []),
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
                  ) : isFinanceDepartment ? (
                    <input
                      type="checkbox"
                      checked={allPagePaidSelected}
                      onChange={(e) => toggleSelectAllPagePaid(e.target.checked)}
                      disabled={selectablePagePaymentIds.length === 0}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-orange-500 focus:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Select all paid payments on this page"
                    />
                  ) : null}
                </div>
              ))}
              {isSuperAdmin && (
                <div className="flex items-center justify-end px-4 py-4 text-right sm:px-6">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Action</span>
                </div>
              )}
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
                  style={{ gridTemplateColumns: paymentGridTemplate }}
                >
                  {isFinanceDepartment ? (
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
                  ) : null}
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
                  {isSuperAdmin && (
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
                  )}
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

      {showBulkDownloadModal && isFinanceDepartment ? (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => !bulkDownloading && setShowBulkDownloadModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
            <div className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
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
                <div className="mb-4 rounded-xl border border-slate-700 bg-slate-800/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Download mode</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDownloadMode('selected')}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                        downloadMode === 'selected'
                          ? 'border-orange-400 bg-orange-500/20 text-orange-200'
                          : 'border-slate-700 text-slate-300 hover:bg-slate-700/60'
                      }`}
                    >
                      Tick Selection ({selectedPaidPayments.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setDownloadMode('filtered')}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                        downloadMode === 'filtered'
                          ? 'border-orange-400 bg-orange-500/20 text-orange-200'
                          : 'border-slate-700 text-slate-300 hover:bg-slate-700/60'
                      }`}
                    >
                      Quick / Date Filter ({filteredPaidPaymentsForModal.length})
                    </button>
                  </div>

                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Quick download</p>
                  <p className="mt-1 text-xs text-slate-500">Click again to unselect.</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {([
                      { key: 'all', label: 'All paid' },
                      { key: 'week', label: 'Week + Year' },
                      { key: 'month', label: 'Month + Year' },
                      { key: 'day', label: 'Day + Month + Year' },
                    ] as Array<{ key: QuickDownloadType; label: string }>).map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => toggleQuickType(option.key)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                          quickDownloadType === option.key
                            ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                            : 'border-slate-700 text-slate-300 hover:bg-slate-700/60'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  {quickDownloadType === 'week' ? (
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <select
                        value={quickYear}
                        onChange={(e) => setQuickYear(Number(e.target.value))}
                        className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200"
                      >
                        {availableYears.length > 0 ? (
                          availableYears.map((year) => (
                            <option key={year} value={year}>{year}</option>
                          ))
                        ) : (
                          <option value="">No years</option>
                        )}
                      </select>
                      <select
                        value={quickWeek}
                        onChange={(e) => setQuickWeek(Number(e.target.value))}
                        className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200"
                      >
                        {availableWeeks.length > 0 ? (
                          availableWeeks.map((week) => (
                            <option key={week} value={week}>{formatWeekOptionLabel(quickYear, week)}</option>
                          ))
                        ) : (
                          <option value="">No weeks</option>
                        )}
                      </select>
                    </div>
                  ) : null}

                  {quickDownloadType === 'month' || quickDownloadType === 'day' ? (
                    <div className={`mt-3 grid grid-cols-1 gap-2 ${quickDownloadType === 'day' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                      <select
                        value={quickYear}
                        onChange={(e) => setQuickYear(Number(e.target.value))}
                        className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200"
                      >
                        {availableYears.length > 0 ? (
                          availableYears.map((year) => (
                            <option key={year} value={year}>{year}</option>
                          ))
                        ) : (
                          <option value="">No years</option>
                        )}
                      </select>
                      <select
                        value={quickMonth}
                        onChange={(e) => setQuickMonth(Number(e.target.value))}
                        className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200"
                      >
                        {availableMonths.length > 0 ? (
                          availableMonths.map((month) => (
                            <option key={month} value={month}>
                              {new Date(2000, month - 1, 1).toLocaleString('en-US', { month: 'long' })}
                            </option>
                          ))
                        ) : (
                          <option value="">No months</option>
                        )}
                      </select>
                      {quickDownloadType === 'day' ? (
                        <select
                          value={quickDay}
                          onChange={(e) => setQuickDay(Number(e.target.value))}
                          className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200"
                        >
                          {availableDays.length > 0 ? (
                            availableDays.map((day) => (
                              <option key={day} value={day}>Day {day}</option>
                            ))
                          ) : (
                            <option value="">No days</option>
                          )}
                        </select>
                      ) : null}
                    </div>
                  ) : null}

                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">From / To date</p>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      type="date"
                      value={downloadFromDate}
                      disabled={isDateRangeDisabled}
                      onChange={(e) => {
                        setDownloadMode('filtered')
                        setDownloadFromDate(e.target.value)
                      }}
                      className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <input
                      type="date"
                      value={downloadToDate}
                      disabled={isDateRangeDisabled}
                      onChange={(e) => {
                        setDownloadMode('filtered')
                        setDownloadToDate(e.target.value)
                      }}
                      className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                  {isDateRangeDisabled ? (
                    <p className="mt-2 text-xs text-amber-300">From/To is disabled while a quick option is selected. Click the selected quick option again to clear it.</p>
                  ) : null}
                  {downloadMode === 'filtered' && quickDownloadType === 'all' ? (
                    <p className="mt-2 text-xs text-emerald-300">Download All creates one ZIP in the background without opening invoice pages.</p>
                  ) : null}
                </div>

                {modalDownloadCandidates.length === 0 ? (
                  <p className="text-sm text-slate-400">No paid invoices match your current download mode and filters.</p>
                ) : (
                  <div className="space-y-3">
                    {modalPreviewCandidates.map((payment) => (
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
                        {downloadMode === 'selected' ? (
                          <button
                            type="button"
                            onClick={() => togglePaymentSelection(payment.id, false)}
                            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-slate-700"
                          >
                            Remove
                          </button>
                        ) : (
                          <span className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400">Matched</span>
                        )}
                      </div>
                    ))}
                    {hiddenModalCandidatesCount > 0 ? (
                      <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
                        Showing {modalPreviewCandidates.length} of {modalDownloadCandidates.length}. {hiddenModalCandidatesCount} more matched and will still be downloaded.
                      </div>
                    ) : null}
                    {hiddenModalCandidatesCount > 0 ? (
                      <div className="flex justify-center pt-1">
                        <button
                          type="button"
                          onClick={showMoreModalCandidates}
                          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
                        >
                          Show more
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-700 px-5 py-4">
                {bulkDownloading ? (
                  <div className="mb-3">
                    <div className="h-5 w-full overflow-hidden rounded-full bg-slate-700/70">
                      <div
                        className="h-full rounded-full bg-orange-500 transition-all duration-300"
                        style={{ width: `${downloadProgress}%` }}
                      />
                    </div>
                    <p className="mt-2 text-sm text-slate-300">{downloadStatusMessage || 'We are downloading your files.'}</p>
                  </div>
                ) : null}

                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-400">
                    {modalDownloadCandidates.length} paid invoice{modalDownloadCandidates.length === 1 ? '' : 's'} ready
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
                      disabled={modalDownloadCandidates.length === 0 || bulkDownloading}
                      className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {bulkDownloading
                        ? modalDownloadCandidates.length > 1
                          ? 'Preparing ZIP...'
                          : 'Preparing PDF...'
                        : downloadMode === 'selected'
                          ? 'Download Selected'
                          : quickDownloadType === 'all'
                            ? 'Download All'
                            : 'Download Filtered'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {/* Hidden render for bulk PDF generation - only renders when bulk download starts */}
      {bulkRenderPayload ? (
        <div className="pointer-events-none fixed -left-2500 top-0 z-[-1] w-231">
          <InvoiceDocument
            invoice={bulkRenderPayload.invoice}
            brandMeta={bulkRenderPayload.brandMeta}
            canDownloadPdf
            showPaidWatermark={String(bulkRenderPayload.invoice.status || '').toLowerCase().includes('paid') || String(bulkRenderPayload.invoice.status || '').toLowerCase().includes('completed')}
            onDownload={() => {}}
            onPrint={() => {}}
            rootId={BULK_PRINT_ROOT_ID}
            includeDownloadButton={false}
            showStatusBadge
            showPayableSummary={bulkRenderPayload.invoice.payable_amount != null}
            payableAmount={(() => {
              const subtotal = (bulkRenderPayload.invoice.service || []).reduce(
                (sum, line) => sum + (Number(line.qty) || 0) * Number(String(line.price || '').replace(/[^0-9.-]/g, '')),
                0
              )
              return Math.min(Number(bulkRenderPayload.invoice.payable_amount ?? 0), subtotal)
            })()}
            remainingAmount={(() => {
              const subtotal = (bulkRenderPayload.invoice.service || []).reduce(
                (sum, line) => sum + (Number(line.qty) || 0) * Number(String(line.price || '').replace(/[^0-9.-]/g, '')),
                0
              )
              const payable = Math.min(Number(bulkRenderPayload.invoice.payable_amount ?? 0), subtotal)
              return Math.max(subtotal - payable, 0)
            })()}
            summaryActions={null}
          />
        </div>
      ) : null}
    </div>
  )
}
