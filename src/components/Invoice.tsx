'use client'

import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useDashboardProfile } from '@/components/DashboardLayout'
import { useClientDashboardData } from '@/context/ClientDashboardDataContext'
import { useSessionContext } from '@/context/SessionContext'
import { getInvoiceLink as getSignedInvoiceLink } from '@/app/actions/invoice-link'
import { formatInvoiceCode } from '@/lib/invoice-code'
import { clearRequiredFieldInvalid, handleRequiredFieldInvalid } from '@/lib/form-validation'
import { logFetchError } from '@/lib/fetch-error'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'

const plusJakarta = Plus_Jakarta_Sans({ subsets: ['latin'] })

type EmployeeOption = { id: number; employee_name: string }
type BrandOption = {
  id: number
  brand_name: string
  brand_url: string
  logo_url: string
}

type ServiceLine = {
  description: string
  qty: number
  price: string
}

type ClientOption = { id: number; name: string; email: string; phone: string }
type BmyRecipientMode = 'registered' | 'manual'

type InvoiceRow = {
  id: number
  invoice_date: string
  invoice_creator_id: number
  invoice_creator: string
  client_id: number | null
  parent_invoice_id?: number | null
  brand_id?: number | null
  client_name: string
  brand_name: string
  email: string
  service: ServiceLine[]
  phone: string
  amount: string
  status: string
  payable_amount: number | null
  paid_amount: number
  invoice_type: string
  currency: InvoiceCurrency
}

function isMissingBrandIdColumnError(error: { message?: string | null } | null | undefined) {
  return isMissingColumnError(error, 'brand_id')
}

function isMissingColumnError(error: { message?: string | null } | null | undefined, column: string) {
  const message = (error?.message || '').toLowerCase()
  return message.includes(column.toLowerCase()) && message.includes('does not exist')
}

type InvoiceWithServiceField = InvoiceRow & {
  service?: unknown
}

type PaymentSubmissionRow = {
  invoice_id: number | null
  amount_paid: string | number | null
  payment_status: string | null
}

type RealtimeInvoiceRow = {
  id?: number | null
  client_id?: number | null
  invoice_creator_id?: number | null
}

type RealtimePaymentSubmissionRow = {
  invoice_id?: number | null
}

type InvoiceScopedCache = {
  ownerAuthId: string | null
  rows: InvoiceRow[]
}

let invoiceTableCache: InvoiceScopedCache | null = null

type ActionMenuState = {
  id: number
  top: number
  left: number
}

type GatewayLimitInfo = {
  name: string
  minAmount: number
  maxAmount: number | null
}

type DueInvoiceModalState = {
  invoice: InvoiceRow
  mode: 'full' | 'custom'
  amount: string
  loading: boolean
  error: string | null
  gatewayLimits: GatewayLimitInfo[]
  gatewayInfoOpen: boolean
}

const INVOICE_GRID = 'minmax(48px,0.6fr) minmax(100px,1.2fr) minmax(100px,1.2fr) minmax(100px,1.2fr) minmax(100px,1.2fr) minmax(140px,1.5fr) minmax(90px,1.15fr) minmax(100px,1.2fr) minmax(120px,1.2fr) minmax(90px,1fr) 72px'

function SearchIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  )
}

function PencilIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
    </svg>
  )
}

function InfoIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25h1.5v5.25h-1.5zM12 8.25h.008v.008H12z" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}

function TrashIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  )
}

function PlusIcon({ className = 'h-4 w-3' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
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

function ChevronDownIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  )
}

function EllipsisVerticalIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75h.008v.008H12V6.75zm0 5.25h.008v.008H12V12zm0 5.25h.008v.008H12v-.008z" />
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

function CopyIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25H18a2.25 2.25 0 002.25-2.25V6A2.25 2.25 0 0018 3.75H9A2.25 2.25 0 006.75 6v2.25" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 8.25h9A2.25 2.25 0 0117.25 10.5v7.5A2.25 2.25 0 0115 20.25H6A2.25 2.25 0 013.75 18v-7.5A2.25 2.25 0 016 8.25z" />
    </svg>
  )
}

function getStatusStyle(status: string): string {
  const s = (status || '').toLowerCase()
  if (s.includes('partial')) return 'bg-sky-500/10 text-sky-300 border-sky-500/20'
  if (s.includes('paid') || s.includes('completed')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  if (s.includes('processing')) return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
  if (s.includes('pending') || s.includes('payable')) return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
  if (s.includes('overdue') || s.includes('cancelled')) return 'bg-red-500/10 text-red-400 border-red-500/20'
  return 'bg-slate-500/10 text-slate-400 border-slate-500/20'
}

function parseAmountValue(amount: unknown): number {
  const n = Number(String(amount ?? '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

const INVOICE_CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD - US Dollar', prefix: 'USD' },
  { value: 'CAD', label: 'CAD - Canadian Dollar', prefix: 'CAD' },
] as const

type InvoiceCurrency = (typeof INVOICE_CURRENCY_OPTIONS)[number]['value']

function normalizeInvoiceCurrency(value: unknown): InvoiceCurrency {
  const normalized = String(value ?? '').trim().toUpperCase()
  return normalized === 'CAD' ? 'CAD' : 'USD'
}

function formatCurrencyAmount(amount: number, currency: InvoiceCurrency, includeCurrencyCode = true): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0
  const formattedAmount = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(safeAmount)

  return `$${formattedAmount}${includeCurrencyCode ? ` ${currency}` : ''}`
}

function getCurrencyPrefix(): string {
  return '$'
}

function CurrencyPrefixSelect({
  id,
  value,
  onChange,
}: {
  id: string
  value: InvoiceCurrency
  onChange: (value: InvoiceCurrency) => void
}) {
  const widthClass = 'w-[72px]'

  return (
    <span className="relative inline-flex shrink-0 items-center">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(normalizeInvoiceCurrency(e.target.value))}
        aria-label="Currency"
        className={`h-9 ${widthClass} appearance-none rounded-md bg-transparent py-0 pl-0 pr-6 text-xl font-black text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20`}
      >
        {INVOICE_CURRENCY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.prefix}</option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-slate-500" />
    </span>
  )
}

function toServiceLines(value: unknown): ServiceLine[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        const rec = item as Record<string, unknown>
        return {
          description: String(rec.description ?? '').trim(),
          qty: Number(rec.qty ?? 1) || 1,
          price: String(rec.price ?? '').trim(),
        }
      })
      .filter((line) => line.description || line.price)
  }
  if (typeof value === 'string' && value.trim()) {
    return [{ description: value.trim(), qty: 1, price: '' }]
  }
  return []
}

function serviceLineTotal(line: ServiceLine): number {
  return (Number(line.qty) || 0) * parseAmountValue(line.price)
}

function servicesSubtotal(lines: ServiceLine[]): number {
  return lines.reduce((sum, line) => sum + serviceLineTotal(line), 0)
}

function serviceSummary(lines: ServiceLine[]): string {
  if (lines.length === 0) return '--'
  if (lines.length === 1) return lines[0].description || '1 service'
  return `${lines.length} services`
}

function getInvoiceGatewayValidationAmount(
  status: string,
  subTotal: number,
  payableAmount: number
): number {
  if (isAdvanceUnpaidStatus(status)) {
    return payableAmount
  }
  return subTotal
}

