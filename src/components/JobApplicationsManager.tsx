'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDashboardProfile } from '@/components/DashboardLayout'
import { useSessionContext } from '@/context/SessionContext'

type ApplicationRow = {
  id: string
  job_slug: string
  job_title: string
  source: string
  worked_before: boolean
  first_name: string
  last_name: string
  email: string
  phone: string
  country: string
  city: string
  linkedin_url: string
  portfolio_url: string
  current_title: string
  years_experience: string
  cover_letter: string
  resume_file_name: string
  resume_file_size: number
  resume_drive_file_id: string
  resume_drive_url: string
  status?: string
  created_at: string
}

const inputClass =
  'w-full rounded-xl border border-slate-700 bg-[#0b1323] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-orange-500'

function normalizeRole(role: string) {
  return (role || '').trim().toLowerCase().replace(/\s+/g, '')
}

function fullName(application: ApplicationRow) {
  return `${application.first_name} ${application.last_name}`.trim()
}

function formatDate(value: string) {
  if (!value) return 'Not available'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'Unknown size'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function statusStyle(status: string) {
  switch (status.toLowerCase()) {
    case 'offered':
      return 'bg-emerald-500/10 text-emerald-300'
    case 'interviewing':
    case 'shortlisted':
      return 'bg-violet-500/10 text-violet-300'
    case 'reviewing':
      return 'bg-blue-500/10 text-blue-300'
    case 'rejected':
    case 'withdrawn':
      return 'bg-slate-500/10 text-slate-400'
    default:
      return 'bg-orange-500/10 text-orange-300'
  }
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#0b1323] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <div className="mt-2 break-words text-sm font-semibold leading-6 text-slate-200">
        {children || 'Not provided'}
      </div>
    </div>
  )
}

