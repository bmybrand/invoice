'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { logFetchError } from '@/lib/fetch-error'

type GlobalDashboardSearchProps = {
  accountType: 'employee' | 'client' | null
  displayRole: string
  displayDepartment: string
  currentUserAuthId: string | null
  currentEmployeeId: number | null
  currentClientId?: number | null
}

type SearchResult = {
  id: string
  kind: 'employee' | 'client' | 'chat' | 'invoice' | 'payment' | 'brand' | 'gateway'
  title: string
  subtitle: string
  context: string
  href: string
}

function SearchIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  )
}

function SearchResultIcon({ kind }: { kind: SearchResult['kind'] }) {
  const label =
    kind === 'employee'
      ? 'EM'
      : kind === 'client'
        ? 'CL'
        : kind === 'chat'
          ? 'CH'
          : kind === 'invoice'
            ? 'IN'
            : kind === 'payment'
              ? 'PY'
              : kind === 'brand'
                ? 'BR'
                : 'GW'

  return (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-[10px] font-black tracking-wide text-slate-300">
      {label}
    </span>
  )
}

function normalizeRole(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

function withSearchParam(href: string, query: string) {
  const params = new URLSearchParams()
  params.set('globalSearch', query)
  return href.includes('?') ? `${href}&${params.toString()}` : `${href}?${params.toString()}`
}

function formatInvoiceCode(id: number) {
  return `INV-${id}`
}

function isLockAbortError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /lock broken by another request with the 'steal' option/i.test(message)
}

const DEBOUNCE_MS = 140
const MAX_RESULTS = 12
const SECTION_LIMIT = 3

