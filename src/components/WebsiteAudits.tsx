'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { useDashboardProfile } from '@/components/DashboardLayout'
import { useSessionContext } from '@/context/SessionContext'
import type { AuditReportListRow } from '@/types/audit-report'

const plusJakarta = Plus_Jakarta_Sans({ subsets: ['latin'] })
const PAGE_SIZE = 10

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

function DownloadIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M7.5 10.5L12 15m0 0l4.5-4.5M12 15V3" />
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

function getHostname(siteUrl: string) {
  try {
    return new URL(siteUrl).hostname.replace(/^www\./, '')
  } catch {
    return siteUrl
  }
}

function formatLabel(value: string | null) {
  if (!value) return '—'
  return value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export default function WebsiteAudits() {
  const { accountType, profileLoaded } = useDashboardProfile()
  const { token } = useSessionContext()

  const [audits, setAudits] = useState<AuditReportListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const fetchAudits = useCallback(async () => {
    const accessToken = token?.trim() || ''
    if (!accessToken) {
      setAudits([])
      setLoading(false)
      setError('Authentication expired. Sign in again and try again.')
      return
    }

    setLoading(true)
    setError(null)

    const response = await fetch('/api/audit-reports', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    const result = (await response.json().catch(() => null)) as
      | { error?: string; audits?: AuditReportListRow[] }
      | null

    if (!response.ok) {
      setAudits([])
      setLoading(false)
      setError(result?.error || 'Failed to load website audits')
      return
    }

    setAudits(Array.isArray(result?.audits) ? result!.audits! : [])
    setLoading(false)
  }, [token])

  useEffect(() => {
    if (!profileLoaded || accountType !== 'employee') return
    const timeoutId = window.setTimeout(() => {
      void fetchAudits()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [accountType, fetchAudits, profileLoaded])

  const filteredAudits = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return audits

    return audits.filter((audit) =>
      [
        audit.id,
        audit.site_url,
        audit.lead_name,
        audit.lead_email,
        audit.lead_company,
        audit.industry,
        audit.website_goal,
        audit.summary,
      ]
        .map((value) => String(value ?? '').toLowerCase())
        .some((value) => value.includes(query)),
    )
  }, [audits, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filteredAudits.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const start = (safePage - 1) * PAGE_SIZE
  const paginatedAudits = filteredAudits.slice(start, start + PAGE_SIZE)

  const handleDownloadPdf = useCallback(
    async (audit: AuditReportListRow) => {
      const accessToken = token?.trim() || ''
      if (!accessToken || downloadingId) return

      if (!audit.unlocked) {
        setError('Unlock the audit report before downloading the PDF.')
        return
      }

      if (!audit.lead_company?.trim()) {
        setError('Company name is required before downloading the PDF.')
        return
      }

      setDownloadingId(audit.id)
      setError(null)

      try {
        const response = await fetch(`/api/audit-reports/${audit.id}/pdf`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })

        if (!response.ok) {
          const result = (await response.json().catch(() => null)) as { error?: string } | null
          throw new Error(result?.error || 'Failed to download audit PDF')
        }

        const blob = await response.blob()
        const disposition = response.headers.get('content-disposition') || ''
        const filenameMatch = disposition.match(/filename="([^"]+)"/i)
        const filename = filenameMatch?.[1] || `audit-${audit.id.slice(0, 8)}.pdf`
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        link.click()
        URL.revokeObjectURL(url)

        if (!audit.drive_file_id) {
          void fetchAudits()
        }
      } catch (downloadError) {
        setError(
          downloadError instanceof Error
            ? downloadError.message
            : 'Failed to download PDF',
        )
      } finally {
        setDownloadingId(null)
      }
    },
    [downloadingId, fetchAudits, token],
  )

  if (!profileLoaded) {
    return null
  }

  if (accountType !== 'employee') {
    return (
      <div className={`${plusJakarta.className} p-6 text-slate-300`}>
        Website audits are available to employee accounts only.
      </div>
    )
  }

  return (
    <div className={`${plusJakarta.className} w-full`}>
      <div className="w-full pb-6">
        <div className="w-full p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl sm:text-3xl font-black leading-tight text-white">Website Audits</h1>
            <p className="text-slate-400 text-sm font-normal leading-5">
              AI-generated Brandsight audit reports with PDF export
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
                placeholder="Search by site, lead, email, industry..."
                className="flex-1 min-w-0 h-full bg-transparent text-slate-300 text-sm placeholder:text-slate-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="w-full bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden">
        <div className="w-full overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[1100px] table-fixed">
            <thead>
              <tr className="bg-slate-900/50 border-b border-slate-700">
                <th className="w-[56px] px-4 py-4 text-left text-slate-400 text-xs font-bold uppercase">No.</th>
                <th className="px-4 py-4 text-left text-slate-400 text-xs font-bold uppercase">Website</th>
                <th className="px-4 py-4 text-left text-slate-400 text-xs font-bold uppercase">Lead</th>
                <th className="w-[90px] px-4 py-4 text-left text-slate-400 text-xs font-bold uppercase">Score</th>
                <th className="w-[80px] px-4 py-4 text-left text-slate-400 text-xs font-bold uppercase">Issues</th>
                <th className="px-4 py-4 text-left text-slate-400 text-xs font-bold uppercase">Industry</th>
                <th className="w-[100px] px-4 py-4 text-left text-slate-400 text-xs font-bold uppercase">Status</th>
                <th className="px-4 py-4 text-left text-slate-400 text-xs font-bold uppercase">Created</th>
                <th className="w-[120px] px-4 py-4 text-right text-slate-400 text-xs font-bold uppercase">PDF</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="border-t border-slate-700 px-4 py-8 text-center text-slate-400 text-sm">
                    Loading audits...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={9} className="border-t border-slate-700 px-4 py-8 text-center text-red-300 text-sm">
                    {error}
                  </td>
                </tr>
              ) : paginatedAudits.length === 0 ? (
                <tr>
                  <td colSpan={9} className="border-t border-slate-700 px-4 py-8 text-center text-slate-400 text-sm">
                    {searchQuery.trim() ? 'No matching audits' : 'No website audits found yet.'}
                  </td>
                </tr>
              ) : (
                paginatedAudits.map((audit, rowIndex) => (
                  <tr key={audit.id} className="border-t border-slate-700 hover:bg-slate-800/60">
                    <td className="px-4 py-4 text-white text-sm font-mono">{start + rowIndex + 1}</td>
                    <td className="px-4 py-4 min-w-0">
                      <div className="min-w-0">
                        <a
                          href={audit.site_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-white text-sm font-semibold truncate block hover:text-orange-400"
                          title={audit.site_url}
                        >
                          {getHostname(audit.site_url)}
                        </a>
                        <span className="text-slate-500 text-xs truncate block" title={audit.site_url}>
                          {audit.site_url}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 min-w-0">
                      <span className="text-white text-sm font-semibold truncate block">
                        {audit.lead_name || '—'}
                      </span>
                      <span className="text-slate-400 text-xs truncate block">{audit.lead_company || '—'}</span>
                      <span className="text-slate-500 text-xs truncate block">{audit.lead_email || '—'}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-orange-400 text-sm font-bold">{audit.overall_score}/100</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-slate-300 text-sm">{audit.issue_count}+</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-slate-300 text-sm truncate block">{formatLabel(audit.industry)}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          audit.unlocked
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {audit.unlocked ? 'Unlocked' : 'Preview'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-slate-300 text-sm">{formatDateTime(audit.created_at)}</span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => void handleDownloadPdf(audit)}
                        disabled={downloadingId === audit.id || !audit.unlocked || !audit.lead_company}
                        title={
                          !audit.unlocked
                            ? 'Available after the lead unlocks the report'
                            : !audit.lead_company
                              ? 'Company name required'
                              : audit.drive_file_id
                                ? 'Download archived PDF from Google Drive'
                                : 'Generate and archive PDF to Google Drive'
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-orange-500/40 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-300 transition hover:bg-orange-500/20 disabled:opacity-50"
                      >
                        <DownloadIcon className="h-3.5 w-3.5" />
                        {downloadingId === audit.id ? 'Preparing...' : audit.drive_file_id ? 'Download' : 'Generate PDF'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {filteredAudits.length > PAGE_SIZE ? (
        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-slate-400 text-sm">
            Showing {start + 1}-{Math.min(start + PAGE_SIZE, filteredAudits.length)} of {filteredAudits.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 disabled:opacity-40"
            >
              <ChevronLeftIcon />
            </button>
            <span className="text-slate-300 text-sm px-2">
              Page {safePage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 disabled:opacity-40"
            >
              <ChevronRightIcon />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