export default function JobApplicationsManager() {
  const { token } = useSessionContext()
  const { accountType, displayRole, profileLoaded } = useDashboardProfile()
  const [applications, setApplications] = useState<ApplicationRow[]>([])
  const [selected, setSelected] = useState<ApplicationRow | null>(null)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloadingResumeId, setDownloadingResumeId] = useState('')
  const [resumeDownloadError, setResumeDownloadError] = useState('')

  const role = normalizeRole(displayRole)
  const canView = accountType === 'employee' && (role === 'hr' || role === 'superadmin')
  const accessToken = token?.trim() || ''

  const loadApplications = useCallback(async () => {
    if (!accessToken || !canView) {
      setApplications([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    const response = await fetch('/api/job-applications', {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const result = (await response.json().catch(() => null)) as
      | { applications?: ApplicationRow[]; error?: string }
      | null

    if (!response.ok) setError(result?.error || 'Unable to load job applications.')
    setApplications(result?.applications ?? [])
    setLoading(false)
  }, [accessToken, canView])

  useEffect(() => {
    if (!profileLoaded) return
    const timer = window.setTimeout(() => void loadApplications(), 0)
    return () => window.clearTimeout(timer)
  }, [loadApplications, profileLoaded])

  useEffect(() => {
    if (!selected) return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [selected])

  const roles = useMemo(
    () => Array.from(new Set(applications.map((item) => item.job_title).filter(Boolean))).sort(),
    [applications],
  )

  const filteredApplications = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return applications.filter((application) => {
      const matchesSearch =
        !needle ||
        `${fullName(application)} ${application.email} ${application.phone} ${application.job_title} ${application.current_title} ${application.city} ${application.country}`
          .toLowerCase()
          .includes(needle)
      const matchesRole = roleFilter === 'all' || application.job_title === roleFilter
      const matchesStatus =
        statusFilter === 'all' || (application.status || 'new').toLowerCase() === statusFilter
      return matchesSearch && matchesRole && matchesStatus
    })
  }, [applications, query, roleFilter, statusFilter])

  const newCount = applications.filter((item) => (item.status || 'new').toLowerCase() === 'new').length

  async function downloadResume(application: ApplicationRow) {
    if (!accessToken || downloadingResumeId) return

    setDownloadingResumeId(application.id)
    setResumeDownloadError('')

    try {
      const response = await fetch(
        `/api/job-applications/${encodeURIComponent(application.id)}/resume`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      )

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(result?.error || 'Unable to download this resume.')
      }

      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = application.resume_file_name || 'resume'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    } catch (downloadError) {
      setResumeDownloadError(
        downloadError instanceof Error ? downloadError.message : 'Unable to download this resume.',
      )
    } finally {
      setDownloadingResumeId('')
    }
  }

  if (!profileLoaded || loading) {
    return <div className="flex min-h-[320px] items-center justify-center text-sm text-slate-400">Loading applications...</div>
  }

  if (!canView) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-10 text-center text-slate-400">
        Only HR and super admins can view job applications.
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-400">Careers</p>
          <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">Job Applications</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Review candidate information and open submitted resumes securely from Google Drive.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadApplications()}
          className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-black text-slate-200 transition hover:border-orange-500 hover:text-orange-400"
        >
          Refresh applications
        </button>
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Total applications', String(applications.length)],
          ['New candidates', String(newCount)],
          ['Roles represented', String(roles.length)],
          ['Latest submission', applications[0] ? formatDate(applications[0].created_at) : 'No submissions'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-800 bg-[#0f172a] p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
            <p className="mt-2 text-xl font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0f172a]">
        <div className="grid gap-3 border-b border-slate-800 p-4 lg:grid-cols-[1fr_240px_180px]">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search candidate, role, email, location..."
            className={inputClass}
          />
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className={inputClass}>
            <option value="all">All opportunities</option>
            {roles.map((jobTitle) => <option key={jobTitle} value={jobTitle}>{jobTitle}</option>)}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={inputClass}>
            <option value="all">All statuses</option>
            {['new', 'reviewing', 'shortlisted', 'interviewing', 'offered', 'rejected', 'withdrawn'].map((status) => (
              <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                {['Candidate', 'Opportunity', 'Contact', 'Experience', 'Submitted', 'Status', 'Action'].map((heading) => (
                  <th key={heading} className={`px-5 py-4 ${heading === 'Action' ? 'text-right' : ''}`}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredApplications.map((application) => {
                const applicationStatus = application.status || 'new'
                return (
                  <tr key={application.id} className="transition hover:bg-white/[0.025]">
                    <td className="px-5 py-4">
                      <p className="font-black text-white">{fullName(application)}</p>
                      <p className="mt-1 text-xs text-slate-500">{application.current_title || 'Title not provided'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="max-w-[240px] font-semibold text-slate-200">{application.job_title}</p>
                      <p className="mt-1 text-xs text-slate-500">{[application.city, application.country].filter(Boolean).join(', ')}</p>
                    </td>
                    <td className="px-5 py-4">
                      <a href={`mailto:${application.email}`} className="block text-sm text-slate-300 transition hover:text-orange-400">{application.email}</a>
                      <p className="mt-1 text-xs text-slate-500">{application.phone}</p>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-300">{application.years_experience}</td>
                    <td className="px-5 py-4 text-sm text-slate-400">{formatDate(application.created_at)}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.13em] ${statusStyle(applicationStatus)}`}>
                        {applicationStatus}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button type="button" onClick={() => setSelected(application)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-bold text-slate-200 transition hover:border-orange-500 hover:text-orange-400">
                        View
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filteredApplications.length === 0 && (
          <div className="py-16 text-center text-sm font-semibold text-slate-400">
            {applications.length ? 'No applications match these filters.' : 'No applications have been submitted yet.'}
          </div>
        )}
        <div className="border-t border-slate-800 px-5 py-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
          {filteredApplications.length} {filteredApplications.length === 1 ? 'application' : 'applications'}
        </div>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm sm:p-8"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelected(null)
          }}
        >
          <div className="my-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-700 bg-[#0f172a] shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-5 sm:px-7">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-400">Candidate application</p>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.13em] ${statusStyle(selected.status || 'new')}`}>
                    {selected.status || 'new'}
                  </span>
                </div>
                <h2 className="mt-2 text-2xl font-black text-white">{fullName(selected)}</h2>
                <p className="mt-1 text-sm text-slate-400">{selected.job_title}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-lg px-3 py-2 text-sm font-bold text-slate-400 transition hover:bg-slate-800 hover:text-white">
                Close
              </button>
            </div>

            <div className="space-y-6 p-5 sm:p-7">
              <div>
                <h3 className="mb-3 text-sm font-black text-white">Candidate details</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Detail label="Email"><a href={`mailto:${selected.email}`} className="hover:text-orange-400">{selected.email}</a></Detail>
                  <Detail label="Phone"><a href={`tel:${selected.phone}`} className="hover:text-orange-400">{selected.phone}</a></Detail>
                  <Detail label="Location">{[selected.city, selected.country].filter(Boolean).join(', ')}</Detail>
                  <Detail label="Current title">{selected.current_title || 'Not provided'}</Detail>
                  <Detail label="Relevant experience">{selected.years_experience}</Detail>
                  <Detail label="How they found us">{selected.source}</Detail>
                  <Detail label="Worked with BmyBrand before">{selected.worked_before ? 'Yes' : 'No'}</Detail>
                  <Detail label="Submitted">{formatDate(selected.created_at)}</Detail>
                  <Detail label="Application ID">{selected.id}</Detail>
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-black text-white">Links and resume</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Detail label="LinkedIn">
                    {selected.linkedin_url ? <a href={selected.linkedin_url} target="_blank" rel="noreferrer" className="text-orange-400 hover:text-orange-300">Open LinkedIn profile</a> : 'Not provided'}
                  </Detail>
                  <Detail label="Portfolio">
                    {selected.portfolio_url ? <a href={selected.portfolio_url} target="_blank" rel="noreferrer" className="text-orange-400 hover:text-orange-300">Open portfolio</a> : 'Not provided'}
                  </Detail>
                  <div className="sm:col-span-2">
                    <Detail label="Resume">
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                        <span>{selected.resume_file_name} - {formatFileSize(selected.resume_file_size)}</span>
                        {selected.resume_drive_file_id ? (
                          <button
                            type="button"
                            onClick={() => void downloadResume(selected)}
                            disabled={downloadingResumeId === selected.id}
                            className="rounded-lg bg-orange-500 px-4 py-2 text-center text-xs font-black text-white transition hover:bg-orange-400 disabled:cursor-wait disabled:opacity-60"
                          >
                            {downloadingResumeId === selected.id ? 'Downloading...' : 'Download resume'}
                          </button>
                        ) : <span className="text-xs text-amber-300">Drive link unavailable</span>}
                      </div>
                      {resumeDownloadError && (
                        <p className="mt-2 text-xs text-red-300">{resumeDownloadError}</p>
                      )}
                    </Detail>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-black text-white">Cover note</h3>
                <div className="min-h-28 whitespace-pre-wrap rounded-xl border border-slate-800 bg-[#0b1323] p-5 text-sm leading-7 text-slate-300">
                  {selected.cover_letter || 'No cover note was provided.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
