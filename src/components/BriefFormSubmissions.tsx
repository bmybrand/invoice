'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDashboardProfile } from '@/components/DashboardLayout'
import { canViewBriefFormSubmissions } from '@/lib/brief-form-submissions-access'
import { getBriefFormLabel } from '@/lib/brief-form-labels'
import { BRIEF_FORM_TYPES, type BriefFormType } from '@/lib/brief-form-types'
import type { BriefFormSubmissionRow } from '@/lib/cpanel-brief-forms-bridge'
import { downloadBriefFormSubmissionPdf } from '@/lib/brief-form-pdf'
import { useSessionContext } from '@/context/SessionContext'

type PayloadValue = string | string[]

function formatPayloadValue(value: PayloadValue): string {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(', ') || '—'
  }
  return value.trim() || '—'
}

function formatSubmittedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function SubmissionDetailModal({
  row,
  onClose,
}: {
  row: BriefFormSubmissionRow
  onClose: () => void
}) {
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  const entries = useMemo(() => {
    const payload = row.payload || {}
    return Object.entries(payload).sort(([a], [b]) => a.localeCompare(b))
  }, [row.payload])

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true)
    try {
      await downloadBriefFormSubmissionPdf(row)
    } catch {
      window.alert('Could not generate PDF. Please try again.')
    } finally {
      setDownloadingPdf(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="brief-submission-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(90vh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#111827] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-800 px-6 py-5">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-300">
              Submission #{row.id}
            </p>
            <h2 id="brief-submission-title" className="mt-1 text-xl font-bold text-white">
              {getBriefFormLabel(row.formType)}
            </h2>
            <p className="mt-1 text-sm text-slate-400">{formatSubmittedAt(row.createdAt)}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => void handleDownloadPdf()}
              disabled={downloadingPdf}
              className="rounded-xl border border-orange-500/40 bg-orange-500/10 px-3 py-1.5 text-sm font-semibold text-orange-300 transition hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {downloadingPdf ? 'Preparing PDF…' : 'Download PDF'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-700 px-3 py-1.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Email</p>
              <p className="mt-1 text-sm text-white">{row.submitterEmail || '—'}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Source</p>
              <p className="mt-1 text-sm capitalize text-white">{row.source || 'public'}</p>
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Responses</p>
            <div className="space-y-2">
              {entries.length === 0 ? (
                <p className="text-sm text-slate-400">No field data recorded.</p>
              ) : (
                entries.map(([key, value]) => (
                  <div
                    key={key}
                    className="rounded-xl border border-slate-800/90 bg-slate-950/50 px-4 py-3"
                  >
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {key.replace(/_/g, ' ')}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-200">
                      {formatPayloadValue(value as PayloadValue)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function BriefFormSubmissions() {
  const { token } = useSessionContext()
  const { accountType, displayRole, displayDepartment, profileLoaded } = useDashboardProfile()
  const [formFilter, setFormFilter] = useState<'' | BriefFormType>('')
  const [submissions, setSubmissions] = useState<BriefFormSubmissionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<BriefFormSubmissionRow | null>(null)

  const canView = canViewBriefFormSubmissions({
    accountType,
    role: displayRole,
    department: displayDepartment,
  })

  const loadSubmissions = useCallback(async () => {
    if (!token || !canView) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    const params = new URLSearchParams({ limit: '100' })
    if (formFilter) {
      params.set('formType', formFilter)
    }

    try {
      const response = await fetch(`/api/brief-forms?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = (await response.json().catch(() => null)) as
        | { submissions?: BriefFormSubmissionRow[]; error?: string; hint?: string | null }
        | null

      if (!response.ok) {
        setSubmissions([])
        const parts = [data?.error || 'Could not load submissions.']
        if (data?.hint) {
          parts.push(data.hint)
        }
        setError(parts.join(' '))
        return
      }

      setSubmissions(data?.submissions ?? [])
    } catch {
      setSubmissions([])
      setError('Could not load submissions.')
    } finally {
      setLoading(false)
    }
  }, [canView, formFilter, token])

  useEffect(() => {
    if (!profileLoaded) {
      return
    }
    void loadSubmissions()
  }, [loadSubmissions, profileLoaded])

  if (!profileLoaded) {
    return (
      <div className="flex min-h-[240px] items-center justify-center text-sm text-slate-400">
        Loading submissions...
      </div>
    )
  }

  if (!canView) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-[#0f172a]/95 px-6 py-10 text-center">
        <p className="text-sm text-slate-400">You do not have permission to view brief form submissions.</p>
        <Link
          href="/dashboard/brief-forms"
          className="mt-4 inline-flex text-sm font-semibold text-orange-400 hover:text-orange-300"
        >
          Back to Brief Forms
        </Link>
      </section>
    )
  }

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-slate-800 bg-[#0f172a]/95">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.12),transparent_34%)]" />

      <div className="relative border-b border-slate-800/90 px-6 py-8 sm:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href="/dashboard/brief-forms"
              className="text-sm font-semibold text-slate-400 transition hover:text-orange-300"
            >
              ← Back to Brief Forms
            </Link>
            <h1 className="mt-4 text-3xl font-black tracking-[-0.04em] text-white">Brief Form Submissions</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
              Client responses from public links and dashboard brief forms. Visible to admin and sales staff only.
              PDF downloads omit client contact details (name, email, phone).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500" htmlFor="brief-form-filter">
              Form
            </label>
            <select
              id="brief-form-filter"
              value={formFilter}
              onChange={(event) => setFormFilter(event.target.value as '' | BriefFormType)}
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-orange-500/60"
            >
              <option value="">All forms</option>
              {BRIEF_FORM_TYPES.map((type) => (
                <option key={type} value={type}>
                  {getBriefFormLabel(type)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadSubmissions()}
              disabled={loading}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 disabled:opacity-60"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="relative px-6 py-6 sm:px-8 sm:py-8">
        {error ? (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-slate-400">Loading submissions...</p>
        ) : submissions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-12 text-center">
            <p className="text-sm text-slate-400">No submissions yet for this filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-800">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-800 bg-slate-900/80 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3">Form</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {submissions.map((row) => (
                  <tr key={row.id} className="bg-slate-950/20 hover:bg-slate-900/50">
                    <td className="px-4 py-3 text-slate-300">{formatSubmittedAt(row.createdAt)}</td>
                    <td className="px-4 py-3 font-semibold text-white">{getBriefFormLabel(row.formType)}</td>
                    <td className="px-4 py-3 text-slate-300">{row.submitterEmail || '—'}</td>
                    <td className="px-4 py-3 capitalize text-slate-400">{row.source || 'public'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelected(row)}
                        className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-orange-300 transition hover:bg-orange-500/20"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected ? <SubmissionDetailModal row={selected} onClose={() => setSelected(null)} /> : null}
    </section>
  )
}