export function GlobalDashboardSearch({
  accountType,
  displayRole,
  displayDepartment,
  currentUserAuthId,
  currentEmployeeId,
  currentClientId = null,
}: GlobalDashboardSearchProps) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const requestVersionRef = useRef(0)
  const searchCacheRef = useRef(new Map<string, SearchResult[]>())
  const gatewayRowsRef = useRef<Array<Record<string, unknown>> | null>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [error, setError] = useState<string | null>(null)

  const normalizedRole = normalizeRole(displayRole || '')
  const normalizedDepartment = (displayDepartment || '').trim().toLowerCase()
  const isSuperAdmin = normalizedRole === 'superadmin'
  const isAdmin = normalizedRole === 'admin'
  const isEmployeeUser = normalizedRole === 'user'
  const canSearchEmployees = accountType === 'employee'
  const canSearchClients = accountType === 'employee' && !normalizedDepartment.includes('finance')
  const canSearchGateways = accountType === 'employee' && (isAdmin || isSuperAdmin)

  const trimmedQuery = useMemo(() => query.trim(), [query])
  const normalizedQuery = useMemo(() => trimmedQuery.toLowerCase(), [trimmedQuery])

  const getCacheKey = useCallback(
    (value: string) =>
      [
        accountType ?? 'unknown',
        normalizedRole || 'none',
        normalizedDepartment || 'none',
        currentUserAuthId ?? 'anon',
        currentEmployeeId ?? 'none',
        currentClientId ?? 'none',
        value.toLowerCase(),
      ].join(':'),
    [accountType, currentClientId, currentEmployeeId, currentUserAuthId, normalizedDepartment, normalizedRole]
  )

  const getAuthToken = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      return session?.access_token?.trim() || ''
    } catch (error) {
      if (!isLockAbortError(error)) {
        logFetchError('global search auth token', error)
      }
      return ''
    }
  }, [])

  const getGatewayRows = useCallback(async () => {
    if (gatewayRowsRef.current) return gatewayRowsRef.current

    const token = await getAuthToken()
    if (!token) return []

    const response = await fetch('/api/settings/payment-gateways', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    if (!response.ok) return []

    const payload = (await response.json().catch(() => ({}))) as {
      gateways?: Array<Record<string, unknown>>
    }

    gatewayRowsRef.current = payload.gateways ?? []
    return gatewayRowsRef.current
  }, [getAuthToken])

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (containerRef.current?.contains(target)) return
      setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  useEffect(() => {
    if (trimmedQuery.length < 2) {
      setResults([])
      setLoading(false)
      setError(null)
      return
    }

    const cacheKey = getCacheKey(trimmedQuery)
    const cachedResults = searchCacheRef.current.get(cacheKey)
    if (cachedResults) {
      setResults(cachedResults)
      setLoading(false)
      setError(null)
      return
    }

    const timeoutId = window.setTimeout(() => {
      const runSearch = async () => {
        const requestVersion = ++requestVersionRef.current
        setLoading(true)
        setError(null)

        try {
          const escaped = trimmedQuery.replace(/[%*,()]/g, ' ').trim()
          if (!escaped) {
            setResults([])
            setLoading(false)
            return
          }

          const likeValue = `%${escaped}%`
          const numericQuery = Number.parseInt(trimmedQuery, 10)
          const isNumericQuery = Number.isFinite(numericQuery) && numericQuery > 0
          const shouldSearchPayments = normalizedQuery.length >= 3 || isNumericQuery
          const shouldSearchGateways = canSearchGateways && normalizedQuery.length >= 3
          const nextResults: SearchResult[] = []
          const tasks: Array<PromiseLike<void>> = []

          if (canSearchEmployees) {
            tasks.push(
              supabase
                .from('employees')
                .select('id, employee_name, email, role, department')
                .neq('isdeleted', true)
                .or(`employee_name.ilike.${likeValue},email.ilike.${likeValue},role.ilike.${likeValue},department.ilike.${likeValue}`)
                .limit(SECTION_LIMIT)
                .then(({ data, error: employeesError }) => {
                  if (employeesError) throw employeesError

                  ;((data as Array<Record<string, unknown>> | null) ?? []).forEach((row) => {
                    nextResults.push({
                      id: `employee-${row.id}`,
                      kind: 'employee',
                      title: String(row.employee_name ?? 'Employee'),
                      subtitle: String(row.email ?? ''),
                      context: `Employees - ${(String(row.role ?? 'User') || 'User').trim()}${String(row.department ?? '').trim() ? ` - ${String(row.department).trim()}` : ''}`,
                      href: withSearchParam('/dashboard/employees', String(row.employee_name ?? row.email ?? trimmedQuery)),
                    })
                  })
                })
            )
          }

          if (canSearchClients) {
            let clientsQuery = supabase
              .from('clients')
              .select('id, name, email, handler_id, status')
              .neq('isdeleted', true)
              .or(`name.ilike.${likeValue},email.ilike.${likeValue},status.ilike.${likeValue}`)
              .limit(SECTION_LIMIT)

            if (!isAdmin && !isSuperAdmin && currentUserAuthId) {
              clientsQuery = clientsQuery.eq('handler_id', currentUserAuthId)
            }

            tasks.push(
              clientsQuery.then(({ data, error: clientsError }) => {
                if (clientsError) throw clientsError

                ;((data as Array<Record<string, unknown>> | null) ?? []).forEach((row) => {
                  const clientId = Number(row.id ?? 0)
                  const name = String(row.name ?? 'Client')
                  const email = String(row.email ?? '')

                  nextResults.push({
                    id: `client-${clientId}`,
                    kind: 'client',
                    title: name,
                    subtitle: email,
                    context: `Clients - ${(String(row.status ?? 'approved') || 'approved').trim()}`,
                    href: withSearchParam('/dashboard/clients', name || email || trimmedQuery),
                  })
                  nextResults.push({
                    id: `chat-${clientId}`,
                    kind: 'chat',
                    title: name,
                    subtitle: email,
                    context: 'Chats - Conversation',
                    href: `/dashboard/chat?clientId=${clientId}`,
                  })
                })
              })
            )
          }

          let invoicesQuery = supabase
            .from('invoices')
            .select('id, client_id, client_name, email, brand_name, status, invoice_creator_id')
            .limit(SECTION_LIMIT)

          if (accountType === 'client' && currentClientId) {
            invoicesQuery = invoicesQuery.eq('client_id', currentClientId)
          } else if (accountType === 'employee' && isEmployeeUser && currentEmployeeId) {
            invoicesQuery = invoicesQuery.eq('invoice_creator_id', currentEmployeeId)
          }

          if (isNumericQuery) {
            invoicesQuery = invoicesQuery.or(`id.eq.${numericQuery},client_name.ilike.${likeValue},email.ilike.${likeValue},brand_name.ilike.${likeValue},status.ilike.${likeValue}`)
          } else {
            invoicesQuery = invoicesQuery.or(`client_name.ilike.${likeValue},email.ilike.${likeValue},brand_name.ilike.${likeValue},status.ilike.${likeValue}`)
          }

          tasks.push(
            invoicesQuery.then(({ data, error: invoicesError }) => {
              if (invoicesError) throw invoicesError

              ;((data as Array<Record<string, unknown>> | null) ?? []).forEach((row) => {
                const invoiceId = Number(row.id ?? 0)
                const label = formatInvoiceCode(invoiceId)

                nextResults.push({
                  id: `invoice-${invoiceId}`,
                  kind: 'invoice',
                  title: label,
                  subtitle: String(row.client_name ?? row.email ?? ''),
                  context: `Invoices - ${String(row.status ?? 'Pending')}`,
                  href: withSearchParam('/dashboard/invoices', label),
                })
              })
            })
          )

          if (shouldSearchPayments) {
            let paymentsQuery = supabase
              .from('payment_submissions')
              .select('id, invoice_id, full_name, email, payment_status')
              .limit(SECTION_LIMIT)

            if (isNumericQuery) {
              paymentsQuery = paymentsQuery.or(`invoice_id.eq.${numericQuery},full_name.ilike.${likeValue},email.ilike.${likeValue},payment_status.ilike.${likeValue}`)
            } else {
              paymentsQuery = paymentsQuery.or(`full_name.ilike.${likeValue},email.ilike.${likeValue},payment_status.ilike.${likeValue}`)
            }

            tasks.push(
              paymentsQuery.then(({ data, error: paymentsError }) => {
                if (paymentsError) throw paymentsError

                ;((data as Array<Record<string, unknown>> | null) ?? []).forEach((row) => {
                  const paymentId = Number(row.id ?? 0)
                  const invoiceId = row.invoice_id == null ? null : Number(row.invoice_id)
                  const label = invoiceId ? `Payment for ${formatInvoiceCode(invoiceId)}` : `Payment #${paymentId}`

                  nextResults.push({
                    id: `payment-${paymentId}`,
                    kind: 'payment',
                    title: label,
                    subtitle: String(row.full_name ?? row.email ?? ''),
                    context: `Payments - ${String(row.payment_status ?? 'Recorded')}`,
                    href: withSearchParam('/dashboard/payments', invoiceId ? formatInvoiceCode(invoiceId) : String(row.full_name ?? row.email ?? trimmedQuery)),
                  })
                })
              })
            )
          }

          if (accountType === 'employee') {
            tasks.push(
              supabase
                .from('brands')
                .select('id, brand_name, brand_url')
                .neq('isdeleted', true)
                .or(`brand_name.ilike.${likeValue},brand_url.ilike.${likeValue}`)
                .limit(SECTION_LIMIT)
                .then(({ data, error: brandsError }) => {
                  if (brandsError) throw brandsError

                  ;((data as Array<Record<string, unknown>> | null) ?? []).forEach((row) => {
                    nextResults.push({
                      id: `brand-${row.id}`,
                      kind: 'brand',
                      title: String(row.brand_name ?? 'Brand'),
                      subtitle: String(row.brand_url ?? ''),
                      context: 'Brand Identity - Brand',
                      href: withSearchParam('/dashboard/brands', String(row.brand_name ?? row.brand_url ?? trimmedQuery)),
                    })
                  })
                })
            )
          }

          if (shouldSearchGateways) {
            tasks.push(
              (async () => {
                const gatewayRows = await getGatewayRows()

                gatewayRows.forEach((row) => {
                  const haystack = [
                    String(row.name ?? ''),
                    String(row.status ?? ''),
                    String(row.minimum_deposit_amount ?? ''),
                    String(row.maximum_deposit_amount ?? ''),
                  ]
                    .join(' ')
                    .toLowerCase()

                  if (!haystack.includes(normalizedQuery)) return

                  nextResults.push({
                    id: `gateway-${row.id}`,
                    kind: 'gateway',
                    title: String(row.name ?? 'Gateway'),
                    subtitle: `${String(row.minimum_deposit_amount ?? '--')} to ${String(row.maximum_deposit_amount ?? '--')}`,
                    context: `Settings - ${String(row.status ?? 'Testing')}`,
                    href: withSearchParam('/dashboard/settings', String(row.name ?? trimmedQuery)),
                  })
                })
              })()
            )
          }

          await Promise.all(tasks)

          if (requestVersion !== requestVersionRef.current) return

          const deduped = Array.from(new Map(nextResults.map((item) => [item.id, item])).values()).slice(0, MAX_RESULTS)
          searchCacheRef.current.set(cacheKey, deduped)
          setResults(deduped)
          setLoading(false)
        } catch {
          if (requestVersion !== requestVersionRef.current) return
          setLoading(false)
          setResults([])
          setError('Search failed')
        }
      }

      void runSearch()
    }, DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [
    accountType,
    canSearchClients,
    canSearchEmployees,
    canSearchGateways,
    currentClientId,
    currentEmployeeId,
    currentUserAuthId,
    getCacheKey,
    getGatewayRows,
    isAdmin,
    isEmployeeUser,
    isSuperAdmin,
    normalizedQuery,
    trimmedQuery,
  ])

  function handleSelect(result: SearchResult) {
    setOpen(false)
    setQuery('')
    setResults([])
    router.push(result.href)
  }

  return (
    <div ref={containerRef} className="relative hidden max-w-xl min-w-0 flex-1 lg:block">
      <label className="flex h-11 w-full items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 px-4 text-slate-400 transition focus-within:border-orange-500/40 focus-within:text-slate-300">
        <SearchIcon className="h-4 w-4 shrink-0" />
        <input
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          placeholder="Search across records..."
          className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
        />
      </label>

      {open && trimmedQuery.length >= 2 ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.75rem)] z-40 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/96 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="border-b border-slate-800 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
            Global Search
          </div>
          {loading ? (
            <div className="px-4 py-6 text-sm text-slate-400">Searching records...</div>
          ) : error ? (
            <div className="px-4 py-6 text-sm text-rose-300">{error}</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-400">No matching records found.</div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto py-2">
              {results.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => handleSelect(result)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-800/80"
                >
                  <SearchResultIcon kind={result.kind} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{result.title}</p>
                    <p className="truncate text-xs text-slate-400">{result.subtitle}</p>
                    <p className="mt-1 text-[11px] font-medium text-orange-300">{result.context}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
