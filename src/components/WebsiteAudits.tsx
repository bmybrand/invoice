'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { useDashboardProfile } from '@/components/DashboardLayout'
import { useSessionContext } from '@/context/SessionContext'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
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

function ArchiveIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
    </svg>
  )
}

function TrashIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673A2.25 2.25 0 0115.916 21H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
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
  const { accountType, displayRole, profileLoaded } = useDashboardProfile()
  const { token } = useSessionContext()

  const [audits, setAudits] = useState<AuditReportListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [archivingAudit, setArchivingAudit] = useState<AuditReportListRow | null>(null)
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [showArchivedModal, setShowArchivedModal] = useState(false)
  const [archivedAudits, setArchivedAudits] = useState<AuditReportListRow[]>([])
  const [archivedLoading, setArchivedLoading] = useState(false)
  const [archivedError, setArchivedError] = useState<string | null>(null)
  const [archivedActionId, setArchivedActionId] = useState<string | null>(null)

  const normalizedRole = (displayRole || '').trim().toLowerCase().replace(/\s+/g, '')
  const isSuperAdmin = normalizedRole === 'superadmin'

  useBodyScrollLock(Boolean(archivingAudit || showArchivedModal))

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

  const fetchArchivedAudits = useCallback(async () => {
    const accessToken = token?.trim() || ''
    if (!accessToken) {
      setArchivedAudits([])
      setArchivedLoading(false)
      setArchivedError('Authentication expired. Sign in again and try again.')
      return
    }

    setArchivedLoading(true)
    setArchivedError(null)

    const response = await fetch('/api/audit-reports?archived=true', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    const result = (await response.json().catch(() => null)) as
      | { error?: string; audits?: AuditReportListRow[] }
      | null

    setArchivedLoading(false)

    if (!response.ok) {
      setArchivedAudits([])
      setArchivedError(result?.error || 'Failed to load archived website audits')
      return
    }

    setArchivedAudits(Array.isArray(result?.audits) ? result!.audits! : [])
  }, [token])

  useEffect(() => {
    if (!profileLoaded || accountType !== 'employee') return
    const timeoutId = window.setTimeout(() => {
      void fetchAudits()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [accountType, fetchAudits, profileLoaded])

  useEffect(() => {
    if (!showArchivedModal || !isSuperAdmin) return
    const timeoutId = window.setTimeout(() => {
      void fetchArchivedAudits()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [fetchArchivedAudits, isSuperAdmin, showArchivedModal])

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
  const columnCount = isSuperAdmin ? 10 : 9

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

  const handleArchiveConfirm = useCallback(async () => {
    if (!archivingAudit || !isSuperAdmin) return

    const accessToken = token?.trim() || ''
    if (!accessToken) {
      setActionMessage({ type: 'error', text: 'Authentication expired. Sign in again and try again.' })
      return
    }

    setArchiveLoading(true)
    const response = await fetch(`/api/audit-reports/${archivingAudit.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const result = (await response.json().catch(() => null)) as { error?: string } | null
    setArchiveLoading(false)

    if (!response.ok) {
      setActionMessage({ type: 'error', text: result?.error || 'Failed to archive audit report' })
      return
    }

    setActionMessage({
      type: 'success',
      text: `Audit for ${getHostname(archivingAudit.site_url)} archived successfully.`,
    })
    setArchivingAudit(null)
    await fetchAudits()
    if (showArchivedModal) {
      await fetchArchivedAudits()
    }
  }, [archivingAudit, fetchArchivedAudits, fetchAudits, isSuperAdmin, showArchivedModal, token])

  const handleArchivedAuditAction = useCallback(
    async (audit: AuditReportListRow, action: 'purge' | 'restore') => {
      if (archivedActionId) return

      const accessToken = token?.trim() || ''
      if (!accessToken) {
        setArchivedError('Authentication expired. Sign in again and try again.')
        return
      }

      setArchivedActionId(audit.id)
      setArchivedError(null)

      const response = await fetch(`/api/audit-reports/${audit.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ action }),
      })

      const result = (await response.json().catch(() => null)) as { error?: string } | null
      setArchivedActionId(null)

      if (!response.ok) {
        const message =
          result?.error ||
          (action === 'restore'
            ? 'Failed to restore archived audit report'
            : 'Failed to permanently delete archived audit report')
        setArchivedError(message)
        setActionMessage({ type: 'error', text: message })
        return
      }

      setActionMessage({
        type: 'success',
        text:
          action === 'restore'
            ? `Audit for ${getHostname(audit.site_url)} was restored.`
            : `Audit for ${getHostname(audit.site_url)} was permanently deleted.`,
      })

      await fetchAudits()
      await fetchArchivedAudits()
    },
    [archivedActionId, fetchArchivedAudits, fetchAudits, token],
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
          {isSuperAdmin ? (
            <button
              type="button"
              onClick={() => setShowArchivedModal(true)}
              className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/80 text-slate-300 transition hover:bg-slate-700/80 hover:text-white"
              aria-label="View archived website audits"
              title="View archived website audits"
            >
              <ArchiveIcon className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {actionMessage ? (
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
      ) : null}

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
          <table className="w-full min-w-[1180px] table-fixed">
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
                <th className="w-[140px] px-4 py-4 text-right text-slate-400 text-xs font-bold uppercase">PDF</th>
                {isSuperAdmin ? (
                  <th className="w-[72px] px-4 py-4 text-right text-slate-400 text-xs font-bold uppercase">Action</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columnCount} className="border-t border-slate-700 px-4 py-8 text-center text-slate-400 text-sm">
                    Loading audits...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={columnCount} className="border-t border-slate-700 px-4 py-8 text-center text-red-300 text-sm">
                    {error}
                  </td>
                </tr>
              ) : paginatedAudits.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className="border-t border-slate-700 px-4 py-8 text-center text-slate-400 text-sm">
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
                    {isSuperAdmin ? (
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setArchivingAudit(audit)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-500/25 bg-red-500/10 text-red-300 transition hover:border-red-400/60 hover:bg-red-500/20 hover:text-red-100"
                          aria-label={`Archive audit for ${getHostname(audit.site_url)}`}
                          title="Archive audit"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </td>
                    ) : null}
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

      {archivingAudit ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4">
          <div className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
            <button
              type="button"
              onClick={() => !archiveLoading && setArchivingAudit(null)}
              disabled={archiveLoading}
              aria-label="Close modal"
              className="absolute right-4 top-4 rounded-full border border-orange-500/30 bg-orange-500/10 p-2 text-orange-400 transition hover:bg-orange-500/20 hover:text-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CloseIcon />
            </button>
            <h2 className="text-lg font-bold text-white">Archive Website Audit</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Archive the audit for{' '}
              <span className="font-semibold text-white">{getHostname(archivingAudit.site_url)}</span>? It will be
              hidden from this list but can be restored or permanently deleted from the archive.
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => void handleArchiveConfirm()}
                disabled={archiveLoading}
                className="w-full rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50 sm:w-auto sm:min-w-[140px]"
              >
                {archiveLoading ? 'Archiving...' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showArchivedModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4">
          <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-white">Archived Website Audits</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Restore archived audits or permanently delete them. Permanent delete also removes the Google Drive PDF when present.
                </p>
              </div>
              <button
                type="button"
                onClick={() => archivedActionId === null && setShowArchivedModal(false)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-700 hover:text-white"
                aria-label="Close archived website audits"
              >
                <CloseIcon />
              </button>
            </div>

            {archivedError ? (
              <div className="px-6 pt-4">
                <p className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {archivedError}
                </p>
              </div>
            ) : null}

            <div className="overflow-x-auto px-6 py-4">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="border-b border-slate-700 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-3">Website</th>
                    <th className="px-3 py-3">Lead</th>
                    <th className="px-3 py-3">Archived</th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {archivedLoading ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-400">
                        Loading archived audits...
                      </td>
                    </tr>
                  ) : archivedAudits.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-sm text-slate-400">
                        No archived website audits found.
                      </td>
                    </tr>
                  ) : (
                    archivedAudits.map((audit) => (
                      <tr key={audit.id} className="border-t border-slate-700">
                        <td className="px-3 py-4">
                          <div className="text-sm font-semibold text-white">{getHostname(audit.site_url)}</div>
                          <div className="text-xs text-slate-500">{audit.site_url}</div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="text-sm text-white">{audit.lead_name || '—'}</div>
                          <div className="text-xs text-slate-400">{audit.lead_company || '—'}</div>
                        </td>
                        <td className="px-3 py-4 text-sm text-slate-300">
                          {formatDateTime(audit.archived_at || audit.created_at)}
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => void handleArchivedAuditAction(audit, 'restore')}
                              disabled={archivedActionId !== null}
                              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
                            >
                              Restore
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleArchivedAuditAction(audit, 'purge')}
                              disabled={archivedActionId !== null}
                              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                            >
                              Delete Forever
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
