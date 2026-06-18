'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDashboardProfile } from '@/components/DashboardLayout'
import { canViewBriefFormSubmissions } from '@/lib/brief-form-submissions-access'
import { getBriefFormLabel } from '@/lib/brief-form-labels'
import type { BriefFormPayloadValue } from '@/lib/brief-form-submission-format'
import {
  formatBriefFormPayloadValue,
  formatBriefFormSubmittedAt,
} from '@/lib/brief-form-submission-format'
import { downloadBriefFormSubmissionPdf } from '@/lib/brief-form-pdf'
import type { BriefFormSubmissionRow } from '@/lib/cpanel-brief-forms-bridge'
import { useSessionContext } from '@/context/SessionContext'

export default function BriefFormSubmissionDetail() {
  const params = useParams()
  const submissionId = Number(params.id)
  const { token } = useSessionContext()
  const { accountType, displayRole, displayDepartment, profileLoaded } = useDashboardProfile()
  const [submission, setSubmission] = useState<BriefFormSubmissionRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  const canView = canViewBriefFormSubmissions({
    accountType,
    role: displayRole,
    department: displayDepartment,
  })

  const entries = useMemo(() => {
    if (!submission?.payload) {
      return []
    }
    return Object.entries(submission.payload).sort(([a], [b]) => a.localeCompare(b))
  }, [submission?.payload])

  const findInList = useCallback(
    async (authToken: string): Promise<BriefFormSubmissionRow | null> => {
      const listRes = await fetch('/api/brief-forms?limit=200', {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      const listData = (await listRes.json().catch(() => null)) as
        | { submissions?: BriefFormSubmissionRow[]; error?: string }
        | null

      if (!listRes.ok) {
        return null
      }

      return listData?.submissions?.find((row) => Number(row.id) === submissionId) ?? null
    },
    [submissionId]
  )

  const loadSubmission = useCallback(async () => {
    if (!Number.isFinite(submissionId) || submissionId <= 0) {
      setLoading(false)
      setError('Invalid submission link.')
      return
    }

    if (!profileLoaded) {
      return
    }

    if (!token || !canView) {
      setLoading(false)
      setSubmission(null)
      setError('')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/brief-forms?id=${submissionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = (await response.json().catch(() => null)) as
        | { submission?: BriefFormSubmissionRow; error?: string; hint?: string | null }
        | null

      if (response.ok && data?.submission) {
        setSubmission(data.submission)
        return
      }

      const fromList = await findInList(token)
      if (fromList) {
        setSubmission(fromList)
        return
      }

      setSubmission(null)
      const parts = [data?.error || 'Submission not found.']
      if (data?.hint) {
        parts.push(data.hint)
      }
      setError(parts.join(' '))
    } catch {
      setSubmission(null)
      setError('Could not load submission.')
    } finally {
      setLoading(false)
    }
  }, [canView, findInList, profileLoaded, submissionId, token])

  useEffect(() => {
    void loadSubmission()
  }, [loadSubmission])

  const handleDownloadPdf = async () => {
    if (!submission) {
      return
    }
    setDownloadingPdf(true)
    try {
      await downloadBriefFormSubmissionPdf(submission)
    } catch {
      window.alert('Could not generate PDF. Please try again.')
    } finally {
      setDownloadingPdf(false)
    }
  }

  if (!profileLoaded || loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center text-sm text-slate-400">
        Loading submission...
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

  if (error || !submission) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-[#0f172a]/95 px-6 py-10">
        <Link
          href="/dashboard/brief-forms/submissions"
          className="text-sm font-semibold text-slate-400 transition hover:text-orange-300"
        >
          ← Back to submissions
        </Link>
        <p className="mt-6 text-sm text-red-200">{error || 'Submission not found.'}</p>
      </section>
    )
  }

  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-slate-800 bg-[#0f172a]/95">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.12),transparent_34%)]" />

      <div className="relative border-b border-slate-800/90 px-6 py-8 sm:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <Link
              href="/dashboard/brief-forms/submissions"
              className="text-sm font-semibold text-slate-400 transition hover:text-orange-300"
            >
              ← Back to submissions
            </Link>
            <p className="mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-orange-300">
              Submission #{submission.id}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">
              {getBriefFormLabel(submission.formType)}
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Submitted {formatBriefFormSubmittedAt(submission.createdAt)}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleDownloadPdf()}
              disabled={downloadingPdf}
              className="rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-2.5 text-sm font-semibold text-orange-300 transition hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {downloadingPdf ? 'Preparing PDF…' : 'Download PDF'}
            </button>
          </div>
        </div>
      </div>

      <div className="relative space-y-8 px-6 py-8 sm:px-8 sm:py-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Email</p>
            <p className="mt-2 text-sm text-white">{submission.submitterEmail || '—'}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Source</p>
            <p className="mt-2 text-sm capitalize text-white">{submission.source || 'public'}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-4 sm:col-span-2 lg:col-span-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Form type</p>
            <p className="mt-2 text-sm text-white">{getBriefFormLabel(submission.formType)}</p>
          </div>
        </div>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Responses</p>
          <p className="mt-2 text-sm text-slate-400">
            Full brief answers below. PDF export omits client contact fields.
          </p>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {entries.length === 0 ? (
              <p className="text-sm text-slate-400 lg:col-span-2">No field data recorded.</p>
            ) : (
              entries.map(([key, value]) => (
                <div
                  key={key}
                  className="rounded-2xl border border-slate-800/90 bg-slate-950/50 px-5 py-4"
                >
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {key.replace(/_/g, ' ')}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-200">
                    {formatBriefFormPayloadValue(value as BriefFormPayloadValue)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