function isGatewayLimitBlockingError(message: string | null): boolean {
  return (message || '').includes('Invoice amount exceeds the active payment gateway limit')
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

function formatGatewayLimitAmount(amount: number | null): string {
  if (amount == null) return 'No maximum'
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function GatewayLimitAlert({
  message,
  gateways,
  infoOpen,
  onToggleInfo,
}: {
  message: string
  gateways: GatewayLimitInfo[]
  infoOpen: boolean
  onToggleInfo: () => void
}) {
  const hasGatewayInfo = gateways.length > 0

  return (
    <div className="mx-10 mt-4 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-700">
      <div className="relative flex items-start justify-between gap-3">
        <p>{message}</p>
        {hasGatewayInfo ? (
          <button
            type="button"
            onClick={onToggleInfo}
            aria-expanded={infoOpen}
            aria-label="Show active gateway limits"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-red-400/60 bg-white/70 text-red-700 transition hover:bg-white"
          >
            <InfoIcon className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {infoOpen && hasGatewayInfo ? (
        <div className="mt-3 rounded-lg border border-red-300/40 bg-white/70 px-4 py-3 text-xs text-red-900">
          <p className="font-semibold uppercase tracking-wide text-red-800">Active Gateway Limits</p>
          <div className="mt-2 space-y-2">
            {gateways.map((gateway) => (
              <div
                key={`${gateway.name}-${gateway.minAmount}-${gateway.maxAmount ?? 'none'}`}
                className="flex justify-between gap-4"
              >
                <span className="font-medium">{gateway.name}</span>
                <span>
                  {formatGatewayLimitAmount(gateway.minAmount)} to {formatGatewayLimitAmount(gateway.maxAmount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function addDaysToISODate(dateStr: string, days: number): string {
  const fallback = new Date().toISOString().slice(0, 10)
  const base = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : fallback
  const [year, month, day] = base.split('-').map(Number)
  const dt = new Date(Date.UTC(year, month - 1, day))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

function sanitizePriceInput(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, '')
  const parts = cleaned.split('.')
  if (parts.length <= 1) return cleaned
  return `${parts[0]}.${parts.slice(1).join('')}`
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isValidPrice(value: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(value.trim())
}

function normalizeBrandName(value: string): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, '')
}

function isFigmaBrand(value: string): boolean {
  return normalizeBrandName(value) === 'figma'
}

function isBmyBrand(value: string): boolean {
  const normalized = normalizeBrandName(value)
  return normalized === 'bmybrand' || normalized === 'bmy'
}

function isAdvanceUnpaidStatus(status: string): boolean {
  const normalized = (status || '').toLowerCase()
  return normalized.includes('payable') || normalized.includes('pending')
}

function isSettledInvoiceStatus(status: string): boolean {
  const normalized = (status || '').toLowerCase()
  return normalized.includes('paid') || normalized.includes('completed')
}

function isInvoicePaid(inv: Pick<InvoiceRow, 'status' | 'amount' | 'payable_amount' | 'paid_amount'>): boolean {
  const requiredAmount = inv.payable_amount != null && inv.payable_amount > 0
    ? inv.payable_amount
    : parseAmountValue(inv.amount)
  if (requiredAmount > 0 && inv.paid_amount >= requiredAmount) return true
  return isSettledInvoiceStatus(inv.status) && getRemainingInvoiceAmount(inv) <= 0
}

function isInvoicePartiallyPaid(inv: Pick<InvoiceRow, 'amount' | 'paid_amount'>): boolean {
  const paidAmount = Number(inv.paid_amount) || 0
  return paidAmount > 0 && getRemainingInvoiceAmount(inv) > 0
}

function hasInvoicePayment(inv: Pick<InvoiceRow, 'status' | 'amount' | 'payable_amount' | 'paid_amount'>): boolean {
  return isInvoicePaid(inv) || isInvoicePartiallyPaid(inv)
}

function getRemainingInvoiceAmount(inv: Pick<InvoiceRow, 'amount' | 'paid_amount'>): number {
  return Math.max(parseAmountValue(inv.amount) - (Number(inv.paid_amount) || 0), 0)
}

function getInvoiceDisplayStatus(inv: Pick<InvoiceRow, 'status' | 'amount' | 'paid_amount'>): string {
  const totalAmount = parseAmountValue(inv.amount)
  const paidAmount = Number(inv.paid_amount) || 0
  const remainingAmount = getRemainingInvoiceAmount(inv)

  if (totalAmount > 0 && paidAmount > 0 && remainingAmount > 0) {
    return 'Partially Paid'
  }

  if (totalAmount > 0 && remainingAmount > 0 && isSettledInvoiceStatus(inv.status)) {
    return 'Partially Paid'
  }

  if ((totalAmount > 0 && remainingAmount <= 0) || isSettledInvoiceStatus(inv.status)) {
    return 'Paid'
  }

  return inv.status || 'Unpaid'
}

function sanitizeCurrencyInput(value: string): string {
  return sanitizePriceInput(value)
}

const INVOICE_TYPE_OPTIONS = ['Standard', 'Upsale'] as const

function areInvoiceRowsEqual(a: InvoiceRow[], b: InvoiceRow[]) {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function InvoiceDocument({
  invoice,
  brandMeta,
  canDownloadPdf,
  showPaidWatermark,
  onDownload,
  onPrint,
  rootId,
  includeDownloadButton = true,
  showStatusBadge = true,
  summaryActions,
  showPayableSummary = false,
  payableAmount,
  remainingAmount,
  onGrandTotalClick,
  paymentFormContent,
}: {
  invoice: InvoiceRow
  brandMeta: BrandOption | null
  canDownloadPdf: boolean
  showPaidWatermark: boolean
  onDownload: () => void
  onPrint?: () => void
  rootId?: string
  includeDownloadButton?: boolean
  showStatusBadge?: boolean
  summaryActions?: ReactNode
  showPayableSummary?: boolean
  payableAmount?: number
  remainingAmount?: number
  onGrandTotalClick?: () => void
  paymentFormContent?: ReactNode
}) {
  const serviceLines = toServiceLines((invoice as InvoiceWithServiceField).service)
  const subTotal = servicesSubtotal(serviceLines)
  const grandTotal = subTotal
  const invoiceType = invoice.invoice_type || 'Standard'
  const invoiceCurrency = normalizeInvoiceCurrency(invoice.currency)
  const normalizedStatus = (invoice.status || '').toLowerCase()
  const displayStatus = getInvoiceDisplayStatus(invoice)
  const payableSummaryLabel =
    normalizedStatus.includes('paid') || normalizedStatus.includes('completed')
      ? 'Paid Amount'
      : 'Payable Amount'
  const showBmyFooter = isBmyBrand(invoice.brand_name)

  return (
    <div id={rootId} className="relative flex min-h-[1120px] flex-col overflow-visible bg-white shadow-xl md:min-h-[1280px] print:min-h-0 print:overflow-visible">
      {showPaidWatermark && displayStatus === 'Paid' && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <span className="-rotate-[24deg] select-none text-[180px] font-black uppercase leading-none tracking-[0.12em] text-emerald-500/8">
            Paid
          </span>
        </div>
      )}
      <div className="flex flex-1 flex-col">
      <div className="invoice-header invoice-print-header flex items-center justify-between bg-slate-900 px-10 py-8">
        <div className="flex items-center gap-4">
          <div className="h-16 w-44 flex items-center justify-start">
            {brandMeta?.logo_url ? (
              <img src={brandMeta.logo_url} alt={invoice.brand_name} className="max-h-16 w-auto object-contain" />
            ) : (
              <div className="h-6 w-6 border border-white/60 rounded-sm" />
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-4xl font-black uppercase tracking-wide text-orange-600">Invoice</p>
          {includeDownloadButton && canDownloadPdf && (
            <div className="no-print print-hide-download print:hidden mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={onDownload}
                className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-xs font-bold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
                title="Download invoice PDF"
              >
                <span className="inline-block h-2 w-2 rounded-sm bg-white" />
                Download PDF
              </button>
              <button
                type="button"
                onClick={onPrint}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-400"
                title="Print invoice"
              >
                Print
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="invoice-meta-grid relative z-10 grid grid-cols-1 gap-10 px-10 py-8 md:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Invoice To</p>
          <p className="mt-2 text-xl font-bold text-slate-900">{invoice.client_name || "" }</p>
          <div className="mt-3 space-y-1 text-sm text-slate-600">
            <p>{invoice.email || 'ketut.susilo@example.com'}</p>
            <p>{invoice.phone || '+1 (555) 000-1234'}</p>
          </div>
        </div>

        <div className="md:justify-self-end">
          <div className="w-full max-w-xs space-y-3">
            <div className="flex justify-between border-b border-slate-100 pb-2 text-sm">
              <span className="text-slate-500">Invoice Number</span>
              <span className="font-bold text-slate-900">#{formatInvoiceCode(invoice.id)}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2 text-sm">
              <span className="text-slate-500">Issue Date</span>
              <span className="font-bold text-slate-900">{invoice.invoice_date || new Date().toISOString().slice(0, 10)}</span>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2 text-sm">
              <span className="text-slate-500">Due Date</span>
              <span className="font-bold text-slate-900">{addDaysToISODate(invoice.invoice_date || new Date().toISOString().slice(0, 10), 30)}</span>
            </div>
            {showStatusBadge && (
              <div className="pt-1">
                <span className={`inline-block rounded-lg border px-3 py-1 text-xs font-semibold ${getStatusStyle(displayStatus)}`}>
                  {displayStatus}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="invoice-services-wrap relative z-10 mx-10 overflow-hidden rounded-xl border border-slate-200">
        <div className="invoice-services-head invoice-services-head-print grid grid-cols-[72px_1fr_160px] bg-slate-50 px-4 py-4 text-xs font-bold uppercase tracking-wide text-slate-700">
          <span>No</span><span>Description</span><span className="text-right">Price</span>
        </div>
        {serviceLines.length === 0 ? (
          <div className="border-t border-slate-100 px-4 py-4 text-sm text-slate-500">No services added.</div>
        ) : (
          serviceLines.map((line, idx) => (
            <div key={`view-service-${idx}`} className="invoice-services-row grid grid-cols-[72px_1fr_160px] border-t border-slate-100 px-4 py-4 text-sm">
              <span className="text-slate-700">{String(idx + 1).padStart(2, '0')}</span>
              <span className="text-slate-800">{line.description || 'Service'}</span>
              <span className="text-right text-slate-700">{formatCurrencyAmount(parseAmountValue(line.price), invoiceCurrency)}</span>
            </div>
          ))
        )}
      </div>

      <div className="invoice-summary-grid relative z-10 grid grid-cols-1 gap-8 px-10 py-8 md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="invoice-details-column space-y-5">
          <div>
            <p className="text-sm font-bold text-slate-900">Payment Details</p>
            <div className="invoice-payment-box mt-2 rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
              <p><span className="font-semibold text-slate-800">Card payments:</span> Stripe</p>
              <p className="mt-1"><span className="font-semibold text-slate-800">Invoice type:</span> {invoiceType}</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-bold text-slate-900">Terms & Conditions</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Please review our{' '}
              <a href="https://bmybrand.com/terms-of-use" target="_blank" rel="noopener noreferrer" className="font-semibold text-orange-600 hover:text-orange-700">
                Terms & Conditions
              </a>{' '}
              and{' '}
              <a href="https://bmybrand.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="font-semibold text-orange-600 hover:text-orange-700">
                Privacy Policy
              </a>
              .
            </p>
          </div>
        </div>

        <div className="invoice-totals-block w-full md:justify-self-end md:w-80">
          <div className="space-y-2 text-sm">
            <div
              className={`invoice-grand-total flex justify-between rounded-lg px-1 py-2 ${onGrandTotalClick ? 'cursor-pointer hover:bg-slate-100 transition-colors no-print' : ''}`}
              role={onGrandTotalClick ? 'button' : undefined}
              tabIndex={onGrandTotalClick ? 0 : undefined}
              onClick={onGrandTotalClick}
              onKeyDown={onGrandTotalClick ? (e) => e.key === 'Enter' && onGrandTotalClick() : undefined}
            >
              <span className="text-slate-600">Total</span>
              <span className="font-medium text-slate-700">{formatCurrencyAmount(grandTotal, invoiceCurrency)}</span>
            </div>
            {showPayableSummary ? (
              <>
                <div className="rounded-xl bg-orange-600 p-4 text-white">
                  <span className="block text-xs font-bold uppercase tracking-wide text-orange-100">{payableSummaryLabel}</span>
                  <p className="mt-2 text-2xl font-black">
                    {formatCurrencyAmount(payableAmount ?? 0, invoiceCurrency)}
                  </p>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Remaining</span>
                  <span className="font-medium text-slate-700">
                    {formatCurrencyAmount(remainingAmount ?? 0, invoiceCurrency)}
                  </span>
                </div>
              </>
            ) : null}
            {summaryActions}
          </div>
        </div>
      </div>
      {paymentFormContent ? (
        <div className="no-print relative z-10 px-10 pb-8">
          {paymentFormContent}
        </div>
      ) : null}
      </div>

      {showBmyFooter ? (
        <div id="invoice-print-footer" className="invoice-footer-contact mt-auto shrink-0 relative z-10 border-t border-slate-200 bg-slate-50 px-10 py-6 text-sm text-slate-500">
          +14695011401 | www.bmybrand.com | billing@bmybrand.com
        </div>
      ) : null}
    </div>
  )
}

export default function Invoice() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { displayRole, displayDepartment, accountType, currentEmployeeId, currentUserAuthId, profileLoaded } = useDashboardProfile()
  const normalizedRole = (displayRole || '').trim().toLowerCase().replace(/\s+/g, '')
  const normalizedDepartment = (displayDepartment || '').trim().toLowerCase()
  const isUserRole = normalizedRole === 'user'
  const isSuperAdmin = normalizedRole === 'superadmin'
  const isSalesAdmin = normalizedRole === 'salesadmin' || (normalizedRole === 'admin' && normalizedDepartment.includes('sales'))
  const isFinanceDepartment = normalizedDepartment.includes('finance')
  const clientData = useClientDashboardData()
  const scopedInvoiceCache = invoiceTableCache?.ownerAuthId === currentUserAuthId ? invoiceTableCache.rows : null
  const hasScopedInvoiceCache = Boolean(scopedInvoiceCache)
  const [invoices, setInvoices] = useState<InvoiceRow[]>(() => scopedInvoiceCache ?? [])
  const [invoicesLoading, setInvoicesLoading] = useState(() => !hasScopedInvoiceCache)
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [brands, setBrands] = useState<BrandOption[]>([])
  const [searchQuery, setSearchQuery] = useState(() => (searchParams.get('globalSearch') || '').trim())
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all')
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addClientId, setAddClientId] = useState<number | null>(null)
  const [addBmyRecipientMode, setAddBmyRecipientMode] = useState<BmyRecipientMode>('registered')
  const [addClientName, setAddClientName] = useState('')
  const [addBrand, setAddBrand] = useState('')
  const [addEmail, setAddEmail] = useState('')
  const [addServices, setAddServices] = useState<ServiceLine[]>([{ description: '', qty: 1, price: '' }])
  const [addPhone, setAddPhone] = useState('')
  const [addStatus, setAddStatus] = useState('Pending')
  const [addPayableAmount, setAddPayableAmount] = useState('')
  const [addInvoiceType, setAddInvoiceType] = useState<string>(INVOICE_TYPE_OPTIONS[0])
  const [addCurrency, setAddCurrency] = useState<InvoiceCurrency>('USD')
  const [savedAddInvoiceId, setSavedAddInvoiceId] = useState<number | null>(null)
  const [savedAddInvoiceUrl, setSavedAddInvoiceUrl] = useState('')
  const [addUrlCopied, setAddUrlCopied] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [addGatewayLimits, setAddGatewayLimits] = useState<GatewayLimitInfo[]>([])
  const [addGatewayInfoOpen, setAddGatewayInfoOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<InvoiceRow | null>(null)
  const [editClientId, setEditClientId] = useState<number | null>(null)
  const [editBmyRecipientMode, setEditBmyRecipientMode] = useState<BmyRecipientMode>('registered')
  const [editClientName, setEditClientName] = useState('')
  const [editBrand, setEditBrand] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editServices, setEditServices] = useState<ServiceLine[]>([{ description: '', qty: 1, price: '' }])
  const [editPhone, setEditPhone] = useState('')
  const [editStatus, setEditStatus] = useState('Pending')
  const [editPayableAmount, setEditPayableAmount] = useState('')
  const [editPaidAmountTotal, setEditPaidAmountTotal] = useState(0)
  const [editInvoiceType, setEditInvoiceType] = useState<string>(INVOICE_TYPE_OPTIONS[0])
  const [editCurrency, setEditCurrency] = useState<InvoiceCurrency>('USD')
  const [editInvoiceUrl, setEditInvoiceUrl] = useState('')
  const [editUrlCopied, setEditUrlCopied] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editGatewayLimits, setEditGatewayLimits] = useState<GatewayLimitInfo[]>([])
  const [editGatewayInfoOpen, setEditGatewayInfoOpen] = useState(false)
  const [deletingInvoice, setDeletingInvoice] = useState<InvoiceRow | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [dueInvoiceModal, setDueInvoiceModal] = useState<DueInvoiceModalState | null>(null)
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const realtimeRefreshTimeoutRef = useRef<number | null>(null)
  const invoiceIdsRef = useRef<number[]>(scopedInvoiceCache?.map((invoice) => invoice.id) ?? [])
  const { token } = useSessionContext()

  useBodyScrollLock(Boolean(showAddModal || editingInvoice || deletingInvoice || dueInvoiceModal))

  async function resolveAccessToken() {
    const accessToken = token?.trim() || ''
    if (accessToken) return accessToken

    const { data, error } = await supabase.auth.getSession()
    if (error) {
      return ''
    }

    return data.session?.access_token?.trim() || ''
  }

  async function validateGatewayAmountForInvoice(amount: number): Promise<{
    error: string | null
    gateways: GatewayLimitInfo[]
  }> {
    const accessToken = await resolveAccessToken()
    if (!accessToken) {
      return {
        error: 'Authentication required to validate payment gateway limits.',
        gateways: [],
      }
    }

    try {
      const res = await fetch(
        `/api/payment-gateways/validate-amount?amount=${encodeURIComponent(String(amount))}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        gateways?: GatewayLimitInfo[]
      }

      if (!res.ok) {
        return {
          error:
            data.error?.trim() ||
            'Invoice amount exceeds the active payment gateway limit. Adjust the amount or update gateway settings.',
          gateways: Array.isArray(data.gateways) ? data.gateways : [],
        }
      }

      return { error: null, gateways: [] }
    } catch {
      return {
        error: 'Failed to validate payment gateway limits.',
        gateways: [],
      }
    }
  }
  const [openActionMenu, setOpenActionMenu] = useState<ActionMenuState | null>(null)
  const routeClientId = useMemo(() => {
    const raw = searchParams.get('clientId')
    if (!raw) return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }, [searchParams])

  useEffect(() => {
    const nextQuery = (searchParams.get('globalSearch') || '').trim()
    setSearchQuery((prev) => (prev === nextQuery ? prev : nextQuery))
  }, [searchParams])

  function canEditInvoice(inv: InvoiceRow): boolean {
    if (hasInvoicePayment(inv)) return false
    if (isSuperAdmin) return true
    return currentEmployeeId !== null && currentEmployeeId === inv.invoice_creator_id
  }

  function canDeleteInvoice(inv: InvoiceRow): boolean {
    if (hasInvoicePayment(inv)) return false
    if (isSuperAdmin) return true
    return currentEmployeeId !== null && currentEmployeeId === inv.invoice_creator_id
  }

  function canGenerateDueInvoice(inv: InvoiceRow): boolean {
    if (accountType === 'client') return false
    if (!hasInvoicePayment(inv)) return false
    if (getRemainingInvoiceAmount(inv) <= 0) return false
    if (isSuperAdmin || isSalesAdmin) return true
    return currentEmployeeId !== null && currentEmployeeId === inv.invoice_creator_id
  }

  function getDefaultInvoiceBrand() {
    return (
      brands.find((brand) => Number(brand.id) === 1)?.brand_name ||
      brands.find((brand) => (brand.brand_name || '').trim().toLowerCase() === 'bmy brand')?.brand_name ||
      brands.find((brand) => (brand.brand_name || '').trim().toLowerCase() === 'bmybrand')?.brand_name ||
      brands[0]?.brand_name ||
      ''
    )
  }


  const fetchInvoices = useCallback(async (options?: { background?: boolean }) => {
    const isBackgroundRefresh = options?.background ?? false
    const isClient = accountType === 'client'
    const clientId = clientData?.client?.id ?? null

    if (!token) return

    if (isClient && clientData?.loading) return

    if (isClient && !clientId) {
      if (!isBackgroundRefresh) {
        setInvoicesLoading(true)
      }
      setInvoices([])
      if (!isBackgroundRefresh) {
        setInvoicesLoading(false)
      }
      return
    }

    if (isUserRole && !profileLoaded) {
      return
    }

    if (isUserRole && currentEmployeeId == null) {
      if (!isBackgroundRefresh) {
        setInvoicesLoading(true)
      }
      setInvoices([])
      if (!isBackgroundRefresh) {
        setInvoicesLoading(false)
      }
      return
    }

    if (!isBackgroundRefresh && !hasScopedInvoiceCache) {
      setInvoicesLoading(true)
    }
    const params = new URLSearchParams()
    if (routeClientId != null) params.set('clientId', String(routeClientId))
    const response = await fetch(`/api/invoices${params.size ? `?${params.toString()}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const result = (await response.json().catch(() => ({}))) as {
      invoices?: Record<string, unknown>[]
      error?: string
    }
    const data = result.invoices ?? null
    const error = response.ok ? null : { message: result.error || 'Failed to load invoices' }

    if (!isBackgroundRefresh) {
      setInvoicesLoading(false)
    }
    if (error) {
      logFetchError('Failed to fetch invoices', error)
      if (!isBackgroundRefresh) {
        setInvoices([])
        invoiceTableCache = null
      }
      return
    }



    const invoiceRows = (data ?? []) as Record<string, unknown>[]
    const invoiceIds = invoiceRows
      .map((row) => Number(row.id))
      .filter((id) => Number.isFinite(id) && id > 0)
    const parentInvoiceIdByInvoiceId = new Map<number, number>()
    invoiceRows.forEach((row) => {
      const invoiceId = Number(row.id)
      const parentInvoiceId = Number(row.parent_invoice_id)
      if (
        Number.isFinite(invoiceId) &&
        invoiceId > 0 &&
        Number.isFinite(parentInvoiceId) &&
        parentInvoiceId > 0
      ) {
        parentInvoiceIdByInvoiceId.set(invoiceId, parentInvoiceId)
      }
    })

    const paidAmountByInvoiceId = new Map<number, number>()
    if (invoiceIds.length > 0) {
      const { data: paymentData, error: paymentError } = await supabase
        .from('payment_submissions')
        .select('invoice_id, amount_paid, payment_status')
        .in('invoice_id', invoiceIds)

      if (paymentError) {
        logFetchError('Failed to fetch invoice payment totals', paymentError)
      } else {
        ;((paymentData as PaymentSubmissionRow[] | null) ?? []).forEach((payment) => {
          const invoiceId = Number(payment.invoice_id ?? 0)
          if (!Number.isFinite(invoiceId) || invoiceId <= 0 || !isSuccessfulPaymentStatus(payment.payment_status)) {
            return
          }

          const nextTotal = (paidAmountByInvoiceId.get(invoiceId) ?? 0) + parseAmountValue(String(payment.amount_paid ?? '0'))
          paidAmountByInvoiceId.set(invoiceId, Number(nextTotal.toFixed(2)))

          const parentInvoiceId = parentInvoiceIdByInvoiceId.get(invoiceId)
          if (parentInvoiceId) {
            const nextParentTotal = (paidAmountByInvoiceId.get(parentInvoiceId) ?? 0) + parseAmountValue(String(payment.amount_paid ?? '0'))
            paidAmountByInvoiceId.set(parentInvoiceId, Number(nextParentTotal.toFixed(2)))
          }
        })
      }
    }

    const rows = invoiceRows.map((row) => {
      const emp = row.employees as { employee_name?: string } | { employee_name?: string }[] | null
      const empObj = Array.isArray(emp) ? emp[0] : emp
      const clientObj = row.clients as { name?: string } | { name?: string }[] | null
      const relatedClientName = (Array.isArray(clientObj) ? clientObj[0] : clientObj)?.name ?? ''
      const storedClientName = typeof row.client_name === 'string' ? row.client_name : ''
      const clientName = storedClientName || relatedClientName
      const services = toServiceLines(row.service)
      const subtotal = servicesSubtotal(services)
      const invoiceId = Number(row.id as number)
      return {
        id: invoiceId,
        invoice_date: (row.invoice_date as string) ?? '',
        invoice_creator_id: (row.invoice_creator_id as number) ?? 0,
        invoice_creator: empObj?.employee_name ?? '--',
        client_id: (row.client_id as number) ?? null,
        parent_invoice_id: row.parent_invoice_id == null ? null : Number(row.parent_invoice_id),
        brand_id: row.brand_id == null ? null : Number(row.brand_id),
        client_name: clientName,
        brand_name: (row.brand_name as string) ?? '',
        email: (row.email as string) ?? '',
        service: services,
        phone: (row.phone as string) ?? '',
        amount: String(row.amount ?? '').trim() || subtotal.toFixed(2),
        status: (row.status as string) ?? 'Pending',
        payable_amount: row.payable_amount == null ? null : Number(row.payable_amount),
        paid_amount: Number((paidAmountByInvoiceId.get(invoiceId) ?? 0).toFixed(2)),
        invoice_type: (row.invoice_type as string) ?? INVOICE_TYPE_OPTIONS[0],
        currency: normalizeInvoiceCurrency(row.currency),
      }
    })
    setInvoices((prev) => {
      const next = areInvoiceRowsEqual(prev, rows) ? prev : rows
      invoiceTableCache = {
        ownerAuthId: currentUserAuthId,
        rows: next,
      }
      return next
    })
  }, [accountType, clientData?.client?.id, clientData?.loading, currentEmployeeId, currentUserAuthId, hasScopedInvoiceCache, isUserRole, profileLoaded, routeClientId, token])

  const fetchEmployees = useCallback(async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('id, employee_name')
      .order('employee_name')
    if (error) {
      logFetchError('Failed to fetch employees', error)
      setEmployees([])
      return
    }
    setEmployees((data as EmployeeOption[]) ?? [])
  }, [])

  const fetchClients = useCallback(async () => {
    if (!isSuperAdmin && !isFinanceDepartment && !currentUserAuthId) {
      setClients([])
      return
    }

    let query = supabase
      .from('clients')
      .select('id, name, email, phone')
      .eq('status', 'approved')
      .neq('isdeleted', true)
      .order('name')

    if (!isSuperAdmin && !isFinanceDepartment) {
      query = query.eq('handler_id', currentUserAuthId)
    }

    const { data, error } = await query
    if (error) {
      logFetchError('Failed to fetch clients', error)
      setClients([])
      return
    }
    setClients((data as ClientOption[]) ?? [])
  }, [currentUserAuthId, isFinanceDepartment, isSuperAdmin])

  const fetchBrands = useCallback(async () => {
    const { data, error } = await supabase
      .from('brands')
      .select('id, brand_name, brand_url, logo_url')
      .neq('isdeleted', true)
      .order('brand_name')
    if (error) {
      logFetchError('Failed to fetch brands', error)
      setBrands([])
      return
    }
    setBrands((data as BrandOption[]) ?? [])
  }, [])

  const scheduleInvoicesRefresh = useCallback(() => {
    if (realtimeRefreshTimeoutRef.current !== null) {
      window.clearTimeout(realtimeRefreshTimeoutRef.current)
    }
    realtimeRefreshTimeoutRef.current = window.setTimeout(() => {
      realtimeRefreshTimeoutRef.current = null
      void fetchInvoices({ background: true })
    }, 180)
  }, [fetchInvoices])

  const PAGE_SIZE = 4

  useEffect(() => {
    invoiceIdsRef.current = invoices.map((invoice) => invoice.id).filter((id) => Number.isFinite(id) && id > 0)
  }, [invoices])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchInvoices()
    }, 0)

    const shouldRefreshForInvoiceChange = (row: RealtimeInvoiceRow | null) => {
      if (!row) return false
      const rowClientId = Number(row.client_id ?? 0)
      const rowCreatorId = Number(row.invoice_creator_id ?? 0)
      const dashboardClientId = clientData?.client?.id ?? null

      if (accountType === 'client' && dashboardClientId != null) {
        return rowClientId === dashboardClientId
      }

      if (routeClientId != null) {
        return rowClientId === routeClientId
      }

      if (isUserRole && currentEmployeeId != null) {
        return rowCreatorId === currentEmployeeId
      }

      return true
    }

    const shouldRefreshForPaymentChange = (row: RealtimePaymentSubmissionRow | null) => {
      const invoiceId = Number(row?.invoice_id ?? 0)
      if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
        return true
      }

      if (accountType === 'client') {
        return invoiceIdsRef.current.includes(invoiceId)
      }

      return !isUserRole || currentEmployeeId == null || invoiceIdsRef.current.includes(invoiceId)
    }

    const channels = [
      supabase
        .channel(`invoices-table-sync-${currentUserAuthId || 'unknown'}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'invoices',
          },
          (payload) => {
            const nextRow = (payload.new ?? null) as RealtimeInvoiceRow | null
            const previousRow = (payload.old ?? null) as RealtimeInvoiceRow | null
            if (shouldRefreshForInvoiceChange(nextRow) || shouldRefreshForInvoiceChange(previousRow)) {
              scheduleInvoicesRefresh()
            }
          }
        ),
      supabase
        .channel(`invoice-payments-sync-${currentUserAuthId || 'unknown'}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'payment_submissions',
          },
          (payload) => {
            const nextRow = (payload.new ?? null) as RealtimePaymentSubmissionRow | null
            const previousRow = (payload.old ?? null) as RealtimePaymentSubmissionRow | null
            if (shouldRefreshForPaymentChange(nextRow) || shouldRefreshForPaymentChange(previousRow)) {
              scheduleInvoicesRefresh()
            }
          }
        ),
    ]

    channels.forEach((channel) => {
      channel.subscribe()
    })

    return () => {
      window.clearTimeout(timeoutId)
      if (realtimeRefreshTimeoutRef.current !== null) {
        window.clearTimeout(realtimeRefreshTimeoutRef.current)
        realtimeRefreshTimeoutRef.current = null
      }
      channels.forEach((channel) => {
        void supabase.removeChannel(channel)
      })
    }
  }, [accountType, clientData?.client?.id, currentEmployeeId, currentUserAuthId, fetchInvoices, isUserRole, routeClientId, scheduleInvoicesRefresh])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchEmployees()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [fetchEmployees])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchClients()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [fetchClients])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchBrands()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [fetchBrands])

  useEffect(() => {
    if (!showAddModal) return
    const defaultBrand = getDefaultInvoiceBrand()
    if (defaultBrand && !addBrand.trim()) {
      setAddBrand(defaultBrand)
    }
  }, [addBrand, brands, showAddModal])

  const statusOptions: { label: string; value: 'all' | 'paid' | 'partial' | 'unpaid' }[] = [
    { label: 'All Statuses', value: 'all' },
    { label: 'Paid', value: 'paid' },
    { label: 'Partially Paid', value: 'partial' },
    { label: 'Unpaid', value: 'unpaid' },
  ]
  const statusFilterLabel = statusOptions.find((o) => o.value === statusFilter)?.label ?? 'All Statuses'

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setCurrentPage(1)
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [searchQuery, statusFilter])

  const filteredInvoices = (() => {
    let list = invoices
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter((i) => {
        const displayStatus = getInvoiceDisplayStatus(i).toLowerCase()
        return (
          formatInvoiceCode(i.id).includes(q) ||
          `#${formatInvoiceCode(i.id)}`.toLowerCase().includes(q) ||
          (i.invoice_creator || '').toLowerCase().includes(q) ||
          (i.client_name || '').toLowerCase().includes(q) ||
          (i.email || '').toLowerCase().includes(q) ||
          i.service.some((s) => (s.description || '').toLowerCase().includes(q)) ||
          (i.status || '').toLowerCase().includes(q) ||
          displayStatus.includes(q)
        )
      })
    }
    if (statusFilter === 'paid') {
      list = list.filter((i) => getInvoiceDisplayStatus(i).toLowerCase() === 'paid')
    } else if (statusFilter === 'partial') {
      list = list.filter((i) => getInvoiceDisplayStatus(i).toLowerCase() === 'partially paid')
    } else if (statusFilter === 'unpaid') {
      list = list.filter((i) => getInvoiceDisplayStatus(i).toLowerCase() !== 'paid' && getInvoiceDisplayStatus(i).toLowerCase() !== 'partially paid')
    }
    return list
  })()
  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / PAGE_SIZE))
  const start = (currentPage - 1) * PAGE_SIZE
  const paginatedInvoices = filteredInvoices.slice(start, start + PAGE_SIZE)

  useEffect(() => {
    if (currentPage <= totalPages) return
    const timeoutId = window.setTimeout(() => {
      setCurrentPage(1)
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [currentPage, totalPages])

  useEffect(() => {
    if (!openActionMenu) return
    const closeMenu = () => setOpenActionMenu(null)
    window.addEventListener('resize', closeMenu)
    window.addEventListener('scroll', closeMenu, true)
    return () => {
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
    }
  }, [openActionMenu])

  function toggleActionMenu(id: number, target: HTMLElement) {
    if (openActionMenu?.id === id) {
      setOpenActionMenu(null)
      return
    }
    const rect = target.getBoundingClientRect()
    const menuWidth = 148
    const menuHeight = 220
    const left = Math.min(window.innerWidth - menuWidth - 8, Math.max(8, rect.right - menuWidth))
    const top =
      rect.bottom + 8 + menuHeight > window.innerHeight - 8
        ? Math.max(8, rect.top - menuHeight - 8)
        : rect.bottom + 8
    setOpenActionMenu({ id, top, left })
  }

  async function openInvoiceRecord(invoiceId: number) {
    const encryptedPath = await getSignedInvoiceLink(invoiceId)
    router.push(encryptedPath)
  }

  function validateServiceLines(lines: ServiceLine[]): { valid: boolean; message: string } {
    if (lines.length === 0) return { valid: false, message: 'At least one service is required.' }
    const hasIncomplete = lines.some((line) => !line.description.trim() || !line.price.trim() || (Number(line.qty) || 0) <= 0)
    if (hasIncomplete) return { valid: false, message: 'Fill all service rows: description, quantity, and price.' }
    const hasInvalidPrice = lines.some((line) => !isValidPrice(line.price))
    if (hasInvalidPrice) return { valid: false, message: 'Price must be numeric only (up to 2 decimals).' }
    return { valid: true, message: '' }
  }

  const addValidation = (() => {
    const resolvedBrand = addBrand.trim() || getDefaultInvoiceBrand()
    const addIsBmy = isBmyBrand(resolvedBrand)
    const usesRegisteredClient = addIsBmy && addBmyRecipientMode === 'registered'
    const requiresClientName = !addIsBmy || addBmyRecipientMode === 'manual'
    if (usesRegisteredClient && addClientId === null) {
      return { valid: false, message: 'Select a registered client or choose manual entry.' }
    }
    if (!resolvedBrand || (requiresClientName && !addClientName.trim()) || !addEmail.trim() || !addPhone.trim()) {
      return { valid: false, message: 'Fill all required fields: client name, email, phone.' }
    }
    if (!isValidEmail(addEmail.trim())) {
      return { valid: false, message: 'Enter a valid email address.' }
    }
    if (isAdvanceUnpaidStatus(addStatus)) {
      if (!addPayableAmount.trim()) {
        return { valid: false, message: 'Enter a payable amount.' }
      }
      const payable = parseAmountValue(addPayableAmount)
      const total = servicesSubtotal(addServices)
      if (payable <= 0) {
        return { valid: false, message: 'Payable amount must be greater than 0.' }
      }
      if (payable > total) {
        return { valid: false, message: 'Payable amount cannot be greater than the grand total.' }
      }
    }
    return validateServiceLines(addServices)
  })()

  useEffect(() => {
    if (!showAddModal || !isGatewayLimitBlockingError(addError) || !addValidation.valid) return

    let active = true

    async function revalidateGatewayLimit() {
      const subTotal = servicesSubtotal(addServices)
      const payableAmount = isAdvanceUnpaidStatus(addStatus) ? parseAmountValue(addPayableAmount) : 0
      const gatewayValidationAmount = getInvoiceGatewayValidationAmount(addStatus, subTotal, payableAmount)
      const gatewayValidation = await validateGatewayAmountForInvoice(gatewayValidationAmount)

      if (!active) return

      if (gatewayValidation.error) {
        setAddGatewayLimits(gatewayValidation.gateways)
        setAddGatewayInfoOpen(false)
        setAddError(gatewayValidation.error)
        return
      }

      setAddGatewayLimits([])
      setAddGatewayInfoOpen(false)
      setAddError(null)
    }

    void revalidateGatewayLimit()

    return () => {
      active = false
    }
  }, [showAddModal, addError, addValidation.valid, addServices, addStatus, addPayableAmount])

  const editValidation = (() => {
    const editIsBmy = isBmyBrand(editBrand)
    const usesRegisteredClient = editIsBmy && editBmyRecipientMode === 'registered'
    const requiresClientName = !editIsBmy || editBmyRecipientMode === 'manual'
    if (usesRegisteredClient && editClientId === null) {
      return { valid: false, message: 'Select a registered client or choose manual entry.' }
    }
    if (!editBrand.trim() || !editEmail.trim() || !editPhone.trim() || (requiresClientName && !editClientName.trim())) {
      return { valid: false, message: 'Fill all required fields: brand, email, phone.' }
    }
    if (!isValidEmail(editEmail.trim())) {
      return { valid: false, message: 'Enter a valid email address.' }
    }
    if (isSettledInvoiceStatus(editStatus)) {
      return validateServiceLines(editServices)
    }
    const total = servicesSubtotal(editServices)
    const alreadyPaid = Math.min(editPaidAmountTotal, total)
    const remainingBalance = Math.max(total - alreadyPaid, 0)
    if (total < editPaidAmountTotal) {
      return { valid: false, message: 'Invoice total cannot be less than the amount already paid.' }
    }
    if (isAdvanceUnpaidStatus(editStatus)) {
      if (!editPayableAmount.trim()) {
        return { valid: false, message: 'Enter a payable amount.' }
      }
      const payable = parseAmountValue(editPayableAmount)
      if (payable <= 0) {
        return { valid: false, message: 'Payable amount must be greater than 0.' }
      }
      if (payable > remainingBalance) {
        return { valid: false, message: 'Payable amount cannot be greater than the remaining balance.' }
      }
    }
    return validateServiceLines(editServices)
  })()

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (currentEmployeeId === null) return
    if (savedAddInvoiceId !== null) return
    const addResolvedBrand = addBrand.trim() || getDefaultInvoiceBrand()
    const addCheckingRegisteredClient = !isBmyBrand(addResolvedBrand) || addBmyRecipientMode === 'registered'
    if (addCheckingRegisteredClient && addClientId !== null && !clients.some((client) => client.id === addClientId)) {
      const message = isSuperAdmin
        ? 'Select a valid client before creating the invoice.'
        : 'You can only create invoices for clients assigned to you.'
      setAddError(message)
      setActionMessage({ type: 'error', text: message })
      return
    }
    if (!addValidation.valid) {
      setAddError(addValidation.message)
      setActionMessage({ type: 'error', text: addValidation.message })
      return
    }
    // Set loading immediately after passing initial validation
    setAddLoading(true)
    const cleanServices = addServices.map((line) => ({
      description: line.description.trim(),
      qty: Number(line.qty) || 1,
      price: line.price.trim(),
    }))
    const subTotal = servicesSubtotal(cleanServices)
    const payableAmount = isAdvanceUnpaidStatus(addStatus) ? parseAmountValue(addPayableAmount) : 0
    const gatewayValidationAmount = getInvoiceGatewayValidationAmount(addStatus, subTotal, payableAmount)
    const gatewayValidation = await validateGatewayAmountForInvoice(gatewayValidationAmount)
    if (gatewayValidation.error) {
      setAddError(gatewayValidation.error)
      setAddGatewayLimits(gatewayValidation.gateways)
      setAddGatewayInfoOpen(false)
      setActionMessage({ type: 'error', text: gatewayValidation.error })
      setAddLoading(false)
      return
    }
    setAddGatewayLimits([])
    setAddGatewayInfoOpen(false)
    setAddError(null)

    const resolvedBrand = addBrand.trim() || getDefaultInvoiceBrand()
    const resolvedBrandId = getInvoiceBrandMeta(resolvedBrand)?.id ?? null
    const addInvoiceClientId = isBmyBrand(resolvedBrand) && addBmyRecipientMode === 'manual' ? null : addClientId

    let { data: insertedInvoice, error: insertError } = await supabase
      .from('invoices')
      .insert({
        invoice_date: new Date().toISOString().slice(0, 10),
        invoice_creator_id: currentEmployeeId,
        client_id: addInvoiceClientId,
        brand_id: resolvedBrandId,
        brand_name: resolvedBrand,
        client_name: addClientName.trim(),
        email: addEmail.trim(),
        service: cleanServices,
        phone: addPhone.trim(),
        amount: Number(subTotal.toFixed(2)),
        status: addStatus,
        payable_amount: payableAmount > 0 ? Number(payableAmount.toFixed(2)) : null,
        invoice_type: addInvoiceType,
        currency: addCurrency,
      })
      .select('id')
      .single()

    if (insertError && (isMissingBrandIdColumnError(insertError) || isMissingColumnError(insertError, 'currency'))) {
      ;({ data: insertedInvoice, error: insertError } = await supabase
        .from('invoices')
        .insert({
          invoice_date: new Date().toISOString().slice(0, 10),
          invoice_creator_id: currentEmployeeId,
          client_id: addInvoiceClientId,
          brand_name: resolvedBrand,
          client_name: addClientName.trim(),
          email: addEmail.trim(),
          service: cleanServices,
          phone: addPhone.trim(),
          amount: Number(subTotal.toFixed(2)),
          status: addStatus,
          payable_amount: payableAmount > 0 ? Number(payableAmount.toFixed(2)) : null,
          invoice_type: addInvoiceType,
        })
        .select('id')
        .single())
    }

    setAddLoading(false)
    if (insertError) {
      setAddError(insertError.message)
      setActionMessage({ type: 'error', text: insertError.message })
      return
    }

    const nextInvoiceId = typeof insertedInvoice?.id === 'number' ? insertedInvoice.id : null
    setSavedAddInvoiceId(nextInvoiceId)
    if (nextInvoiceId === null) {
      setSavedAddInvoiceUrl('')
    } else {
      const signedLink = await getSignedInvoiceLink(nextInvoiceId)
      setSavedAddInvoiceUrl(`${window.location.origin}${signedLink}`)
    }
    setAddUrlCopied(false)
    if (nextInvoiceId === null) {
      setAddError('Invoice saved, but the share URL could not be prepared.')
      setActionMessage({ type: 'error', text: 'Invoice saved, but the share URL could not be prepared.' })
    } else {
      const emailError = await sendCreatedInvoiceEmail(nextInvoiceId)
      if (emailError) {
        setAddError(emailError)
        setActionMessage({
          type: 'error',
          text: `Invoice #${formatInvoiceCode(nextInvoiceId)} created, but the email was not sent: ${emailError}`,
        })
      } else {
        setActionMessage({
          type: 'success',
          text: `Invoice #${formatInvoiceCode(nextInvoiceId)} created successfully and emailed to ${addEmail.trim()}.`,
        })
      }
    }
    await fetchInvoices()
  }

  function resetAddModalState() {
    setAddClientId(null)
    setAddBmyRecipientMode('registered')
    setAddClientName('')
    setAddBrand(getDefaultInvoiceBrand())
    setAddEmail('')
    setAddServices([{ description: '', qty: 1, price: '' }])
    setAddPhone('')
    setAddStatus('Pending')
    setAddPayableAmount('')
    setAddInvoiceType(INVOICE_TYPE_OPTIONS[0])
    setAddCurrency('USD')
    setSavedAddInvoiceId(null)
    setSavedAddInvoiceUrl('')
    setAddUrlCopied(false)
    setAddError(null)
    setAddGatewayLimits([])
    setAddGatewayInfoOpen(false)
  }

  function closeAddModal() {
    if (addLoading) return
    setShowAddModal(false)
    resetAddModalState()
  }

  function openDueInvoiceModal(inv: InvoiceRow) {
    const remaining = getRemainingInvoiceAmount(inv)
    if (remaining <= 0) {
      setActionMessage({ type: 'error', text: 'This invoice has no remaining due amount.' })
      return
    }
    setDueInvoiceModal({
      invoice: inv,
      mode: 'full',
      amount: remaining.toFixed(2),
      loading: false,
      error: null,
      gatewayLimits: [],
      gatewayInfoOpen: false,
    })
  }

  function closeDueInvoiceModal() {
    if (dueInvoiceModal?.loading) return
    setDueInvoiceModal(null)
  }

  function setDueInvoiceAmount(value: string) {
    setDueInvoiceModal((prev) => {
      if (!prev) return prev
      const remaining = getRemainingInvoiceAmount(prev.invoice)
      const cleaned = sanitizeCurrencyInput(value)
      const parsed = parseAmountValue(cleaned)
      const capped = parsed > remaining ? remaining.toFixed(2) : cleaned
      return {
        ...prev,
        amount: capped,
        error: null,
        gatewayLimits: [],
        gatewayInfoOpen: false,
      }
    })
  }

  async function handleGenerateDueInvoice() {
    if (!dueInvoiceModal || currentEmployeeId === null) return

    const sourceInvoice = dueInvoiceModal.invoice
    const remaining = Number(getRemainingInvoiceAmount(sourceInvoice).toFixed(2))
    const requestedAmount =
      dueInvoiceModal.mode === 'full'
        ? remaining
        : Number(parseAmountValue(dueInvoiceModal.amount).toFixed(2))

    if (remaining <= 0) {
      setDueInvoiceModal((prev) => prev ? { ...prev, error: 'This invoice has no remaining due amount.' } : prev)
      return
    }
    if (requestedAmount <= 0) {
      setDueInvoiceModal((prev) => prev ? { ...prev, error: 'Enter an amount greater than 0.' } : prev)
      return
    }
    if (requestedAmount > remaining) {
      setDueInvoiceModal((prev) => prev ? { ...prev, error: 'Due invoice amount cannot be greater than the remaining amount.' } : prev)
      return
    }

    setDueInvoiceModal((prev) => prev ? { ...prev, loading: true, error: null, gatewayLimits: [], gatewayInfoOpen: false } : prev)

    const gatewayValidation = await validateGatewayAmountForInvoice(requestedAmount)
    if (gatewayValidation.error) {
      setDueInvoiceModal((prev) =>
        prev
          ? {
              ...prev,
              loading: false,
              error: gatewayValidation.error,
              gatewayLimits: gatewayValidation.gateways,
              gatewayInfoOpen: false,
            }
          : prev
      )
      setActionMessage({ type: 'error', text: gatewayValidation.error })
      return
    }

    const sourceCurrency = normalizeInvoiceCurrency(sourceInvoice.currency)
    const sourceBrand = sourceInvoice.brand_name || getDefaultInvoiceBrand()
    const sourceBrandId = sourceInvoice.brand_id ?? getInvoiceBrandMeta(sourceBrand)?.id ?? null
    const serviceLine: ServiceLine = {
      description: `Remaining balance for invoice #${formatInvoiceCode(sourceInvoice.id)}`,
      qty: 1,
      price: requestedAmount.toFixed(2),
    }

    let { data: insertedInvoice, error: insertError } = await supabase
      .from('invoices')
      .insert({
        invoice_date: new Date().toISOString().slice(0, 10),
        invoice_creator_id: currentEmployeeId,
        client_id: sourceInvoice.client_id,
        parent_invoice_id: sourceInvoice.id,
        brand_id: sourceBrandId,
        brand_name: sourceBrand,
        client_name: sourceInvoice.client_name,
        email: sourceInvoice.email,
        service: [serviceLine],
        phone: sourceInvoice.phone,
        amount: requestedAmount,
        status: 'Pending',
        payable_amount: requestedAmount,
        invoice_type: sourceInvoice.invoice_type || INVOICE_TYPE_OPTIONS[0],
        currency: sourceCurrency,
      })
      .select('id')
      .single()

    if (
      insertError &&
      (
        isMissingBrandIdColumnError(insertError) ||
        isMissingColumnError(insertError, 'currency') ||
        isMissingColumnError(insertError, 'parent_invoice_id')
      )
    ) {
      ;({ data: insertedInvoice, error: insertError } = await supabase
        .from('invoices')
        .insert({
          invoice_date: new Date().toISOString().slice(0, 10),
          invoice_creator_id: currentEmployeeId,
          client_id: sourceInvoice.client_id,
          brand_name: sourceBrand,
          client_name: sourceInvoice.client_name,
          email: sourceInvoice.email,
          service: [serviceLine],
          phone: sourceInvoice.phone,
          amount: requestedAmount,
          status: 'Pending',
          payable_amount: requestedAmount,
          invoice_type: sourceInvoice.invoice_type || INVOICE_TYPE_OPTIONS[0],
        })
        .select('id')
        .single())
    }

    if (insertError) {
      setDueInvoiceModal((prev) => prev ? { ...prev, loading: false, error: insertError.message } : prev)
      setActionMessage({ type: 'error', text: insertError.message })
      return
    }

    const nextInvoiceId = typeof insertedInvoice?.id === 'number' ? insertedInvoice.id : null
    if (nextInvoiceId === null) {
      const message = 'Due invoice was created, but the new invoice ID was unavailable.'
      setDueInvoiceModal((prev) => prev ? { ...prev, loading: false, error: message } : prev)
      setActionMessage({ type: 'error', text: message })
      await fetchInvoices()
      return
    }

    const emailError = await sendCreatedInvoiceEmail(nextInvoiceId)
    setDueInvoiceModal(null)
    if (emailError) {
      setActionMessage({
        type: 'error',
        text: `Due invoice #${formatInvoiceCode(nextInvoiceId)} created, but the email was not sent: ${emailError}`,
      })
    } else {
      setActionMessage({
        type: 'success',
        text: `Due invoice #${formatInvoiceCode(nextInvoiceId)} created for ${formatCurrencyAmount(requestedAmount, sourceCurrency)} and emailed to ${sourceInvoice.email}.`,
      })
    }
    await fetchInvoices()
  }

  async function handleCopyAddedInvoiceUrl() {
    if (!savedAddInvoiceUrl.trim()) return

    try {
      await navigator.clipboard.writeText(savedAddInvoiceUrl)
      setAddUrlCopied(true)
      setAddError(null)
    } catch {
      setAddError('Failed to copy invoice URL.')
      setAddUrlCopied(false)
    }
  }

  async function sendCreatedInvoiceEmail(invoiceId: number): Promise<string | null> {
    const accessToken = await resolveAccessToken()
    if (!accessToken) {
      return 'Invoice created, but the email could not be sent because your session token was unavailable.'
    }

    try {
      const response = await fetch('/api/invoices/send-created-email', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invoiceId }),
      })
      const result = (await response.json().catch(() => null)) as { error?: string } | null
      if (!response.ok) {
        return result?.error || 'Invoice created, but the email could not be sent.'
      }
      return null
    } catch (error) {
      return error instanceof Error ? error.message : 'Invoice created, but the email could not be sent.'
    }
  }

  function openEditModal(inv: InvoiceRow) {
    setEditingInvoice(inv)
    setEditClientId(inv.client_id ?? null)
    setEditBmyRecipientMode(isBmyBrand(inv.brand_name || getDefaultInvoiceBrand()) && inv.client_id == null ? 'manual' : 'registered')
    setEditClientName(inv.client_name || '')
    setEditBrand(inv.brand_name || getDefaultInvoiceBrand())
    setEditEmail(inv.email || '')
    setEditServices(inv.service.length > 0 ? inv.service : [{ description: '', qty: 1, price: '' }])
    setEditPhone(inv.phone || '')
    setEditStatus(inv.status || 'Pending')
    setEditPayableAmount(inv.payable_amount == null ? '' : String(inv.payable_amount))
    setEditPaidAmountTotal(inv.paid_amount || 0)
    setEditInvoiceType(inv.invoice_type || INVOICE_TYPE_OPTIONS[0])
    setEditCurrency(normalizeInvoiceCurrency(inv.currency))
    setEditInvoiceUrl('')
    void getSignedInvoiceLink(inv.id).then((signedLink) => {
      setEditInvoiceUrl(`${window.location.origin}${signedLink}`)
    }).catch(() => {
      void getSignedInvoiceLink(inv.id).then((signedLink) => {
        setEditInvoiceUrl(`${window.location.origin}${signedLink}`)
      })
    })
    setEditUrlCopied(false)
    setEditError(null)
    setEditGatewayLimits([])
    setEditGatewayInfoOpen(false)
  }

  function closeEditModal() {
    if (editLoading) return
    setEditingInvoice(null)
    setEditPaidAmountTotal(0)
    setEditInvoiceUrl('')
    setEditUrlCopied(false)
  }

  async function handleCopyEditInvoiceUrl() {
    if (!editInvoiceUrl.trim()) return

    try {
      await navigator.clipboard.writeText(editInvoiceUrl)
      setEditUrlCopied(true)
      setEditError(null)
    } catch {
      setEditError('Failed to copy invoice URL.')
      setEditUrlCopied(false)
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingInvoice || !canEditInvoice(editingInvoice)) return
    const editCheckingRegisteredClient = !isBmyBrand(editBrand) || editBmyRecipientMode === 'registered'
    if (editCheckingRegisteredClient && editClientId !== null && !clients.some((client) => client.id === editClientId)) {
      const message = isSuperAdmin
        ? 'Select a valid client before saving the invoice.'
        : 'You can only assign invoices to clients assigned to you.'
      setEditError(message)
      setActionMessage({ type: 'error', text: message })
      return
    }
    if (!editValidation.valid) {
      setEditError(editValidation.message)
      setActionMessage({ type: 'error', text: editValidation.message })
      return
    }
    const cleanServices = editServices.map((line) => ({
      description: line.description.trim(),
      qty: Number(line.qty) || 1,
      price: line.price.trim(),
    }))
    const subTotal = servicesSubtotal(cleanServices)
    const payableAmount = isAdvanceUnpaidStatus(editStatus) ? parseAmountValue(editPayableAmount) : 0
    if (!isSettledInvoiceStatus(editStatus)) {
      const alreadyPaid = Math.min(editPaidAmountTotal, subTotal)
      const remainingBalance = Math.max(subTotal - alreadyPaid, 0)
      const gatewayValidationAmount =
        alreadyPaid > 0
          ? isAdvanceUnpaidStatus(editStatus)
            ? payableAmount
            : remainingBalance
          : getInvoiceGatewayValidationAmount(editStatus, subTotal, payableAmount)

      const gatewayValidation = await validateGatewayAmountForInvoice(gatewayValidationAmount)
      if (gatewayValidation.error) {
        setEditGatewayLimits(gatewayValidation.gateways)
        setEditGatewayInfoOpen(false)
        setEditError(gatewayValidation.error)
        setActionMessage({ type: 'error', text: gatewayValidation.error })
        return
      }
    }
    setEditGatewayLimits([])
    setEditGatewayInfoOpen(false)
    setEditError(null)
    setEditLoading(true)
    const editInvoiceClientId = isBmyBrand(editBrand) && editBmyRecipientMode === 'manual' ? null : editClientId

    let { error } = await supabase
      .from('invoices')
      .update({
        client_id: editInvoiceClientId,
        client_name: editClientName.trim(),
        brand_id: getInvoiceBrandMeta(editBrand.trim())?.id ?? null,
        brand_name: editBrand.trim(),
        email: editEmail.trim(),
        service: cleanServices,
        phone: editPhone.trim(),
        amount: Number(subTotal.toFixed(2)),
        status: editStatus,
        payable_amount: payableAmount > 0 ? Number(payableAmount.toFixed(2)) : null,
        invoice_type: editInvoiceType,
        currency: editCurrency,
      })
      .eq('id', editingInvoice.id)

    if (error && (isMissingBrandIdColumnError(error) || isMissingColumnError(error, 'currency'))) {
      ;({ error } = await supabase
        .from('invoices')
        .update({
          client_id: editInvoiceClientId,
          client_name: editClientName.trim(),
          brand_name: editBrand.trim(),
          email: editEmail.trim(),
          service: cleanServices,
          phone: editPhone.trim(),
          amount: Number(subTotal.toFixed(2)),
          status: editStatus,
          payable_amount: payableAmount > 0 ? Number(payableAmount.toFixed(2)) : null,
          invoice_type: editInvoiceType,
        })
        .eq('id', editingInvoice.id))
    }

    setEditLoading(false)
    if (error) {
      setEditError(error.message)
      setActionMessage({ type: 'error', text: error.message })
      return
    }

    setActionMessage({ type: 'success', text: `Invoice #${formatInvoiceCode(editingInvoice.id)} updated successfully.` })
    setEditUrlCopied(false)
    setEditingInvoice(null)
    setEditPayableAmount('')
    await fetchInvoices()
  }

  async function handleDeleteConfirm() {
    if (!deletingInvoice || !canDeleteInvoice(deletingInvoice)) return

    if (hasInvoicePayment(deletingInvoice)) {
      setActionMessage({ type: 'error', text: 'Invoices with payments cannot be deleted.' })
      setDeletingInvoice(null)
      return
    }

    setDeleteLoading(true)

    const { data: paymentRows, error: paymentFetchError } = await supabase
      .from('payment_submissions')
      .select('payment_status, amount_paid')
      .eq('invoice_id', deletingInvoice.id)

    if (paymentFetchError) {
      console.error('Failed to verify invoice payment status before deleting', paymentFetchError)
      setDeleteLoading(false)
      setActionMessage({
        type: 'error',
        text: 'Unable to verify payment status. Try again to avoid deleting a paid invoice.',
      })
      return
    }

    const hasSuccessfulPayment = ((paymentRows as PaymentSubmissionRow[] | null) ?? []).some(
      (row) => isSuccessfulPaymentStatus(row.payment_status) && parseAmountValue(String(row.amount_paid ?? '0')) > 0
    )

    if (hasSuccessfulPayment) {
      setDeleteLoading(false)
      setActionMessage({ type: 'error', text: 'Paid invoices cannot be deleted.' })
      setDeletingInvoice(null)
      return
    }

    const { error } = await supabase.from('invoices').delete().eq('id', deletingInvoice.id)
    setDeleteLoading(false)
    if (error) {
      console.error('Failed to delete invoice', error)
      setActionMessage({ type: 'error', text: error.message || 'Failed to delete invoice' })
      return
    }
    setActionMessage({ type: 'success', text: `Invoice #${formatInvoiceCode(deletingInvoice.id)} deleted successfully.` })
    setDeletingInvoice(null)
    await fetchInvoices()
  }

  function getInvoiceBrandMeta(brandName: string): BrandOption | null {
    return brands.find((b) => b.brand_name === brandName) ?? null
  }

  function updateAddServiceLine(index: number, key: keyof ServiceLine, value: string | number) {
    setAddServices((prev) =>
      prev.map((line, i) =>
        i === index
          ? {
              ...line,
              [key]:
                key === 'qty'
                  ? Number(value) || 1
                  : key === 'price'
                    ? sanitizePriceInput(String(value))
                    : String(value),
            }
          : line
      )
    )
  }

  function updateEditServiceLine(index: number, key: keyof ServiceLine, value: string | number) {
    setEditServices((prev) =>
      prev.map((line, i) =>
        i === index
          ? {
              ...line,
              [key]:
                key === 'qty'
                  ? Number(value) || 1
                  : key === 'price'
                    ? sanitizePriceInput(String(value))
                    : String(value),
            }
          : line
      )
    )
  }

  return (
    <div className={`${plusJakarta.className} w-full flex flex-col text-white`}>
      {/* Header */}
      <div className="w-full pb-6">
        <div className="w-full p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl sm:text-3xl font-black leading-tight text-white">Manage Invoices</h1>
            <p className="text-slate-400 text-sm font-normal leading-5">
              Create, edit and track your invoices.
            </p>
          </div>
          {accountType !== 'client' && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="h-12 min-w-36 px-6 bg-orange-500 rounded-xl shadow-[0px_4px_20px_0px_rgba(249,115,22,0.2)] flex justify-center items-center gap-2 hover:bg-orange-600 transition shrink-0"
            >
              <PlusIcon className="h-4 w-3 text-white" />
              <span className="text-white text-sm font-bold">Add New Invoice</span>
            </button>
          )}
        </div>
      </div>

      {actionMessage && (
        <div className="w-full pb-6">
          <p
            className={`rounded-lg border px-4 py-3 text-sm ${
              actionMessage.type === 'error'
                ? 'border-red-500/50 bg-red-500/10 text-red-400'
                : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
            }`}
          >
            {actionMessage.text}
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="w-full pb-6">
        <div className="w-full p-4 sm:p-6 bg-slate-800/80 rounded-xl border border-slate-700 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 min-w-0">
            <div className="h-12 w-full bg-slate-900/50 rounded-xl border border-slate-700 flex items-center gap-3 pl-4 overflow-hidden">
              <SearchIcon className="h-4 w-4 text-slate-500 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by invoice number, creator, client, email, service or status..."
                className="flex-1 min-w-0 h-full bg-transparent text-slate-300 text-sm placeholder:text-slate-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="w-full sm:w-52 h-12 rounded-xl border border-slate-700 flex items-center relative">
            <button
              type="button"
              onClick={() => setStatusDropdownOpen((open) => !open)}
              className="w-full h-full px-4 bg-[#141e32] text-slate-300 text-sm font-medium focus:outline-none cursor-pointer flex justify-between items-center rounded-xl hover:bg-[#1a2842] transition text-left"
              aria-haspopup="listbox"
              aria-expanded={statusDropdownOpen}
              aria-label="Filter by status"
            >
              <span>{statusFilterLabel}</span>
              <ChevronDownIcon className={`h-4 w-3 text-slate-400 shrink-0 transition-transform ${statusDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {statusDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" aria-hidden onClick={() => setStatusDropdownOpen(false)} />
                <ul
                  className="absolute left-0 right-0 top-full mt-1 z-20 py-1 rounded-xl border border-slate-700 bg-[#141e32] shadow-xl overflow-hidden"
                  role="listbox"
                >
                  {statusOptions.map((opt) => (
                    <li key={opt.value}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={statusFilter === opt.value}
                        onClick={() => {
                          setStatusFilter(opt.value)
                          setStatusDropdownOpen(false)
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm font-medium transition ${statusFilter === opt.value ? 'bg-orange-500/20 text-orange-400' : 'text-slate-300 hover:bg-slate-800/80'}`}
                      >
                        {opt.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="w-full bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden">
        <div className="w-full overflow-x-auto scrollbar-thin">
          <div className="w-full" style={{ minWidth: '1180px' }}>
            {/* Table header */}
            <div className="w-full grid bg-slate-900/50 border-b border-slate-700" style={{ gridTemplateColumns: INVOICE_GRID }}>
              <div className="flex min-w-0 items-center px-4 sm:px-6 py-4">
                <span className="block truncate whitespace-nowrap text-slate-400 text-xs font-bold uppercase tracking-wide">No.</span>
              </div>
              <div className="flex min-w-0 items-center px-4 sm:px-6 py-4">
                <span className="block truncate whitespace-nowrap text-slate-400 text-xs font-bold uppercase tracking-wide">Invoice Date</span>
              </div>
              <div className="flex min-w-0 items-center px-4 sm:px-6 py-4">
                <span className="block truncate whitespace-nowrap text-slate-400 text-xs font-bold uppercase tracking-wide">Invoice Creator</span>
              </div>
              <div className="flex min-w-0 items-center px-4 sm:px-6 py-4">
                <span className="block truncate whitespace-nowrap text-slate-400 text-xs font-bold uppercase tracking-wide">Client Name</span>
              </div>
              <div className="flex min-w-0 items-center px-4 sm:px-6 py-4">
                <span className="block truncate whitespace-nowrap text-slate-400 text-xs font-bold uppercase tracking-wide">Brand</span>
              </div>
              <div className="flex min-w-0 items-center px-4 sm:px-6 py-4">
                <span className="block truncate whitespace-nowrap text-slate-400 text-xs font-bold uppercase tracking-wide">Email</span>
              </div>
              <div className="flex min-w-0 items-center px-4 sm:px-6 py-4">
                <span className="block truncate whitespace-nowrap text-slate-400 text-xs font-bold uppercase tracking-wide">Service</span>
              </div>
              <div className="flex min-w-0 items-center px-4 sm:px-6 py-4">
                <span className="block truncate whitespace-nowrap text-slate-400 text-xs font-bold uppercase tracking-wide">Phone</span>
              </div>
              <div className="flex min-w-0 items-center px-4 sm:px-6 py-4">
                <span className="block truncate whitespace-nowrap text-slate-400 text-xs font-bold uppercase tracking-wide">Amount</span>
              </div>
              <div className="flex min-w-0 items-center px-4 sm:px-6 py-4">
                <span className="block truncate whitespace-nowrap text-slate-400 text-xs font-bold uppercase tracking-wide">Status</span>
              </div>
              <div className="flex items-center justify-end px-4 sm:px-6 py-4 text-right">
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wide">Action</span>
              </div>
            </div>
            {/* Table rows */}
            {invoicesLoading ? (
              <div className="w-full px-4 sm:px-6 py-12 text-center text-slate-400 text-sm">
                Loading...
              </div>
            ) : paginatedInvoices.length === 0 ? (
              <div className="w-full px-4 sm:px-6 py-12 text-center text-slate-400 text-sm">
                No invoices yet. Add an invoice to get started.
              </div>
            ) : (
              paginatedInvoices.map((inv, rowIndex) => (
                <div
                  key={inv.id}
                  className="w-full grid border-t border-slate-700 items-center"
                  style={{ gridTemplateColumns: INVOICE_GRID }}
                >
                  <div className="px-4 sm:px-6 py-4 min-w-0">
                    <button
                      type="button"
                      onClick={() => openInvoiceRecord(inv.id)}
                      className="block w-full truncate whitespace-nowrap text-left font-mono text-sm font-bold text-white transition hover:text-blue-300 focus:outline-none focus:text-blue-300"
                      title={`Row ${start + rowIndex + 1}`}
                    >
                      {start + rowIndex + 1}
                    </button>
                  </div>
                  <div className="px-4 sm:px-6 py-4 min-w-0">
                    <button
                      type="button"
                      onClick={() => openInvoiceRecord(inv.id)}
                      className="block w-full truncate whitespace-nowrap text-left text-sm text-white transition hover:text-blue-300 focus:outline-none focus:text-blue-300"
                      title={inv.invoice_date || '--'}
                    >
                      {inv.invoice_date || '--'}
                    </button>
                  </div>
                  <div className="px-4 sm:px-6 py-4 min-w-0">
                    <button
                      type="button"
                      onClick={() => openInvoiceRecord(inv.id)}
                      className="block w-full truncate whitespace-nowrap text-left text-sm text-white transition hover:text-blue-300 focus:outline-none focus:text-blue-300"
                      title={inv.invoice_creator || '--'}
                    >
                      {inv.invoice_creator || '--'}
                    </button>
                  </div>
                  <div className="px-4 sm:px-6 py-4 min-w-0">
                    <button
                      type="button"
                      onClick={() => openInvoiceRecord(inv.id)}
                      className="block w-full truncate whitespace-nowrap text-left text-sm text-white transition hover:text-blue-300 focus:outline-none focus:text-blue-300"
                      title={inv.client_name || '--'}
                    >
                      {inv.client_name || '--'}
                    </button>
                  </div>
                  <div className="px-4 sm:px-6 py-4 min-w-0">
                    <span className="text-white text-sm block truncate whitespace-nowrap" title={inv.brand_name || '--'}>{inv.brand_name || '--'}</span>
                  </div>
                  <div className="px-4 sm:px-6 py-4 min-w-0">
                    <span className="text-slate-300 text-sm truncate block whitespace-nowrap" title={inv.email || '--'}>{inv.email || '--'}</span>
                  </div>
                  <div className="px-4 sm:px-6 py-4 min-w-0">
                    <span
                      className="text-slate-300 text-sm truncate block whitespace-nowrap"
                      title={inv.service.map((s) => `${s.description} (x${s.qty})`).join(', ')}
                    >
                      {serviceSummary(inv.service)}
                    </span>
                  </div>
                  <div className="px-4 sm:px-6 py-4 min-w-0">
                    <span className="text-slate-300 text-sm block truncate whitespace-nowrap" title={inv.phone || '--'}>{inv.phone || '--'}</span>
                  </div>
                  <div className="px-4 sm:px-6 py-4 min-w-0">
                    {(() => {
                      const currency = normalizeInvoiceCurrency(inv.currency)
                      const totalAmount = parseAmountValue(inv.amount)
                      const payableAmount = inv.payable_amount != null && inv.payable_amount > 0
                        ? Number(inv.payable_amount)
                        : totalAmount
                      const totalLabel = formatCurrencyAmount(totalAmount, currency)
                      const payableLabel = formatCurrencyAmount(payableAmount, currency)

                      return (
                        <div className="min-w-0" title={`Total: ${totalLabel} | Payable: ${payableLabel}`}>
                          <span className="block truncate whitespace-nowrap text-sm font-semibold text-white">
                            {totalLabel}
                          </span>
                          <span className="mt-0.5 block truncate whitespace-nowrap text-[11px] font-medium text-orange-300">
                            Payable {payableLabel}
                          </span>
                        </div>
                      )
                    })()}
                  </div>
                  <div className="px-4 sm:px-6 py-4 min-w-0">
                    {(() => {
                      const displayStatus = getInvoiceDisplayStatus(inv)

                      return (
                        <span
                          className={`inline-block max-w-full truncate whitespace-nowrap px-2 py-1 rounded-lg border text-xs font-medium ${getStatusStyle(displayStatus)}`}
                          title={displayStatus}
                        >
                          {displayStatus}
                        </span>
                      )
                    })()}
                  </div>
                  <div className="px-4 sm:px-6 py-4 flex justify-end">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleActionMenu(inv.id, e.currentTarget)
                      }}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-700/50 hover:text-slate-300"
                      aria-label="Actions"
                      aria-haspopup="menu"
                      aria-expanded={openActionMenu?.id === inv.id}
                    >
                      <EllipsisVerticalIcon />
                    </button>
                    {openActionMenu?.id === inv.id && (
                      <>
                        <div className="fixed inset-0 z-40" aria-hidden onClick={() => setOpenActionMenu(null)} />
                        <div
                          className="fixed z-50 min-w-[148px] overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-xl"
                          style={{ top: openActionMenu.top, left: openActionMenu.left }}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpenActionMenu(null)
                              openInvoiceRecord(inv.id)
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-blue-400 transition hover:bg-slate-800"
                          >
                            <InfoIcon className="h-4 w-4" />
                            View
                          </button>
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation()
                              setOpenActionMenu(null)
                              const invoicePath = await getSignedInvoiceLink(inv.id)
                              const invoiceUrl = `${window.location.origin}${invoicePath}`

                              try {
                                await navigator.clipboard.writeText(invoiceUrl)
                              } catch {
                                console.error('Failed to copy invoice URL')
                              }
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-300 transition hover:bg-slate-800"
                          >
                            <CopyIcon className="h-4 w-4" />
                            Copy
                          </button>
                          {canEditInvoice(inv) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setOpenActionMenu(null)
                                openEditModal(inv)
                              }}
                              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-300 transition hover:bg-slate-800"
                            >
                              <PencilIcon className="h-4 w-4" />
                              Edit
                            </button>
                          )}
                          {canGenerateDueInvoice(inv) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setOpenActionMenu(null)
                                openDueInvoiceModal(inv)
                              }}
                              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-amber-300 transition hover:bg-slate-800"
                            >
                              <PlusIcon className="h-4 w-4" />
                              Due Invoice
                            </button>
                          )}
                          {canDeleteInvoice(inv) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setOpenActionMenu(null)
                                setDeletingInvoice(inv)
                              }}
                              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-400 transition hover:bg-slate-800"
                            >
                              <TrashIcon className="h-4 w-4" />
                              Delete
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pagination */}
        <div className="w-full px-4 sm:px-6 py-4 bg-slate-900/50 border-t border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-slate-400 text-sm">
            Showing {filteredInvoices.length === 0 ? 0 : start + 1} to {Math.min(start + PAGE_SIZE, filteredInvoices.length)} of {filteredInvoices.length} invoices
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="w-8 h-8 rounded-lg border border-slate-700 flex justify-center items-center text-slate-400 hover:bg-slate-700/50 transition disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeftIcon />
            </button>
            {(() => {
              const pages: (number | 'ellipsis')[] =
                totalPages <= 4
                  ? Array.from({ length: totalPages }, (_, i) => i + 1)
                  : [1, 2, 'ellipsis', totalPages]
              return pages.map((page) =>
                page === 'ellipsis' ? (
                  <span key="ellipsis" className="w-8 text-center text-slate-500 text-xs">
                    ...
                  </span>
                ) : (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-lg flex justify-center items-center text-xs font-medium transition ${
                      currentPage === page
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
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="w-8 h-8 rounded-lg border border-slate-700 flex justify-center items-center text-slate-400 hover:bg-slate-700/50 transition disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ChevronRightIcon />
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirm modal */}
      {deletingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4">
          <div className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => !deleteLoading && setDeletingInvoice(null)}
              disabled={deleteLoading}
              aria-label="Close modal"
              className="absolute right-4 top-4 rounded-full border border-orange-500/30 bg-orange-500/10 p-2 text-orange-400 transition hover:bg-orange-500/20 hover:text-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CloseIcon />
            </button>
            <h2 className="text-lg font-bold text-white">Delete Invoice</h2>
            <p className="mt-1 text-sm text-slate-400">
              Delete invoice <span className="font-semibold text-white">#{formatInvoiceCode(deletingInvoice.id)}</span>? This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                className="w-full rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50 sm:w-auto sm:min-w-[140px]"
              >
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate due invoice modal */}
      {dueInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4">
          <div className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={closeDueInvoiceModal}
              disabled={dueInvoiceModal.loading}
              aria-label="Close modal"
              className="absolute right-4 top-4 rounded-full border border-orange-500/30 bg-orange-500/10 p-2 text-orange-400 transition hover:bg-orange-500/20 hover:text-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CloseIcon />
            </button>
            {(() => {
              const remaining = Number(getRemainingInvoiceAmount(dueInvoiceModal.invoice).toFixed(2))
              const currency = normalizeInvoiceCurrency(dueInvoiceModal.invoice.currency)
              const customAmount = parseAmountValue(dueInvoiceModal.amount)
              const selectedAmount = dueInvoiceModal.mode === 'full' ? remaining : Math.min(customAmount, remaining)
              const disableGenerate = dueInvoiceModal.loading || selectedAmount <= 0 || selectedAmount > remaining

              return (
                <>
                  <h2 className="text-lg font-bold text-white">Generate Due Invoice</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Create a new invoice from the remaining balance of invoice{' '}
                    <span className="font-semibold text-white">#{formatInvoiceCode(dueInvoiceModal.invoice.id)}</span>.
                  </p>
                  <div className="mt-5 rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-400">Remaining</span>
                      <span className="font-semibold text-white">{formatCurrencyAmount(remaining, currency)}</span>
                    </div>
                    <div className="mt-2 flex justify-between gap-4">
                      <span className="text-slate-400">Client</span>
                      <span className="max-w-[220px] truncate text-right font-medium text-slate-200">{dueInvoiceModal.invoice.client_name || '--'}</span>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-700 bg-slate-900/40 px-4 py-3 text-sm transition hover:border-orange-400/50">
                      <span className="font-medium text-slate-100">Use full remaining amount</span>
                      <input
                        type="radio"
                        name="due-invoice-mode"
                        checked={dueInvoiceModal.mode === 'full'}
                        onChange={() =>
                          setDueInvoiceModal((prev) =>
                            prev ? { ...prev, mode: 'full', amount: remaining.toFixed(2), error: null } : prev
                          )
                        }
                        className="h-4 w-4 accent-orange-500"
                      />
                    </label>
                    <label className="block rounded-xl border border-slate-700 bg-slate-900/40 px-4 py-3 text-sm">
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-medium text-slate-100">Enter custom amount</span>
                        <input
                          type="radio"
                          name="due-invoice-mode"
                          checked={dueInvoiceModal.mode === 'custom'}
                          onChange={() => setDueInvoiceModal((prev) => prev ? { ...prev, mode: 'custom', error: null } : prev)}
                          className="h-4 w-4 accent-orange-500"
                        />
                      </div>
                      {dueInvoiceModal.mode === 'custom' && (
                        <div className="mt-3 flex items-center rounded-xl border border-slate-600 bg-slate-950 px-4 py-2 focus-within:border-orange-400">
                          <span className="shrink-0 text-xl font-black text-slate-500">{getCurrencyPrefix()}</span>
                          <input
                            type="text"
                            value={dueInvoiceModal.amount}
                            onChange={(e) => setDueInvoiceAmount(e.target.value)}
                            placeholder="0.00"
                            inputMode="decimal"
                            pattern="^\d+(\.\d{1,2})?$"
                            className="ml-3 min-w-0 flex-1 bg-transparent text-xl font-bold text-white placeholder:text-slate-500 focus:outline-none"
                          />
                          <span className="shrink-0 text-xl font-black text-slate-500">{currency}</span>
                        </div>
                      )}
                    </label>
                  </div>

                  {dueInvoiceModal.error && (
                    <GatewayLimitAlert
                      message={dueInvoiceModal.error}
                      gateways={dueInvoiceModal.gatewayLimits}
                      infoOpen={dueInvoiceModal.gatewayInfoOpen}
                      onToggleInfo={() =>
                        setDueInvoiceModal((prev) =>
                          prev ? { ...prev, gatewayInfoOpen: !prev.gatewayInfoOpen } : prev
                        )
                      }
                    />
                  )}

                  <div className="mt-6 flex justify-end">
                    <button
                      type="button"
                      onClick={handleGenerateDueInvoice}
                      disabled={disableGenerate}
                      className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[170px]"
                    >
                      {dueInvoiceModal.loading ? 'Generating...' : 'Generate Invoice'}
                    </button>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* Add invoice modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4">
          <div className="relative max-h-[calc(100dvh-2rem)] w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={closeAddModal}
              disabled={addLoading}
              aria-label="Close modal"
              className="absolute right-4 top-4 z-20 rounded-full border border-orange-300 bg-white/95 p-2 text-orange-500 transition hover:bg-orange-50 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CloseIcon />
            </button>
            <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl bg-neutral-100 p-6 text-slate-800 shadow-2xl scrollbar-thin">
              {(() => {
                return (
                  <form
                    onSubmit={handleAddSubmit}
                    onInvalidCapture={handleRequiredFieldInvalid}
                    onInputCapture={clearRequiredFieldInvalid}
                    onChangeCapture={clearRequiredFieldInvalid}
                    className="rounded-xl bg-white shadow-2xl outline outline-1 outline-slate-200"
                  >
                  {(() => {
                    const addBrandMeta = getInvoiceBrandMeta(addBrand)
                    return (
                  <div className="relative z-10 flex items-center justify-between rounded-t-xl bg-slate-900 px-10 py-8">
                    <div className="flex items-center gap-4">
                      <div className="h-16 w-44 flex items-center justify-start">
                        {addBrandMeta?.logo_url ? (
                          <img src={addBrandMeta.logo_url} alt={addBrand} className="max-h-16 w-auto object-contain" />
                        ) : (
                          <div className="h-6 w-6 border border-white/60 rounded-sm" />
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-5xl font-black uppercase tracking-wide text-orange-600">Invoice</p>
                      <p className="mt-2 text-xs font-bold uppercase tracking-wider text-slate-300">Draft Mode</p>
                    </div>
                  </div>
                    )
                  })()}

                  {(() => {
                    const subTotal = servicesSubtotal(addServices)
                    const grandTotal = subTotal
                    const payableAmount = Math.min(parseAmountValue(addPayableAmount), grandTotal)
                    const remainingAmount = Math.max(grandTotal - payableAmount, 0)
                    const addIsBmyInvoice = isBmyBrand(addBrand)
                    const showAddClientDropdown = addIsBmyInvoice && addBmyRecipientMode === 'registered'
                    const showAddClientNameField = !addIsBmyInvoice || addBmyRecipientMode === 'manual'
                    return (
                      <>
                        <div className="grid grid-cols-1 gap-10 px-10 py-8 md:grid-cols-2">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Invoice To</p>
                            <div className="mt-3 space-y-3">
                              <div>
                                <label htmlFor="add-brand" className="block text-xs font-bold uppercase tracking-wide text-slate-500">Brand</label>
                                <select
                                  id="add-brand"
                                  value={addBrand}
                                  onChange={(e) => {
                                    const nextBrand = e.target.value
                                    const switchingFromBmyToManual = isBmyBrand(addBrand) && !isBmyBrand(nextBrand)
                                    const switchingToBmy = !isBmyBrand(addBrand) && isBmyBrand(nextBrand)
                                    setAddBrand(nextBrand)
                                    if (switchingFromBmyToManual || !isBmyBrand(nextBrand)) {
                                      setAddBmyRecipientMode('manual')
                                      setAddClientId(null)
                                      setAddClientName('')
                                      setAddEmail('')
                                      setAddPhone('')
                                    } else if (switchingToBmy) {
                                      setAddBmyRecipientMode('registered')
                                      setAddClientId(null)
                                      setAddClientName('')
                                      setAddEmail('')
                                      setAddPhone('')
                                    }
                                  }}
                                  required
                                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                >
                                  {!brands.some((brand) => brand.brand_name === addBrand) && addBrand && (
                                    <option value={addBrand}>{addBrand}</option>
                                  )}
                                  <option value="" disabled>Select brand</option>
                                  {brands.map((brand) => (
                                    <option key={brand.id} value={brand.brand_name}>{brand.brand_name}</option>
                                  ))}
                                </select>
                              </div>
                              {addIsBmyInvoice ? (
                                <div>
                                  <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">Recipient</span>
                                  <div className="mt-1 grid grid-cols-2 overflow-hidden rounded-lg border border-slate-300 bg-slate-100 p-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAddBmyRecipientMode('registered')
                                        setAddClientId(null)
                                        setAddClientName('')
                                        setAddEmail('')
                                        setAddPhone('')
                                      }}
                                      className={`rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wide transition ${
                                        addBmyRecipientMode === 'registered'
                                          ? 'bg-white text-slate-900 shadow-sm'
                                          : 'text-slate-500 hover:text-slate-900'
                                      }`}
                                    >
                                      Registered
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAddBmyRecipientMode('manual')
                                        setAddClientId(null)
                                      }}
                                      className={`rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wide transition ${
                                        addBmyRecipientMode === 'manual'
                                          ? 'bg-white text-slate-900 shadow-sm'
                                          : 'text-slate-500 hover:text-slate-900'
                                      }`}
                                    >
                                      Manual
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                              {showAddClientDropdown ? (
                              <div>
                                <label htmlFor="add-client" className="block text-xs font-bold uppercase tracking-wide text-slate-500">Client</label>
                                <select
                                  id="add-client"
                                  value={addClientId ?? ''}
                                  onChange={(e) => {
                                    const id = e.target.value ? Number(e.target.value) : null
                                    setAddClientId(id)
                                    if (id) {
                                      const c = clients.find((x) => x.id === id)
                                      if (c) {
                                        setAddClientName(c.name || '')
                                        setAddEmail(c.email || '')
                                        setAddPhone(c.phone || '')
                                      }
                                    } else {
                                      setAddClientName('')
                                      setAddEmail('')
                                      setAddPhone('')
                                    }
                                  }}
                                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                >
                                  <option value="">Select registered client</option>
                                  {clients.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name || c.email || `Client #${c.id}`}</option>
                                  ))}
                                </select>
                              </div>
                              ) : null}
                              {showAddClientNameField ? (
                              <div>
                                <label htmlFor="add-client-name" className="block text-xs font-bold uppercase tracking-wide text-slate-500">Client name</label>
                                <input
                                  id="add-client-name"
                                  type="text"
                                  value={addClientName}
                                  onChange={(e) => setAddClientName(e.target.value)}
                                  placeholder="Enter client name"
                                  required={showAddClientNameField}
                                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                />
                              </div>
                              ) : null}
                              <div>
                                <label htmlFor="add-email" className="flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                                  <span>Email</span>
                                  <span className="group relative inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-[10px] font-black leading-none text-slate-500">
                                    ?
                                    <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-56 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-left text-[11px] font-medium normal-case leading-snug tracking-normal text-white opacity-0 shadow-xl transition group-hover:opacity-100">
                                      An email will be sent to this address when the invoice is created.
                                    </span>
                                  </span>
                                </label>
                                <input id="add-email" type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="ketut.susilo@example.com" required className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                              </div>
                              <div>
                                <label htmlFor="add-phone" className="block text-xs font-bold uppercase tracking-wide text-slate-500">Phone</label>
                                <input id="add-phone" type="tel" value={addPhone} onChange={(e) => setAddPhone(e.target.value)} placeholder="+1 (555) 000-1234" required className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                              </div>
                            </div>
                          </div>

                          <div className="md:justify-self-end">
                            <div className="w-full max-w-xs space-y-3">
                              <div className="flex justify-between border-b border-slate-100 pb-2 text-sm">
                                <span className="text-slate-500">Invoice Number</span>
                                <span className="font-bold text-slate-900">#AUTO</span>
                              </div>
                              <div className="flex justify-between border-b border-slate-100 pb-2 text-sm">
                                <span className="text-slate-500">Issue Date</span>
                                <span className="font-bold text-slate-900">{new Date().toISOString().slice(0, 10)}</span>
                              </div>
                              <div className="flex justify-between border-b border-slate-100 pb-2 text-sm">
                                <span className="text-slate-500">Due Date</span>
                                <span className="font-bold text-slate-900">{addDaysToISODate(new Date().toISOString().slice(0, 10), 30)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mx-10 overflow-hidden rounded-xl border border-slate-200">
                          <div className="grid grid-cols-[72px_minmax(0,1fr)_220px_auto] gap-4 bg-slate-50 px-4 py-4 text-xs font-bold uppercase tracking-wide text-slate-700">
                            <span>No</span><span>Description</span><span>Price</span><span />
                          </div>
                          {addServices.map((line, idx) => (
                            <div key={`add-service-${idx}`} className="grid grid-cols-[72px_minmax(0,1fr)_220px_auto] items-center gap-4 border-t border-slate-100 px-4 py-4 text-sm">
                              <span>{String(idx + 1).padStart(2, '0')}</span>
                              <input
                                type="text"
                                value={line.description}
                                onChange={(e) => updateAddServiceLine(idx, 'description', e.target.value)}
                                placeholder="Service description"
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                              />
                              <input
                                type="text"
                                value={line.price}
                                onChange={(e) => updateAddServiceLine(idx, 'price', e.target.value)}
                                placeholder="0.00"
                                inputMode="decimal"
                                pattern="^\d+(\.\d{1,2})?$"
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                              />
                              <div className="flex items-center justify-end gap-2">
                                {addServices.length > 1 && (
                                  <button type="button" onClick={() => setAddServices((prev) => prev.filter((_, i) => i !== idx))} className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50">Remove</button>
                                )}
                              </div>
                            </div>
                          ))}
                          <div className="border-t border-slate-100 px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setAddServices((prev) => [...prev, { description: '', qty: 1, price: '' }])}
                              className="rounded-lg border border-orange-300 px-3 py-2 text-xs font-bold uppercase tracking-wide text-orange-700 hover:bg-orange-50"
                            >
                              Add Service Row
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-8 px-10 py-8 md:grid-cols-2">
                          <div className="space-y-5">
                            <div>
                              <p className="text-sm font-bold text-slate-900">Payment Details</p>
                              <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                                <p><span className="font-semibold text-slate-800">Card payments:</span> Stripe</p>
                                <div className="mt-3">
                                  <label htmlFor="add-invoice-type" className="block text-xs font-bold uppercase tracking-wide text-slate-500">Invoice Type</label>
                                  <select
                                    id="add-invoice-type"
                                    value={addInvoiceType}
                                    onChange={(e) => setAddInvoiceType(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                  >
                                    {INVOICE_TYPE_OPTIONS.map((option) => (
                                      <option key={option} value={option}>{option}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">Terms & Conditions</p>
                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                Please review our{' '}
                                <a href="https://bmybrand.com/terms-of-use" target="_blank" rel="noopener noreferrer" className="font-semibold text-orange-600 hover:text-orange-700">
                                  Terms & Conditions
                                </a>{' '}
                                and{' '}
                                <a href="https://bmybrand.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="font-semibold text-orange-600 hover:text-orange-700">
                                  Privacy Policy
                                </a>
                                .
                              </p>
                            </div>
                          </div>

                          <div className="md:justify-self-end md:w-80">
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-slate-600">Total</span>
                                <span className="flex items-center gap-2 font-medium text-slate-700">
                                  {formatCurrencyAmount(grandTotal, addCurrency, false)}
                                  {!isAdvanceUnpaidStatus(addStatus) && (
                                    <CurrencyPrefixSelect id="add-currency-total" value={addCurrency} onChange={setAddCurrency} />
                                  )}
                                </span>
                              </div>
                              {isAdvanceUnpaidStatus(addStatus) && (
                                <>
                                  <div className="rounded-xl bg-orange-600 p-4 text-white">
                                    <label htmlFor="add-payable-amount" className="block text-xs font-bold uppercase tracking-wide text-orange-100">Payable Amount</label>
                                    <div className="mt-2 flex items-center rounded-xl border border-white/70 bg-white px-5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_10px_24px_rgba(124,45,18,0.18)] focus-within:border-white focus-within:ring-4 focus-within:ring-white/25">
                                      <span className="shrink-0 text-2xl font-black text-slate-500">$</span>
                                      <input
                                        id="add-payable-amount"
                                        type="text"
                                        value={addPayableAmount}
                                        onChange={(e) => setAddPayableAmount(sanitizeCurrencyInput(e.target.value))}
                                        placeholder="0.00"
                                        inputMode="decimal"
                                        pattern="^\d+(\.\d{1,2})?$"
                                        className="ml-3 min-w-0 flex-1 bg-transparent text-2xl font-black text-slate-900 placeholder:text-slate-400 focus:outline-none"
                                      />
                                      <CurrencyPrefixSelect id="add-currency" value={addCurrency} onChange={setAddCurrency} />
                                    </div>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-600">Remaining</span>
                                    <span className="font-medium text-slate-700">{formatCurrencyAmount(remainingAmount, addCurrency)}</span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {isBmyBrand(addBrand) ? (
                          <div className="border-t border-slate-200 bg-slate-50 px-10 py-6 text-sm text-slate-500">
                            +14695011401 | www.bmybrand.com | billing@bmybrand.com
                          </div>
                        ) : null}
                      </>
                    )
                  })()}

                  {currentEmployeeId === null && !addError && savedAddInvoiceId === null && (
                    <p className="mx-10 mt-4 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">You must be registered as an employee to create invoices.</p>
                  )}
                  {savedAddInvoiceId !== null && savedAddInvoiceUrl && (
                    <div className={`mx-10 mt-4 flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${addUrlCopied ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-slate-200 bg-slate-50'}`}>
                      <a
                        href={savedAddInvoiceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`min-w-0 flex-1 truncate ${addUrlCopied ? 'text-emerald-700' : 'text-slate-700 hover:text-orange-600'}`}
                      >
                        {savedAddInvoiceUrl}
                      </a>
                      <button
                        type="button"
                        onClick={handleCopyAddedInvoiceUrl}
                        aria-label="Copy invoice URL"
                        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition ${addUrlCopied ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700' : 'border-slate-300 bg-white text-slate-600 hover:border-orange-300 hover:text-orange-600'}`}
                      >
                        <CopyIcon className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  {addError ? (
                    <GatewayLimitAlert
                      message={addError}
                      gateways={addGatewayLimits}
                      infoOpen={addGatewayInfoOpen}
                      onToggleInfo={() => setAddGatewayInfoOpen((open) => !open)}
                    />
                  ) : null}

                  <div className="flex justify-end px-10 py-6">
                    {savedAddInvoiceId !== null ? (
                      <button
                        type="button"
                        onClick={handleCopyAddedInvoiceUrl}
                        className="flex-1 rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-700"
                      >
                        {addUrlCopied ? 'Copied' : 'Copy URL'}
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={
                          addLoading ||
                          currentEmployeeId === null ||
                          !addValidation.valid ||
                          isGatewayLimitBlockingError(addError)
                        }
                        className="flex-1 rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                      >
                        {addLoading ? 'Adding...' : 'Add Invoice'}
                      </button>
                    )}
                  </div>
                  </form>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Edit invoice modal */}
      {editingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4">
          <div className="relative max-h-[calc(100dvh-2rem)] w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={closeEditModal}
              disabled={editLoading}
              aria-label="Close modal"
              className="absolute right-4 top-4 z-20 rounded-full border border-orange-300 bg-white/95 p-2 text-orange-500 transition hover:bg-orange-50 hover:text-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CloseIcon />
            </button>
            <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl bg-neutral-100 p-6 text-slate-800 shadow-2xl scrollbar-thin">
              {(() => {
                return (
                  <form
                    onSubmit={handleEditSubmit}
                    onInvalidCapture={handleRequiredFieldInvalid}
                    onInputCapture={clearRequiredFieldInvalid}
                    onChangeCapture={clearRequiredFieldInvalid}
                    className="rounded-xl bg-white shadow-2xl outline outline-1 outline-slate-200"
                  >
                  {(() => {
                    const editBrandMeta = getInvoiceBrandMeta(editBrand)
                    return (
                  <div className="flex items-center justify-between rounded-t-xl bg-slate-900 px-10 py-8">
                    <div className="flex items-center gap-4">
                      <div className="h-16 w-44 flex items-center justify-start">
                        {editBrandMeta?.logo_url ? (
                          <img src={editBrandMeta.logo_url} alt={editBrand} className="max-h-16 w-auto object-contain" />
                        ) : (
                          <div className="h-6 w-6 border border-white/60 rounded-sm" />
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-5xl font-black uppercase tracking-wide text-orange-600">Invoice</p>
                      <p className="mt-2 text-xs font-bold uppercase tracking-wider text-slate-300">Edit Mode</p>
                    </div>
                  </div>
                    )
                  })()}

                  {(() => {
                    const subTotal = servicesSubtotal(editServices)
                    const grandTotal = subTotal
                    const paidAmount = Math.min(editPaidAmountTotal, grandTotal)
                    const remainingBalance = Math.max(grandTotal - paidAmount, 0)
                    const payableAmount = Math.min(parseAmountValue(editPayableAmount), grandTotal)
                    const remainingAmount = Math.max(remainingBalance - payableAmount, 0)
                    const editIsBmyInvoice = isBmyBrand(editBrand)
                    const showEditClientDropdown = editIsBmyInvoice && editBmyRecipientMode === 'registered'
                    const showEditClientNameField = !editIsBmyInvoice || editBmyRecipientMode === 'manual'
                    return (
                      <>
                        <div className="grid grid-cols-1 gap-10 px-10 py-8 md:grid-cols-2">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Invoice To</p>
                            <div className="mt-3 space-y-3">
                              <div>
                                <label htmlFor="edit-brand" className="block text-xs font-bold uppercase tracking-wide text-slate-500">Brand</label>
                                <select
                                  id="edit-brand"
                                  value={editBrand}
                                  onChange={(e) => {
                                    const nextBrand = e.target.value
                                    const switchingFromBmyToManual = isBmyBrand(editBrand) && !isBmyBrand(nextBrand)
                                    const switchingToBmy = !isBmyBrand(editBrand) && isBmyBrand(nextBrand)
                                    setEditBrand(nextBrand)
                                    if (switchingFromBmyToManual || !isBmyBrand(nextBrand)) {
                                      setEditBmyRecipientMode('manual')
                                      setEditClientId(null)
                                      setEditClientName('')
                                      setEditEmail('')
                                      setEditPhone('')
                                    } else if (switchingToBmy) {
                                      setEditBmyRecipientMode('registered')
                                      setEditClientId(null)
                                      setEditClientName('')
                                      setEditEmail('')
                                      setEditPhone('')
                                    }
                                  }}
                                  required
                                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                >
                                  {!brands.some((brand) => brand.brand_name === editBrand) && editBrand && (
                                    <option value={editBrand}>{editBrand}</option>
                                  )}
                                  <option value="" disabled>Select brand</option>
                                  {brands.map((brand) => (
                                    <option key={brand.id} value={brand.brand_name}>{brand.brand_name}</option>
                                  ))}
                                </select>
                              </div>
                              {editIsBmyInvoice ? (
                                <div>
                                  <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">Recipient</span>
                                  <div className="mt-1 grid grid-cols-2 overflow-hidden rounded-lg border border-slate-300 bg-slate-100 p-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditBmyRecipientMode('registered')
                                        setEditClientId(null)
                                        setEditClientName('')
                                        setEditEmail('')
                                        setEditPhone('')
                                      }}
                                      className={`rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wide transition ${
                                        editBmyRecipientMode === 'registered'
                                          ? 'bg-white text-slate-900 shadow-sm'
                                          : 'text-slate-500 hover:text-slate-900'
                                      }`}
                                    >
                                      Registered
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditBmyRecipientMode('manual')
                                        setEditClientId(null)
                                      }}
                                      className={`rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wide transition ${
                                        editBmyRecipientMode === 'manual'
                                          ? 'bg-white text-slate-900 shadow-sm'
                                          : 'text-slate-500 hover:text-slate-900'
                                      }`}
                                    >
                                      Manual
                                    </button>
                                  </div>
                                </div>
                              ) : null}
                              {showEditClientDropdown ? (
                              <div>
                                <label htmlFor="edit-client" className="block text-xs font-bold uppercase tracking-wide text-slate-500">Client</label>
                                <select
                                  id="edit-client"
                                  value={editClientId ?? ''}
                                  onChange={(e) => {
                                    const id = e.target.value ? Number(e.target.value) : null
                                    setEditClientId(id)
                                    if (id) {
                                      const c = clients.find((x) => x.id === id)
                                      if (c) {
                                        setEditClientName(c.name || '')
                                        setEditEmail(c.email || '')
                                        setEditPhone(c.phone || '')
                                      }
                                    } else {
                                      setEditClientName('')
                                      setEditEmail('')
                                      setEditPhone('')
                                    }
                                  }}
                                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                >
                                  <option value="">Select registered client</option>
                                  {clients.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name || c.email || `Client #${c.id}`}</option>
                                  ))}
                                </select>
                              </div>
                              ) : null}
                              {showEditClientNameField ? (
                              <div>
                                <label htmlFor="edit-client-name" className="block text-xs font-bold uppercase tracking-wide text-slate-500">Client name</label>
                                <input
                                  id="edit-client-name"
                                  type="text"
                                  value={editClientName}
                                  onChange={(e) => setEditClientName(e.target.value)}
                                  placeholder="Enter client name"
                                  required={showEditClientNameField}
                                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                />
                              </div>
                              ) : null}
                              <div>
                                <label htmlFor="edit-email" className="block text-xs font-bold uppercase tracking-wide text-slate-500">Email</label>
                                <input id="edit-email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="ketut.susilo@example.com" required className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                              </div>
                              <div>
                                <label htmlFor="edit-phone" className="block text-xs font-bold uppercase tracking-wide text-slate-500">Phone</label>
                                <input id="edit-phone" type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="+1 (555) 000-1234" required className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                              </div>
                            </div>
                          </div>

                          <div className="md:justify-self-end">
                            <div className="w-full max-w-xs space-y-3">
                              <div className="flex justify-between border-b border-slate-100 pb-2 text-sm">
                                <span className="text-slate-500">Invoice Number</span>
                                <span className="font-bold text-slate-900">#{formatInvoiceCode(editingInvoice.id)}</span>
                              </div>
                              <div className="flex justify-between border-b border-slate-100 pb-2 text-sm">
                                <span className="text-slate-500">Issue Date</span>
                                <span className="font-bold text-slate-900">{editingInvoice.invoice_date || new Date().toISOString().slice(0, 10)}</span>
                              </div>
                              <div className="flex justify-between border-b border-slate-100 pb-2 text-sm">
                                <span className="text-slate-500">Due Date</span>
                                <span className="font-bold text-slate-900">{addDaysToISODate(editingInvoice.invoice_date || new Date().toISOString().slice(0, 10), 30)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mx-10 overflow-hidden rounded-xl border border-slate-200">
                          <div className="grid grid-cols-[72px_minmax(0,1fr)_220px_auto] gap-4 bg-slate-50 px-4 py-4 text-xs font-bold uppercase tracking-wide text-slate-700">
                            <span>No</span><span>Description</span><span>Price</span><span />
                          </div>
                          {editServices.map((line, idx) => (
                            <div key={`edit-service-${idx}`} className="grid grid-cols-[72px_minmax(0,1fr)_220px_auto] items-center gap-4 border-t border-slate-100 px-4 py-4 text-sm">
                              <span>{String(idx + 1).padStart(2, '0')}</span>
                              <input
                                type="text"
                                value={line.description}
                                onChange={(e) => updateEditServiceLine(idx, 'description', e.target.value)}
                                placeholder="Service description"
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                              />
                              <input
                                type="text"
                                value={line.price}
                                onChange={(e) => updateEditServiceLine(idx, 'price', e.target.value)}
                                placeholder="0.00"
                                inputMode="decimal"
                                pattern="^\d+(\.\d{1,2})?$"
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                              />
                              <div className="flex items-center justify-end gap-2">
                                {editServices.length > 1 && (
                                  <button type="button" onClick={() => setEditServices((prev) => prev.filter((_, i) => i !== idx))} className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50">Remove</button>
                                )}
                              </div>
                            </div>
                          ))}
                          <div className="border-t border-slate-100 px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setEditServices((prev) => [...prev, { description: '', qty: 1, price: '' }])}
                              className="rounded-lg border border-orange-300 px-3 py-2 text-xs font-bold uppercase tracking-wide text-orange-700 hover:bg-orange-50"
                            >
                              Add Service Row
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-8 px-10 py-8 md:grid-cols-2">
                          <div className="space-y-5">
                            <div>
                              <p className="text-sm font-bold text-slate-900">Payment Details</p>
                              <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                                <p><span className="font-semibold text-slate-800">Card payments:</span> Stripe</p>
                                <div className="mt-3">
                                  <label htmlFor="edit-invoice-type" className="block text-xs font-bold uppercase tracking-wide text-slate-500">Invoice Type</label>
                                  <select
                                    id="edit-invoice-type"
                                    value={editInvoiceType}
                                    onChange={(e) => setEditInvoiceType(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                  >
                                    {INVOICE_TYPE_OPTIONS.map((option) => (
                                      <option key={option} value={option}>{option}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">Terms & Conditions</p>
                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                Please review our{' '}
                                <a href="https://bmybrand.com/terms-of-use" target="_blank" rel="noopener noreferrer" className="font-semibold text-orange-600 hover:text-orange-700">
                                  Terms & Conditions
                                </a>{' '}
                                and{' '}
                                <a href="https://bmybrand.com/privacy-policy" target="_blank" rel="noopener noreferrer" className="font-semibold text-orange-600 hover:text-orange-700">
                                  Privacy Policy
                                </a>
                                .
                              </p>
                            </div>
                          </div>

                          <div className="md:justify-self-end md:w-80">
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-slate-600">Total</span>
                                <span className="flex items-center gap-2 font-medium text-slate-700">
                                  {formatCurrencyAmount(grandTotal, editCurrency, false)}
                                  {!isAdvanceUnpaidStatus(editStatus) && (
                                    <CurrencyPrefixSelect id="edit-currency-total" value={editCurrency} onChange={setEditCurrency} />
                                  )}
                                </span>
                              </div>
                              {paidAmount > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-slate-600">Paid</span>
                                  <span className="font-medium text-emerald-600">{formatCurrencyAmount(paidAmount, editCurrency)}</span>
                                </div>
                              )}
                              {paidAmount > 0 && !isAdvanceUnpaidStatus(editStatus) && (
                                <div className="flex justify-between">
                                  <span className="text-slate-600">Remaining</span>
                                  <span className="font-medium text-slate-700">{formatCurrencyAmount(remainingBalance, editCurrency)}</span>
                                </div>
                              )}
                              {isAdvanceUnpaidStatus(editStatus) && (
                                <>
                                  <div className="rounded-xl bg-orange-600 p-4 text-white">
                                    <label htmlFor="edit-payable-amount" className="block text-xs font-bold uppercase tracking-wide text-orange-100">Payable Amount</label>
                                    <div className="mt-2 flex items-center rounded-xl border border-white/70 bg-white px-5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_10px_24px_rgba(124,45,18,0.18)] focus-within:border-white focus-within:ring-4 focus-within:ring-white/25">
                                      <span className="shrink-0 text-2xl font-black text-slate-500">$</span>
                                      <input
                                        id="edit-payable-amount"
                                        type="text"
                                        value={editPayableAmount}
                                        onChange={(e) => setEditPayableAmount(sanitizeCurrencyInput(e.target.value))}
                                        placeholder="0.00"
                                        inputMode="decimal"
                                        pattern="^\d+(\.\d{1,2})?$"
                                        className="ml-3 min-w-0 flex-1 bg-transparent text-2xl font-black text-slate-900 placeholder:text-slate-400 focus:outline-none"
                                      />
                                      <CurrencyPrefixSelect id="edit-currency" value={editCurrency} onChange={setEditCurrency} />
                                    </div>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-slate-600">Remaining</span>
                                    <span className="font-medium text-slate-700">{formatCurrencyAmount(remainingAmount, editCurrency)}</span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {isBmyBrand(editBrand) ? (
                          <div className="border-t border-slate-200 bg-slate-50 px-10 py-6 text-sm text-slate-500">
                            +14695011401 | www.bmybrand.com | billing@bmybrand.com
                          </div>
                        ) : null}
                      </>
                    )
                  })()}

                  {editError && (
                    <GatewayLimitAlert
                      message={editError}
                      gateways={editGatewayLimits}
                      infoOpen={editGatewayInfoOpen}
                      onToggleInfo={() => setEditGatewayInfoOpen((open) => !open)}
                    />
                  )}
                  {editInvoiceUrl && (
                    <div className={`mx-10 mt-4 flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${editUrlCopied ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-slate-200 bg-slate-50'}`}>
                      <a
                        href={editInvoiceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`min-w-0 flex-1 truncate ${editUrlCopied ? 'text-emerald-700' : 'text-slate-700 hover:text-orange-600'}`}
                      >
                        {editInvoiceUrl}
                      </a>
                      <button
                        type="button"
                        onClick={handleCopyEditInvoiceUrl}
                        aria-label="Copy invoice URL"
                        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition ${editUrlCopied ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700' : 'border-slate-300 bg-white text-slate-600 hover:border-orange-300 hover:text-orange-600'}`}
                      >
                        <CopyIcon className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  <div className="flex flex-col gap-3 px-10 py-6 sm:flex-row sm:justify-end">
                    <button
                      type="submit"
                      disabled={editLoading || !editValidation.valid}
                      className="flex-1 rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                    >
                      {editLoading ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyEditInvoiceUrl}
                      disabled={editLoading}
                      className="inline-flex min-w-[108px] items-center justify-center gap-2 rounded-xl border border-orange-300 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-50"
                    >
                      <CopyIcon className="h-4 w-4" />
                      {editUrlCopied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  </form>
                )
              })()}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

