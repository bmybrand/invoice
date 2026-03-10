'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useDashboardProfile } from '@/components/DashboardLayout'

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

type InvoiceRow = {
  id: number
  invoice_date: string
  invoice_creator_id: number
  invoice_creator: string
  brand_name: string
  email: string
  service: ServiceLine[]
  phone: string
  amount: string
  status: string
}

const INVOICE_GRID = 'minmax(48px,0.6fr) minmax(100px,1.2fr) minmax(100px,1.2fr) minmax(100px,1.2fr) minmax(140px,1.5fr) minmax(90px,1.15fr) minmax(100px,1.2fr) minmax(90px,1fr) minmax(90px,1fr) 150px'

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

function ChevronDownIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  )
}

function getStatusStyle(status: string): string {
  const s = (status || '').toLowerCase()
  if (s.includes('paid') || s.includes('completed')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  if (s.includes('pending')) return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
  if (s.includes('overdue') || s.includes('cancelled')) return 'bg-red-500/10 text-red-400 border-red-500/20'
  return 'bg-slate-500/10 text-slate-400 border-slate-500/20'
}

function parseAmountValue(amount: string): number {
  const n = Number((amount || '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
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

function formatInvoiceCode(id: number): string {
  const mixed = (id * 7919 + 12345) % 100000
  const normalized = Math.abs(mixed)
  return String(normalized).padStart(5, '0')
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

export function InvoiceDocument({
  invoice,
  brandMeta,
  canDownloadPdf,
  showPaidWatermark,
  onDownload,
  rootId,
  includeDownloadButton = true,
}: {
  invoice: InvoiceRow
  brandMeta: BrandOption | null
  canDownloadPdf: boolean
  showPaidWatermark: boolean
  onDownload: () => void
  rootId?: string
  includeDownloadButton?: boolean
}) {
  const serviceLines = toServiceLines((invoice as unknown as { service?: unknown }).service)
  const subTotal = servicesSubtotal(serviceLines)
  const grandTotal = subTotal

  return (
    <div id={rootId} className="relative flex min-h-[calc(100vh-8rem)] flex-col overflow-visible bg-white shadow-xl print:min-h-0 print:overflow-visible">
      {showPaidWatermark && (
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
          <p className="text-5xl font-black uppercase tracking-wide text-orange-600">Invoice</p>
          {includeDownloadButton && (
            <button
              type="button"
              onClick={onDownload}
              disabled={!canDownloadPdf}
              className="no-print print-hide-download print:hidden mt-3 inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-xs font-bold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
              title={canDownloadPdf ? 'Download invoice PDF' : 'Download is available after payment'}
            >
              <span className="inline-block h-2 w-2 rounded-sm bg-white" />
              Download PDF
            </button>
          )}
        </div>
      </div>

      <div className="invoice-meta-grid relative z-10 grid grid-cols-1 gap-10 px-10 py-8 md:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Invoice To</p>
          <p className="mt-2 text-xl font-bold text-slate-900">{invoice.brand_name || 'Ketut Susilo'}</p>
          <div className="mt-3 space-y-1 text-sm text-slate-600">
            <p>2118 Thornridge Cir. Syracuse,</p>
            <p>Connecticut 35624, USA</p>
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
            <div className="pt-1">
              <span className={`inline-block rounded-lg border px-3 py-1 text-xs font-semibold ${getStatusStyle(invoice.status)}`}>
                {invoice.status || '-'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="invoice-services-wrap relative z-10 mx-10 overflow-hidden rounded-xl border border-slate-200">
        <div className="invoice-services-head invoice-services-head-print grid grid-cols-[72px_1fr_90px_130px_130px] bg-slate-50 px-4 py-4 text-xs font-bold uppercase tracking-wide text-slate-700">
          <span>No</span><span>Description</span><span>Qty</span><span>Price</span><span className="text-right">Total</span>
        </div>
        {serviceLines.length === 0 ? (
          <div className="border-t border-slate-100 px-4 py-4 text-sm text-slate-500">No services added.</div>
        ) : (
          serviceLines.map((line, idx) => (
            <div key={`view-service-${idx}`} className="invoice-services-row grid grid-cols-[72px_1fr_90px_130px_130px] border-t border-slate-100 px-4 py-4 text-sm">
              <span className="text-slate-700">{String(idx + 1).padStart(2, '0')}</span>
              <span className="text-slate-800">{line.description || 'Service'}</span>
              <span className="text-slate-700">{line.qty}</span>
              <span className="text-slate-700">{line.price || '$0.00'}</span>
              <span className="text-right font-bold text-slate-900">${serviceLineTotal(line).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          ))
        )}
      </div>

      <div className="invoice-summary-grid relative z-10 grid grid-cols-1 gap-8 px-10 py-8 pb-12 md:grid-cols-2">
        <div className="space-y-5">
          <div>
            <p className="text-sm font-bold text-slate-900">Payment Details</p>
            <div className="invoice-payment-box mt-2 rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
              <p><span className="font-semibold text-slate-800">Bank:</span> Global Trust Bank</p>
              <p><span className="font-semibold text-slate-800">Account Name:</span> Studio Shodwe LLC</p>
              <p><span className="font-semibold text-slate-800">Account No:</span> 9876 5432 1011 1213</p>
            </div>
          </div>
        </div>

        <div className="md:justify-self-end md:w-80">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-600">Sub Total</span><span className="font-medium text-slate-700">${subTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
            <div className="my-2 h-px bg-slate-200" />
            <div className="invoice-grand-total flex justify-between rounded-xl bg-orange-600 p-4 text-white">
              <span className="text-lg font-bold">Grand Total</span>
              <span className="text-2xl font-black">${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>
      </div>

      <div className="invoice-bottom-block mt-auto shrink-0">
        <div className="relative z-10 px-10 pb-6">
          <p className="text-sm font-bold text-slate-900">Terms & Conditions</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Please pay within 15 days of receiving this invoice. A late fee of 5% per month will be applied to overdue balances.</p>
        </div>
        <div className="invoice-footer-contact relative z-10 border-t border-slate-200 bg-slate-50 px-10 py-6 text-sm text-slate-500">
          +1 (555) 000-1234 | www.studioshodwe.com | 456 Design Blvd, Creative City, NY
        </div>
      </div>
    </div>
  )
}

export default function Invoice() {
  const router = useRouter()
  const { displayRole } = useDashboardProfile()
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(true)
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [brands, setBrands] = useState<BrandOption[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all')
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addBrand, setAddBrand] = useState('')
  const [addEmail, setAddEmail] = useState('')
  const [addServices, setAddServices] = useState<ServiceLine[]>([{ description: '', qty: 1, price: '' }])
  const [addPhone, setAddPhone] = useState('')
  const [addStatus, setAddStatus] = useState('Pending')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [editingInvoice, setEditingInvoice] = useState<InvoiceRow | null>(null)
  const [editBrand, setEditBrand] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editServices, setEditServices] = useState<ServiceLine[]>([{ description: '', qty: 1, price: '' }])
  const [editPhone, setEditPhone] = useState('')
  const [editStatus, setEditStatus] = useState('Pending')
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [deletingInvoice, setDeletingInvoice] = useState<InvoiceRow | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [currentUserEmployeeId, setCurrentUserEmployeeId] = useState<number | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const authId = data.user?.id ?? null
      if (authId) {
        const { data: emp } = await supabase.from('employees').select('id').eq('auth_id', authId).maybeSingle()
        setCurrentUserEmployeeId(emp ? (emp as { id: number }).id : null)
      } else {
        setCurrentUserEmployeeId(null)
      }
    })
  }, [])

  function canEditInvoice(inv: InvoiceRow): boolean {
    if (isSuperAdmin) return true
    return currentUserEmployeeId !== null && currentUserEmployeeId === inv.invoice_creator_id
  }

  function canDeleteInvoice(inv: InvoiceRow): boolean {
    if (isSuperAdmin) return true
    return currentUserEmployeeId !== null && currentUserEmployeeId === inv.invoice_creator_id
  }


  const fetchInvoices = useCallback(async () => {
    setInvoicesLoading(true)
    const { data, error } = await supabase
      .from('invoices')
      .select('*, employees!invoice_creator_id(employee_name)')
      .order('created_at', { ascending: false })
    setInvoicesLoading(false)
    if (error) {
      console.error('Failed to fetch invoices', error)
      setInvoices([])
      return
    }
    const rows = (data ?? []).map((row: Record<string, unknown>) => {
      const emp = row.employees as { employee_name?: string } | { employee_name?: string }[] | null
      const empObj = Array.isArray(emp) ? emp[0] : emp
      const services = toServiceLines(row.service)
      const subtotal = servicesSubtotal(services)
      return {
        id: row.id as number,
        invoice_date: (row.invoice_date as string) ?? '',
        invoice_creator_id: (row.invoice_creator_id as number) ?? 0,
        invoice_creator: empObj?.employee_name ?? '--',
        brand_name: (row.brand_name as string) ?? '',
        email: (row.email as string) ?? '',
        service: services,
        phone: (row.phone as string) ?? '',
        amount: ((row.amount as string) ?? '').trim() || subtotal.toFixed(2),
        status: (row.status as string) ?? 'Pending',
      }
    })
    setInvoices(rows)
  }, [])

  const fetchEmployees = useCallback(async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('id, employee_name')
      .order('employee_name')
    if (error) {
      console.error('Failed to fetch employees', error)
      setEmployees([])
      return
    }
    setEmployees((data as EmployeeOption[]) ?? [])
  }, [])

  const fetchBrands = useCallback(async () => {
    const { data, error } = await supabase
      .from('brands')
      .select('id, brand_name, brand_url, logo_url')
      .order('brand_name')
    if (error) {
      console.error('Failed to fetch brands', error)
      setBrands([])
      return
    }
    setBrands((data as BrandOption[]) ?? [])
  }, [])

  useEffect(() => {
    fetchInvoices()
  }, [fetchInvoices])

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  useEffect(() => {
    fetchBrands()
  }, [fetchBrands])

  const isSuperAdmin = (displayRole || '').trim().toLowerCase().replace(/\s+/g, '') === 'superadmin'

  const statusOptions: { label: string; value: 'all' | 'paid' | 'unpaid' }[] = [
    { label: 'All Statuses', value: 'all' },
    { label: 'Paid', value: 'paid' },
    { label: 'Unpaid', value: 'unpaid' },
  ]
  const statusFilterLabel = statusOptions.find((o) => o.value === statusFilter)?.label ?? 'All Statuses'

  const PAGE_SIZE = 10

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter])

  const filteredInvoices = (() => {
    let list = invoices
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter(
        (i) =>
          (i.invoice_creator || '').toLowerCase().includes(q) ||
          (i.brand_name || '').toLowerCase().includes(q) ||
          (i.email || '').toLowerCase().includes(q) ||
          i.service.some((s) => (s.description || '').toLowerCase().includes(q)) ||
          (i.status || '').toLowerCase().includes(q) ||
          String(i.id).includes(searchQuery.trim())
      )
    }
    if (statusFilter === 'paid') {
      list = list.filter((i) => (i.status || '').toLowerCase() === 'paid')
    } else if (statusFilter === 'unpaid') {
      list = list.filter((i) => (i.status || '').toLowerCase() !== 'paid')
    }
    return list
  })()
  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / PAGE_SIZE))
  const start = (currentPage - 1) * PAGE_SIZE
  const paginatedInvoices = filteredInvoices.slice(start, start + PAGE_SIZE)

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1)
  }, [currentPage, totalPages])

  function validateServiceLines(lines: ServiceLine[]): { valid: boolean; message: string } {
    if (lines.length === 0) return { valid: false, message: 'At least one service is required.' }
    const hasIncomplete = lines.some((line) => !line.description.trim() || !line.price.trim() || (Number(line.qty) || 0) <= 0)
    if (hasIncomplete) return { valid: false, message: 'Fill all service rows: description, quantity, and price.' }
    const hasInvalidPrice = lines.some((line) => !isValidPrice(line.price))
    if (hasInvalidPrice) return { valid: false, message: 'Price must be numeric only (up to 2 decimals).' }
    return { valid: true, message: '' }
  }

  const addValidation = (() => {
    if (!addBrand.trim() || !addEmail.trim() || !addPhone.trim() || !addStatus.trim()) {
      return { valid: false, message: 'Fill all required fields: brand, email, phone, status.' }
    }
    if (!isValidEmail(addEmail.trim())) {
      return { valid: false, message: 'Enter a valid email address.' }
    }
    return validateServiceLines(addServices)
  })()

  const editValidation = (() => {
    if (!editBrand.trim() || !editEmail.trim() || !editPhone.trim() || !editStatus.trim()) {
      return { valid: false, message: 'Fill all required fields: brand, email, phone, status.' }
    }
    if (!isValidEmail(editEmail.trim())) {
      return { valid: false, message: 'Enter a valid email address.' }
    }
    return validateServiceLines(editServices)
  })()

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (currentUserEmployeeId === null) return
    if (!addValidation.valid) {
      setAddError(addValidation.message)
      return
    }
    const cleanServices = addServices.map((line) => ({
      description: line.description.trim(),
      qty: Number(line.qty) || 1,
      price: line.price.trim(),
    }))
    const subTotal = servicesSubtotal(cleanServices)
    setAddError(null)
    setAddLoading(true)

    const { error: insertError } = await supabase.from('invoices').insert({
      invoice_date: new Date().toISOString().slice(0, 10),
      invoice_creator_id: currentUserEmployeeId,
      brand_name: addBrand.trim(),
      email: addEmail.trim(),
      service: cleanServices,
      phone: addPhone.trim(),
      amount: subTotal.toFixed(2),
      status: addStatus,
    })

    setAddLoading(false)
    if (insertError) {
      setAddError(insertError.message)
      return
    }

    setShowAddModal(false)
    setAddBrand('')
    setAddEmail('')
    setAddServices([{ description: '', qty: 1, price: '' }])
    setAddPhone('')
    setAddStatus('Pending')
    await fetchInvoices()
  }

  function openEditModal(inv: InvoiceRow) {
    setEditingInvoice(inv)
    setEditBrand(inv.brand_name || '')
    setEditEmail(inv.email || '')
    setEditServices(inv.service.length > 0 ? inv.service : [{ description: '', qty: 1, price: '' }])
    setEditPhone(inv.phone || '')
    setEditStatus(inv.status || 'Pending')
    setEditError(null)
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingInvoice || !canEditInvoice(editingInvoice)) return
    if (!editValidation.valid) {
      setEditError(editValidation.message)
      return
    }
    const cleanServices = editServices.map((line) => ({
      description: line.description.trim(),
      qty: Number(line.qty) || 1,
      price: line.price.trim(),
    }))
    const subTotal = servicesSubtotal(cleanServices)
    setEditError(null)
    setEditLoading(true)

    const { error } = await supabase
      .from('invoices')
      .update({
        brand_name: editBrand.trim(),
        email: editEmail.trim(),
        service: cleanServices,
        phone: editPhone.trim(),
        amount: subTotal.toFixed(2),
        status: editStatus,
      })
      .eq('id', editingInvoice.id)

    setEditLoading(false)
    if (error) {
      setEditError(error.message)
      return
    }

    setEditingInvoice(null)
    await fetchInvoices()
  }

  async function handleDeleteConfirm() {
    if (!deletingInvoice || !canDeleteInvoice(deletingInvoice)) return
    setDeleteLoading(true)
    const { error } = await supabase.from('invoices').delete().eq('id', deletingInvoice.id)
    setDeleteLoading(false)
    if (error) {
      console.error('Failed to delete invoice', error)
      return
    }
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
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="h-12 min-w-36 px-6 bg-orange-500 rounded-xl shadow-[0px_4px_20px_0px_rgba(249,115,22,0.2)] flex justify-center items-center gap-2 hover:bg-orange-600 transition shrink-0"
          >
            <PlusIcon className="h-4 w-3 text-white" />
            <span className="text-white text-sm font-bold">Add New Invoice</span>
          </button>
        </div>
      </div>

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
                placeholder="Search by ID, creator, brand, email, service or status..."
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
        <div className="w-full overflow-x-auto">
          <div className="w-full" style={{ minWidth: '1180px' }}>
            {/* Table header */}
            <div className="w-full grid bg-slate-900/50 border-b border-slate-700" style={{ gridTemplateColumns: INVOICE_GRID }}>
              <div className="px-4 sm:px-6 py-4 min-w-0">
                <span className="block truncate whitespace-nowrap text-slate-400 text-xs font-bold uppercase tracking-wide">Invoice ID</span>
              </div>
              <div className="px-4 sm:px-6 py-4 min-w-0">
                <span className="block truncate whitespace-nowrap text-slate-400 text-xs font-bold uppercase tracking-wide">Invoice Date</span>
              </div>
              <div className="px-4 sm:px-6 py-4 min-w-0">
                <span className="block truncate whitespace-nowrap text-slate-400 text-xs font-bold uppercase tracking-wide">Invoice Creator</span>
              </div>
              <div className="px-4 sm:px-6 py-4 min-w-0">
                <span className="block truncate whitespace-nowrap text-slate-400 text-xs font-bold uppercase tracking-wide">Brand Name</span>
              </div>
              <div className="px-4 sm:px-6 py-4 min-w-0">
                <span className="block truncate whitespace-nowrap text-slate-400 text-xs font-bold uppercase tracking-wide">Email</span>
              </div>
              <div className="px-4 sm:px-6 py-4 min-w-0">
                <span className="block truncate whitespace-nowrap text-slate-400 text-xs font-bold uppercase tracking-wide">Service</span>
              </div>
              <div className="px-4 sm:px-6 py-4 min-w-0">
                <span className="block truncate whitespace-nowrap text-slate-400 text-xs font-bold uppercase tracking-wide">Phone</span>
              </div>
              <div className="px-4 sm:px-6 py-4 min-w-0">
                <span className="block truncate whitespace-nowrap text-slate-400 text-xs font-bold uppercase tracking-wide">Amount</span>
              </div>
              <div className="px-4 sm:px-6 py-4 min-w-0">
                <span className="block truncate whitespace-nowrap text-slate-400 text-xs font-bold uppercase tracking-wide">Status</span>
              </div>
              <div className="px-4 sm:px-6 py-4 text-right">
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
                    <span className="text-white text-sm font-bold font-mono block truncate whitespace-nowrap" title={`#${start + rowIndex + 1}`}>#{start + rowIndex + 1}</span>
                  </div>
                  <div className="px-4 sm:px-6 py-4 min-w-0">
                    <span className="text-white text-sm block truncate whitespace-nowrap" title={inv.invoice_date || '--'}>{inv.invoice_date || '--'}</span>
                  </div>
                  <div className="px-4 sm:px-6 py-4 min-w-0">
                    <span className="text-white text-sm block truncate whitespace-nowrap" title={inv.invoice_creator || '--'}>{inv.invoice_creator || '--'}</span>
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
                    <span
                      className="block truncate whitespace-nowrap text-white text-sm font-semibold"
                      title={`$${parseAmountValue(inv.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    >
                      ${parseAmountValue(inv.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="px-4 sm:px-6 py-4 min-w-0">
                    <span
                      className={`inline-block max-w-full truncate whitespace-nowrap px-2 py-1 rounded-lg border text-xs font-medium ${getStatusStyle(inv.status)}`}
                      title={inv.status || '--'}
                    >
                      {inv.status || '--'}
                    </span>
                  </div>
                  <div className="px-4 sm:px-6 py-4 flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => router.push(`/invoice?id=${inv.id}`)}
                      className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-blue-400 transition"
                      aria-label="View"
                    >
                      <InfoIcon />
                    </button>
                    {canEditInvoice(inv) && (
                      <button
                        type="button"
                        onClick={() => openEditModal(inv)}
                        className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-slate-300 transition"
                        aria-label="Edit"
                      >
                        <PencilIcon />
                      </button>
                    )}
                    {canDeleteInvoice(inv) && (
                      <button
                        type="button"
                        onClick={() => setDeletingInvoice(inv)}
                        className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-red-400 transition"
                        aria-label="Delete"
                      >
                        <TrashIcon />
                      </button>
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
              className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-700/50 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirm modal */}
      {deletingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => !deleteLoading && setDeletingInvoice(null)}>
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white">Delete Invoice</h2>
            <p className="mt-1 text-sm text-slate-400">
              Delete invoice <span className="font-semibold text-white">#{formatInvoiceCode(deletingInvoice.id)}</span>? This cannot be undone.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => !deleteLoading && setDeletingInvoice(null)}
                className="flex-1 rounded-xl border border-slate-600 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-700/50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleteLoading}
                className="flex-1 rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add invoice modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => !addLoading && setShowAddModal(false)}>
          <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl bg-neutral-100 p-6 shadow-2xl text-slate-800" onClick={(e) => e.stopPropagation()}>
            {(() => {
              return (
                <form onSubmit={handleAddSubmit} className="rounded-xl bg-white shadow-2xl outline outline-1 outline-slate-200">
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
                    return (
                      <>
                        <div className="grid grid-cols-1 gap-10 px-10 py-8 md:grid-cols-2">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Invoice To</p>
                            <div className="mt-3 space-y-3">
                              <div>
                                <label htmlFor="add-brand" className="block text-xs font-bold uppercase tracking-wide text-slate-500">Client Name</label>
                                <select
                                  id="add-brand"
                                  value={addBrand}
                                  onChange={(e) => setAddBrand(e.target.value)}
                                  required
                                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                >
                                  <option value="" disabled>Select brand</option>
                                  {brands.map((brand) => (
                                    <option key={brand.id} value={brand.brand_name}>{brand.brand_name}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label htmlFor="add-email" className="block text-xs font-bold uppercase tracking-wide text-slate-500">Email</label>
                                <input id="add-email" type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="ketut.susilo@example.com" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                              </div>
                              <div>
                                <label htmlFor="add-phone" className="block text-xs font-bold uppercase tracking-wide text-slate-500">Phone</label>
                                <input id="add-phone" type="tel" value={addPhone} onChange={(e) => setAddPhone(e.target.value)} placeholder="+1 (555) 000-1234" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                              </div>
                              <p className="text-sm text-slate-500">2118 Thornridge Cir. Syracuse, Connecticut 35624, USA</p>
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
                              <div>
                                <label htmlFor="add-status" className="block text-xs font-bold uppercase tracking-wide text-slate-500">Status</label>
                                <select id="add-status" value={addStatus} onChange={(e) => setAddStatus(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20">
                                  <option value="Pending">Pending</option>
                                  <option value="Paid">Paid</option>
                                  <option value="Overdue">Overdue</option>
                                  <option value="Cancelled">Cancelled</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mx-10 overflow-hidden rounded-xl border border-slate-200">
                          <div className="grid grid-cols-[72px_1fr_140px_140px] bg-slate-50 px-4 py-4 text-xs font-bold uppercase tracking-wide text-slate-700">
                            <span>No</span><span>Description</span><span>Price</span><span className="text-right">Total</span>
                          </div>
                          {addServices.map((line, idx) => (
                            <div key={`add-service-${idx}`} className="grid grid-cols-[72px_1fr_140px_140px] border-t border-slate-100 px-4 py-4 text-sm">
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
                                <span className="font-bold">${serviceLineTotal(line).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
                                <p><span className="font-semibold text-slate-800">Bank:</span> Global Trust Bank</p>
                                <p><span className="font-semibold text-slate-800">Account Name:</span> Studio Shodwe LLC</p>
                                <p><span className="font-semibold text-slate-800">Account No:</span> 9876 5432 1011 1213</p>
                              </div>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">Terms & Conditions</p>
                              <p className="mt-1 text-xs leading-5 text-slate-500">Please pay within 15 days of receiving this invoice. A late fee of 5% per month will be applied to overdue balances.</p>
                            </div>
                          </div>

                          <div className="md:justify-self-end md:w-80">
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between"><span className="text-slate-600">Sub Total</span><span className="font-medium text-slate-700">${subTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                              <div className="my-2 h-px bg-slate-200" />
                              <div className="flex justify-between rounded-xl bg-orange-600 p-4 text-white">
                                <span className="text-lg font-bold">Grand Total</span>
                                <span className="text-2xl font-black">${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-slate-200 bg-slate-50 px-10 py-6 text-sm text-slate-500">
                          +1 (555) 000-1234 | www.studioshodwe.com | 456 Design Blvd, Creative City, NY
                        </div>
                      </>
                    )
                  })()}

                  {currentUserEmployeeId === null && !addError && (
                    <p className="mx-10 mt-4 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">You must be registered as an employee to create invoices.</p>
                  )}
                  {addError && <p className="mx-10 mt-4 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-700">{addError}</p>}

                  <div className="flex gap-3 px-10 py-6">
                    <button type="button" onClick={() => !addLoading && setShowAddModal(false)} className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100">Cancel</button>
                    <button
                      type="submit"
                      disabled={addLoading || currentUserEmployeeId === null || !addValidation.valid}
                      className="flex-1 rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                    >
                      {addLoading ? 'Adding...' : 'Add Invoice'}
                    </button>
                  </div>
                </form>
              )
            })()}
          </div>
        </div>
      )}

      {/* Edit invoice modal */}
      {editingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => !editLoading && setEditingInvoice(null)}>
          <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl bg-neutral-100 p-6 shadow-2xl text-slate-800" onClick={(e) => e.stopPropagation()}>
            {(() => {
              return (
                <form onSubmit={handleEditSubmit} className="rounded-xl bg-white shadow-2xl outline outline-1 outline-slate-200">
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
                    return (
                      <>
                        <div className="grid grid-cols-1 gap-10 px-10 py-8 md:grid-cols-2">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Invoice To</p>
                            <div className="mt-3 space-y-3">
                              <div>
                                <label htmlFor="edit-brand" className="block text-xs font-bold uppercase tracking-wide text-slate-500">Client Name</label>
                                <select
                                  id="edit-brand"
                                  value={editBrand}
                                  onChange={(e) => setEditBrand(e.target.value)}
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
                              <div>
                                <label htmlFor="edit-email" className="block text-xs font-bold uppercase tracking-wide text-slate-500">Email</label>
                                <input id="edit-email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="ketut.susilo@example.com" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                              </div>
                              <div>
                                <label htmlFor="edit-phone" className="block text-xs font-bold uppercase tracking-wide text-slate-500">Phone</label>
                                <input id="edit-phone" type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="+1 (555) 000-1234" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                              </div>
                              <p className="text-sm text-slate-500">2118 Thornridge Cir. Syracuse, Connecticut 35624, USA</p>
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
                              <div>
                                <label htmlFor="edit-status" className="block text-xs font-bold uppercase tracking-wide text-slate-500">Status</label>
                                <select id="edit-status" value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20">
                                  <option value="Pending">Pending</option>
                                  <option value="Paid">Paid</option>
                                  <option value="Overdue">Overdue</option>
                                  <option value="Cancelled">Cancelled</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mx-10 overflow-hidden rounded-xl border border-slate-200">
                          <div className="grid grid-cols-[72px_1fr_140px_140px] bg-slate-50 px-4 py-4 text-xs font-bold uppercase tracking-wide text-slate-700">
                            <span>No</span><span>Description</span><span>Price</span><span className="text-right">Total</span>
                          </div>
                          {editServices.map((line, idx) => (
                            <div key={`edit-service-${idx}`} className="grid grid-cols-[72px_1fr_140px_140px] border-t border-slate-100 px-4 py-4 text-sm">
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
                                <span className="font-bold">${serviceLineTotal(line).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
                                <p><span className="font-semibold text-slate-800">Bank:</span> Global Trust Bank</p>
                                <p><span className="font-semibold text-slate-800">Account Name:</span> Studio Shodwe LLC</p>
                                <p><span className="font-semibold text-slate-800">Account No:</span> 9876 5432 1011 1213</p>
                              </div>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">Terms & Conditions</p>
                              <p className="mt-1 text-xs leading-5 text-slate-500">Please pay within 15 days of receiving this invoice. A late fee of 5% per month will be applied to overdue balances.</p>
                            </div>
                          </div>

                          <div className="md:justify-self-end md:w-80">
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between"><span className="text-slate-600">Sub Total</span><span className="font-medium text-slate-700">${subTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                              <div className="my-2 h-px bg-slate-200" />
                              <div className="flex justify-between rounded-xl bg-orange-600 p-4 text-white">
                                <span className="text-lg font-bold">Grand Total</span>
                                <span className="text-2xl font-black">${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-slate-200 bg-slate-50 px-10 py-6 text-sm text-slate-500">
                          +1 (555) 000-1234 | www.studioshodwe.com | 456 Design Blvd, Creative City, NY
                        </div>
                      </>
                    )
                  })()}

                  {editError && <p className="mx-10 mt-4 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-700">{editError}</p>}

                  <div className="flex gap-3 px-10 py-6">
                    <button type="button" onClick={() => !editLoading && setEditingInvoice(null)} className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100">Cancel</button>
                    <button
                      type="submit"
                      disabled={editLoading || !editValidation.valid}
                      className="flex-1 rounded-xl bg-orange-600 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                    >
                      {editLoading ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              )
            })()}
          </div>
        </div>
      )}

    </div>
  )
}
