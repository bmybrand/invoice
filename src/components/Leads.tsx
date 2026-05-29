'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { useDashboardProfile } from '@/components/DashboardLayout'
import { useSessionContext } from '@/context/SessionContext'

const plusJakarta = Plus_Jakarta_Sans({ subsets: ['latin'] })
const PAGE_SIZE = 8
const CONTACT_SERVICE_GROUP = new Set([
  'Website Development',
  'Brand Identity & Design',
  'ecommerce',
  'Digital Marketing',
])
const CONTACT_TAB_LABEL = 'Contact'
const CUSTOM_QUOTE_TAB_LABEL = 'Custom Quote Request'
const NEWSLETTER_TAB_LABEL = 'Newsletter Subscription'

type LeadRow = {
  id: number
  created_at: string | null
  access_page: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  service: string | null
  message: string | null
  form_type: string | null
}

function SearchIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
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

function formatDateTime(value: string | null) {
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'N/A'

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function formatAccessPage(value: string | null) {
  const normalized = (value || '').trim()
  if (!normalized) return 'N/A'
  if (normalized === '/') return 'Home'

  const cleaned = normalized.replace(/^\/+/, '').split('/').filter(Boolean)
  if (cleaned.length === 0) return 'Home'

  return cleaned[cleaned.length - 1]
}

function getLeadTabLabel(lead: Pick<LeadRow, 'form_type' | 'service'>) {
  const formType = (lead.form_type || '').trim().toLowerCase()
  if (formType === 'newsletter_subscription') return NEWSLETTER_TAB_LABEL
  if (formType === 'custom_quote_request') return CUSTOM_QUOTE_TAB_LABEL
  if (formType === 'contact') return CONTACT_TAB_LABEL

  const service = (lead.service || '').trim()
  if (!service) return ''
  if (CONTACT_SERVICE_GROUP.has(service)) return CONTACT_TAB_LABEL
  if (service === NEWSLETTER_TAB_LABEL) return NEWSLETTER_TAB_LABEL
  if (service === CUSTOM_QUOTE_TAB_LABEL) return CUSTOM_QUOTE_TAB_LABEL
  return service
}

export default function Leads() {
  const { accountType, profileLoaded } = useDashboardProfile()
  const { token } = useSessionContext()

  const [leads, setLeads] = useState<LeadRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeService, setActiveService] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedLead, setSelectedLead] = useState<LeadRow | null>(null)

  const fetchLeads = useCallback(async () => {
    const accessToken = token?.trim() || ''
    if (!accessToken) {
      setLeads([])
      setLoading(false)
      setError('Authentication expired. Sign in again and try again.')
      return
    }

    setLoading(true)
    setError(null)

    const response = await fetch('/api/leads', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    const result = (await response.json().catch(() => null)) as
      | { error?: string; leads?: LeadRow[] }
      | null

    if (!response.ok) {
      setLeads([])
      setLoading(false)
      setError(result?.error || 'Failed to load leads')
      return
    }

    setLeads(Array.isArray(result?.leads) ? result!.leads! : [])
    setLoading(false)
  }, [token])

  useEffect(() => {
    if (!profileLoaded || accountType !== 'employee') return
    const timeoutId = window.setTimeout(() => {
      void fetchLeads()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [accountType, fetchLeads, profileLoaded])

  const serviceTabs = useMemo(() => {
    return Array.from(
      new Set(
        leads
          .map((lead) => getLeadTabLabel(lead))
          .filter(Boolean)
      )
    ).sort((left, right) => left.localeCompare(right))
  }, [leads])
  const effectiveActiveService =
    activeService && serviceTabs.includes(activeService) ? activeService : (serviceTabs[0] ?? '')
  const isNewsletterSubscription = effectiveActiveService === NEWSLETTER_TAB_LABEL
  const isContactTab = effectiveActiveService === CONTACT_TAB_LABEL

  const filteredLeads = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return leads.filter((lead) => {
      const service = getLeadTabLabel(lead)
      const matchesService = !effectiveActiveService || service === effectiveActiveService
      if (!matchesService) return false
      if (!query) return true

      return [
        lead.id,
        lead.access_page,
        lead.first_name,
        lead.last_name,
        lead.email,
        lead.phone,
        lead.form_type,
        lead.service,
        lead.message,
      ]
        .map((value) => String(value ?? '').toLowerCase())
        .some((value) => value.includes(query))
    })
  }, [effectiveActiveService, leads, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  const end = start + PAGE_SIZE
  const paginatedLeads = filteredLeads.slice(start, start + PAGE_SIZE)

  if (profileLoaded && accountType !== 'employee') {
    return (
      <section className={`${plusJakarta.className} p-4 sm:p-6 md:p-8`}>
        <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200">
          Only employees can access leads.
        </div>
      </section>
    )
  }

  return (
    <div className={`${plusJakarta.className} w-full flex flex-col text-white`}>
      <div className="w-full pb-6">
        <div className="w-full p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl sm:text-3xl font-black leading-tight text-white">Manage Leads</h1>
            <p className="text-slate-400 text-sm font-normal leading-5">
              Overview of lead submissions from the Supabase <code>leads</code> table
            </p>
          </div>
        </div>
      </div>

      <div className="w-full pb-6">
        <div className="w-full p-4 sm:p-6 bg-slate-800/80 rounded-xl border border-slate-700 flex flex-col lg:flex-row gap-4">
          <div className="flex-1 min-w-0">
            <div className="h-12 w-full bg-slate-900/50 rounded-xl border border-slate-700 flex items-center gap-3 pl-4 overflow-hidden">
              <SearchIcon className="h-4 w-4 text-slate-500 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value)
                  setCurrentPage(1)
                }}
                placeholder="Search by name, email, phone, service or page..."
                className="flex-1 min-w-0 h-full bg-transparent text-slate-300 text-sm placeholder:text-slate-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {serviceTabs.length > 0 ? (
        <div className="w-full pb-6">
          <div className="flex flex-wrap gap-2">
            {serviceTabs.map((service) => {
              const active = effectiveActiveService === service
              return (
                <button
                  key={service}
                  type="button"
                  onClick={() => {
                    setActiveService(service)
                    setCurrentPage(1)
                  }}
                  className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? 'border-orange-500 bg-orange-500 text-white shadow-[0px_4px_20px_0px_rgba(249,115,22,0.2)]'
                      : 'border-slate-700 bg-slate-800/80 text-slate-300 hover:border-slate-600 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {service}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="w-full bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden">
        <div className="w-full overflow-x-auto scrollbar-thin">
          <table className={`w-full table-fixed ${isNewsletterSubscription ? 'min-w-[760px]' : 'min-w-[1180px]'}`}>
            <thead>
              <tr className="bg-slate-900/50 border-b border-slate-700">
                <th className="w-[72px] px-4 sm:px-6 py-4 text-left">
                  <span className="block truncate whitespace-nowrap text-slate-400 text-xs font-bold uppercase tracking-wide">No.</span>
                </th>
                <th className="px-4 sm:px-6 py-4 text-left">
                  <span className="block truncate whitespace-nowrap text-slate-400 text-xs font-bold uppercase tracking-wide">Email</span>
                </th>
                <th className="px-4 sm:px-6 py-4 text-left">
                  <span className="block truncate whitespace-nowrap text-slate-400 text-xs font-bold uppercase tracking-wide">Lead</span>
                </th>
                {!isNewsletterSubscription ? (
                  <th className="px-4 sm:px-6 py-4 text-left">
                    <span className="block truncate whitespace-nowrap text-slate-400 text-xs font-bold uppercase tracking-wide">Phone</span>
                  </th>
                ) : null}
                {isContactTab ? (
                  <th className="px-4 sm:px-6 py-4 text-left">
                    <span className="block truncate whitespace-nowrap text-slate-400 text-xs font-bold uppercase tracking-wide">Service</span>
                  </th>
                ) : null}
                <th className="px-4 sm:px-6 py-4 text-left">
                  <span className="block truncate whitespace-nowrap text-slate-400 text-xs font-bold uppercase tracking-wide">Access Page</span>
                </th>
                <th className="px-4 sm:px-6 py-4 text-left">
                  <span className="block truncate whitespace-nowrap text-slate-400 text-xs font-bold uppercase tracking-wide">Created</span>
                </th>
                {!isNewsletterSubscription ? (
                  <th className="w-[180px] px-4 sm:px-6 py-4 text-left">
                    <span className="block truncate whitespace-nowrap text-slate-400 text-xs font-bold uppercase tracking-wide">Message</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isNewsletterSubscription ? 5 : isContactTab ? 8 : 7} className="border-t border-slate-700 px-4 sm:px-6 py-8 text-center text-slate-400 text-sm">
                    Loading leads...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={isNewsletterSubscription ? 5 : isContactTab ? 8 : 7} className="border-t border-slate-700 px-4 sm:px-6 py-8 text-center text-red-300 text-sm">
                    {error}
                  </td>
                </tr>
              ) : paginatedLeads.length === 0 ? (
                <tr>
                  <td colSpan={isNewsletterSubscription ? 5 : isContactTab ? 8 : 7} className="border-t border-slate-700 px-4 sm:px-6 py-8 text-center text-slate-400 text-sm">
                    {searchQuery.trim() ? 'No matching leads' : 'No leads found.'}
                  </td>
                </tr>
              ) : (
                paginatedLeads.map((lead, rowIndex) => (
                  <tr key={lead.id} className="border-t border-slate-700">
                    <td className="w-[72px] px-4 sm:px-6 py-4">
                      <span className="text-white text-sm font-bold font-mono block truncate whitespace-nowrap">
                        {start + rowIndex + 1}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 min-w-0">
                      <span className="text-slate-300 text-sm truncate block whitespace-nowrap" title={lead.email || '-'}>
                        {lead.email || '-'}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 min-w-0">
                      <div className="min-w-0">
                        <span
                          className="text-white text-sm font-bold truncate block whitespace-nowrap"
                          title={
                            [lead.first_name, lead.last_name].filter(Boolean).join(' ') ||
                            (isNewsletterSubscription ? 'Newsletter lead' : 'Unnamed lead')
                          }
                        >
                          {[lead.first_name, lead.last_name].filter(Boolean).join(' ') ||
                            (isNewsletterSubscription ? 'Newsletter lead' : 'Unnamed lead')}
                        </span>
                        <span className="text-slate-500 text-xs block truncate whitespace-nowrap" title={`Lead #${lead.id}`}>
                          Lead #{lead.id}
                        </span>
                      </div>
                    </td>
                    {!isNewsletterSubscription ? (
                      <td className="px-4 sm:px-6 py-4 min-w-0">
                        <span className="text-slate-300 text-sm truncate block whitespace-nowrap" title={lead.phone || '-'}>
                          {lead.phone || '-'}
                        </span>
                      </td>
                    ) : null}
                    {isContactTab ? (
                      <td className="px-4 sm:px-6 py-4 min-w-0">
                        <span className="text-slate-300 text-sm truncate block whitespace-nowrap" title={lead.service || '-'}>
                          {lead.service || '-'}
                        </span>
                      </td>
                    ) : null}
                    <td className="px-4 sm:px-6 py-4 min-w-0">
                      <span className="text-slate-300 text-sm truncate block whitespace-nowrap" title={formatAccessPage(lead.access_page)}>
                        {formatAccessPage(lead.access_page)}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 min-w-0">
                      <span className="text-slate-300 text-sm truncate block whitespace-nowrap" title={formatDateTime(lead.created_at)}>
                        {formatDateTime(lead.created_at)}
                      </span>
                    </td>
                    {!isNewsletterSubscription ? (
                      <td className="w-[180px] px-4 sm:px-6 py-4 min-w-0">
                        {lead.message?.trim() ? (
                          <button
                            type="button"
                            onClick={() => setSelectedLead(lead)}
                            className="block w-full max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-left text-slate-300 text-sm transition hover:text-white"
                            title={lead.message.trim()}
                          >
                            {lead.message.trim()}
                          </button>
                        ) : (
                          <span className="text-slate-500 text-sm block truncate whitespace-nowrap">No message</span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="w-full px-4 sm:px-6 py-4 bg-slate-900/50 border-t border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-slate-400 text-xs">
            {loading
              ? 'Loading...'
              : filteredLeads.length === 0
                ? searchQuery.trim() ? 'No matching leads' : 'No leads'
                : `Showing ${start + 1} to ${Math.min(end, filteredLeads.length)} of ${filteredLeads.length} leads`}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={safePage <= 1}
              className="w-8 h-8 rounded-lg border border-slate-700 flex justify-center items-center text-slate-400 hover:bg-slate-700/50 transition disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeftIcon />
            </button>
            {(() => {
              const pages: (number | 'ellipsis')[] =
                totalPages <= 4
                  ? Array.from({ length: totalPages }, (_, index) => index + 1)
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
                      safePage === page
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
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={safePage >= totalPages}
              className="w-8 h-8 rounded-lg border border-slate-700 flex justify-center items-center text-slate-400 hover:bg-slate-700/50 transition disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ChevronRightIcon />
            </button>
          </div>
        </div>
      </div>

      {selectedLead ? (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setSelectedLead(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
            <div className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold text-white">
                    {selectedLead.service === 'Newsletter Subscription'
                      ? (selectedLead.email || 'Newsletter subscriber')
                      : ([selectedLead.first_name, selectedLead.last_name].filter(Boolean).join(' ') || 'Unnamed lead')}
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {selectedLead.email || 'No email'}{selectedLead.service ? ` • ${selectedLead.service}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLead(null)}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-700 hover:text-white"
                  aria-label="Close message"
                >
                  <CloseIcon />
                </button>
              </div>

              <div className="grid gap-3 border-b border-slate-700 pb-4 text-sm text-slate-300 sm:grid-cols-2">
                <p><span className="text-slate-500">Created:</span> {formatDateTime(selectedLead.created_at)}</p>
                {selectedLead.service !== 'Newsletter Subscription' ? (
                  <p><span className="text-slate-500">Phone:</span> {selectedLead.phone || 'N/A'}</p>
                ) : null}
                <p className="sm:col-span-2"><span className="text-slate-500">Access Page:</span> {formatAccessPage(selectedLead.access_page)}</p>
              </div>

              {selectedLead.service !== 'Newsletter Subscription' ? (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Full Message</p>
                  <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-200">
                      {selectedLead.message?.trim() || 'No message'}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
