'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDashboardProfile } from '@/components/DashboardLayout'
import { useSessionContext } from '@/context/SessionContext'

type JobRow = {
  slug: string
  title: string
  summary: string
  description: string
  responsibilities: string[]
  requirements: string[]
  benefits: string[]
  apply_url: string
  department: 'Design' | 'Technology' | 'Growth' | 'Operations'
  location: string
  workplace: 'Remote' | 'Hybrid' | 'On-site'
  employment_type: 'Full-time' | 'Part-time' | 'Contract' | 'Internship'
  sort_order: number
  is_published: boolean
  created_at?: string
  updated_at?: string
}

type JobEditorState = {
  originalSlug: string
  slug: string
  title: string
  summary: string
  description: string
  responsibilities: string
  requirements: string
  benefits: string
  applyUrl: string
  department: JobRow['department']
  location: string
  workplace: JobRow['workplace']
  employmentType: JobRow['employment_type']
  sortOrder: string
  isPublished: boolean
}

const EMPTY_JOB: JobEditorState = {
  originalSlug: '',
  slug: '',
  title: '',
  summary: '',
  description: '',
  responsibilities: '',
  requirements: '',
  benefits: '',
  applyUrl: '/contact?interest=careers',
  department: 'Technology',
  location: '',
  workplace: 'Remote',
  employmentType: 'Full-time',
  sortOrder: '0',
  isPublished: true,
}

const inputClass =
  'w-full rounded-xl border border-slate-700 bg-[#0b1323] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-orange-500'
const labelClass = 'mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400'

function normalizeRole(role: string) {
  return (role || '').trim().toLowerCase().replace(/\s+/g, '')
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function editorFromJob(job: JobRow): JobEditorState {
  return {
    originalSlug: job.slug,
    slug: job.slug,
    title: job.title,
    summary: job.summary,
    description: job.description || '',
    responsibilities: (job.responsibilities ?? []).join('\n'),
    requirements: (job.requirements ?? []).join('\n'),
    benefits: (job.benefits ?? []).join('\n'),
    applyUrl: job.apply_url || '/contact?interest=careers',
    department: job.department,
    location: job.location,
    workplace: job.workplace,
    employmentType: job.employment_type,
    sortOrder: String(job.sort_order ?? 0),
    isPublished: job.is_published,
  }
}

export default function JobManager() {
  const { token } = useSessionContext()
  const { accountType, displayRole, profileLoaded } = useDashboardProfile()
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingSlug, setDeletingSlug] = useState('')
  const [query, setQuery] = useState('')
  const [editor, setEditor] = useState<JobEditorState | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const role = normalizeRole(displayRole)
  const canManage = accountType === 'employee' && (role === 'editor' || role === 'superadmin')
  const accessToken = token?.trim() || ''

  const loadJobs = useCallback(async () => {
    if (!accessToken || !canManage) {
      setJobs([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    const response = await fetch('/api/jobs', {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const result = (await response.json().catch(() => null)) as { jobs?: JobRow[]; error?: string } | null

    if (!response.ok) setError(result?.error || 'Unable to load opportunities.')
    setJobs(result?.jobs ?? [])
    setLoading(false)
  }, [accessToken, canManage])

  useEffect(() => {
    if (!profileLoaded) return
    const timer = window.setTimeout(() => void loadJobs(), 0)
    return () => window.clearTimeout(timer)
  }, [loadJobs, profileLoaded])

  const filteredJobs = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return jobs
    return jobs.filter((job) =>
      `${job.title} ${job.slug} ${job.department} ${job.location} ${job.workplace}`
        .toLowerCase()
        .includes(needle),
    )
  }, [jobs, query])

  function update<K extends keyof JobEditorState>(key: K, value: JobEditorState[K]) {
    setEditor((current) => (current ? { ...current, [key]: value } : current))
  }

  function closeEditor() {
    if (saving) return
    setEditor(null)
    setError('')
  }

  async function saveJob(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editor || !accessToken) return

    const title = editor.title.trim()
    const slug = slugify(editor.slug || title)
    if (!title || !slug || !editor.summary.trim() || !editor.location.trim()) {
      setError('Title, slug, summary, and location are required.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    const response = await fetch('/api/jobs', {
      method: editor.originalSlug ? 'PUT' : 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        original_slug: editor.originalSlug,
        slug,
        title,
        summary: editor.summary.trim(),
        description: editor.description.trim(),
        responsibilities: editor.responsibilities.split('\n').map((item) => item.trim()).filter(Boolean),
        requirements: editor.requirements.split('\n').map((item) => item.trim()).filter(Boolean),
        benefits: editor.benefits.split('\n').map((item) => item.trim()).filter(Boolean),
        apply_url: editor.applyUrl.trim() || '/contact?interest=careers',
        department: editor.department,
        location: editor.location.trim(),
        workplace: editor.workplace,
        employment_type: editor.employmentType,
        sort_order: Number(editor.sortOrder) || 0,
        is_published: editor.isPublished,
      }),
    })
    const result = (await response.json().catch(() => null)) as { job?: JobRow; error?: string } | null

    if (!response.ok || !result?.job) {
      setError(result?.error || 'Unable to save this opportunity.')
      setSaving(false)
      return
    }

    setSuccess(editor.originalSlug ? 'Opportunity updated successfully.' : 'Opportunity created successfully.')
    setEditor(null)
    setSaving(false)
    await loadJobs()
  }

  async function deleteJob(job: JobRow) {
    if (!accessToken || !window.confirm(`Delete “${job.title}”? This cannot be undone.`)) return

    setDeletingSlug(job.slug)
    setError('')
    setSuccess('')

    const response = await fetch(`/api/jobs?slug=${encodeURIComponent(job.slug)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const result = (await response.json().catch(() => null)) as { error?: string } | null

    if (!response.ok) {
      setError(result?.error || 'Unable to delete this opportunity.')
    } else {
      setJobs((current) => current.filter((item) => item.slug !== job.slug))
      setSuccess('Opportunity deleted.')
    }
    setDeletingSlug('')
  }

  if (!profileLoaded || loading) {
    return <div className="flex min-h-[320px] items-center justify-center text-sm text-slate-400">Loading opportunities...</div>
  }

  if (!canManage) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-10 text-center text-slate-400">
        Only editors and super admins can manage opportunities.
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-400">Website content</p>
          <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">Manage Opportunities</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Add, edit, publish, reorder, or remove the roles displayed on the BmyBrand opportunities page.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditor({ ...EMPTY_JOB })
            setError('')
            setSuccess('')
          }}
          className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-black text-white shadow-lg shadow-orange-950/20 transition hover:bg-orange-400"
        >
          + Add opportunity
        </button>
      </div>

      {(error || success) && (
        <div
          className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
            error
              ? 'border-red-500/30 bg-red-500/10 text-red-200'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          }`}
        >
          {error || success}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0f172a]">
        <div className="flex flex-col gap-3 border-b border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, location, department..."
            className={`${inputClass} sm:max-w-md`}
          />
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            {filteredJobs.length} {filteredJobs.length === 1 ? 'role' : 'roles'}
          </p>
        </div>

        <div className="divide-y divide-slate-800">
          {filteredJobs.map((job) => (
            <article key={job.slug} className="grid gap-5 p-5 transition hover:bg-white/[0.02] lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.13em] ${
                    job.is_published ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'
                  }`}>
                    {job.is_published ? 'Published' : 'Draft'}
                  </span>
                  <span className="rounded-full bg-orange-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.13em] text-orange-300">
                    {job.department}
                  </span>
                </div>
                <h2 className="mt-3 text-xl font-black text-white">{job.title}</h2>
                <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-6 text-slate-400">{job.summary}</p>
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>{job.location}</span>
                  <span>•</span>
                  <span>{job.workplace}</span>
                  <span>•</span>
                  <span>{job.employment_type}</span>
                  <span>•</span>
                  <span>Order {job.sort_order}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditor(editorFromJob(job))
                    setError('')
                    setSuccess('')
                  }}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-bold text-slate-200 transition hover:border-orange-500 hover:text-orange-400"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void deleteJob(job)}
                  disabled={deletingSlug === job.slug}
                  className="rounded-lg border border-red-500/30 px-4 py-2 text-sm font-bold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deletingSlug === job.slug ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </article>
          ))}

          {filteredJobs.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-sm font-semibold text-slate-400">{query ? 'No opportunities match your search.' : 'No opportunities have been added yet.'}</p>
              {!query && <p className="mt-2 text-xs text-slate-600">Create the first role when you are ready to hire.</p>}
            </div>
          )}
        </div>
      </div>

      {editor && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm sm:p-8">
          <div className="my-auto w-full max-w-4xl rounded-2xl border border-slate-700 bg-[#0f172a] shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4 sm:px-7">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-400">
                  {editor.originalSlug ? 'Edit role' : 'New role'}
                </p>
                <h2 className="mt-1 text-xl font-black text-white">
                  {editor.originalSlug ? editor.title : 'Add an opportunity'}
                </h2>
              </div>
              <button type="button" onClick={closeEditor} className="rounded-lg px-3 py-2 text-sm font-bold text-slate-400 transition hover:bg-slate-800 hover:text-white">
                Close
              </button>
            </div>

            <form onSubmit={saveJob} className="p-5 sm:p-7">
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Job title">
                  <input
                    required
                    value={editor.title}
                    onChange={(event) => {
                      const title = event.target.value
                      setEditor((current) => current ? {
                        ...current,
                        title,
                        slug: current.originalSlug || current.slug ? current.slug : slugify(title),
                      } : current)
                    }}
                    placeholder="Senior Product Designer"
                    className={inputClass}
                  />
                </Field>

                <Field label="URL slug">
                  <input
                    required
                    value={editor.slug}
                    onChange={(event) => update('slug', slugify(event.target.value))}
                    placeholder="senior-product-designer"
                    className={inputClass}
                  />
                </Field>

                <Field label="Department">
                  <select value={editor.department} onChange={(event) => update('department', event.target.value as JobRow['department'])} className={inputClass}>
                    <option value="Design">Design</option>
                    <option value="Technology">Technology</option>
                    <option value="Growth">Growth</option>
                    <option value="Operations">Operations</option>
                  </select>
                </Field>

                <Field label="Location">
                  <input required value={editor.location} onChange={(event) => update('location', event.target.value)} placeholder="Remote / Toronto, Canada" className={inputClass} />
                </Field>

                <Field label="Work style">
                  <select value={editor.workplace} onChange={(event) => update('workplace', event.target.value as JobRow['workplace'])} className={inputClass}>
                    <option value="Remote">Remote</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="On-site">On-site</option>
                  </select>
                </Field>

                <Field label="Employment type">
                  <select value={editor.employmentType} onChange={(event) => update('employmentType', event.target.value as JobRow['employment_type'])} className={inputClass}>
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Internship">Internship</option>
                  </select>
                </Field>

                <Field label="Display order">
                  <input type="number" value={editor.sortOrder} onChange={(event) => update('sortOrder', event.target.value)} className={inputClass} />
                </Field>

                <label className="flex min-h-12 items-center gap-3 self-end rounded-xl border border-slate-700 bg-[#0b1323] px-4 py-3 text-sm font-bold text-slate-200">
                  <input type="checkbox" checked={editor.isPublished} onChange={(event) => update('isPublished', event.target.checked)} className="h-4 w-4 accent-orange-500" />
                  Published on website
                </label>

                <div className="md:col-span-2">
                  <Field label="Role summary">
                    <textarea
                      required
                      rows={6}
                      value={editor.summary}
                      onChange={(event) => update('summary', event.target.value)}
                      placeholder="Describe the role, its impact, and the person you are looking for."
                      className={`${inputClass} resize-y leading-6`}
                    />
                  </Field>
                </div>

                <div className="md:col-span-2">
                  <Field label="Full description">
                    <textarea
                      rows={8}
                      value={editor.description}
                      onChange={(event) => update('description', event.target.value)}
                      placeholder="Add the full role introduction. Separate paragraphs with a blank line."
                      className={`${inputClass} resize-y leading-6`}
                    />
                  </Field>
                </div>

                <div className="md:col-span-2">
                  <Field label="Responsibilities — one per line">
                    <textarea
                      rows={8}
                      value={editor.responsibilities}
                      onChange={(event) => update('responsibilities', event.target.value)}
                      placeholder={'Lead projects from discovery to launch\nCollaborate with design and engineering\nShare progress clearly with the wider team'}
                      className={`${inputClass} resize-y leading-6`}
                    />
                  </Field>
                </div>

                <div>
                  <Field label="Requirements — one per line">
                    <textarea
                      rows={9}
                      value={editor.requirements}
                      onChange={(event) => update('requirements', event.target.value)}
                      placeholder={'Relevant professional experience\nStrong written communication\nA thoughtful portfolio or work examples'}
                      className={`${inputClass} resize-y leading-6`}
                    />
                  </Field>
                </div>

                <div>
                  <Field label="Benefits — one per line">
                    <textarea
                      rows={9}
                      value={editor.benefits}
                      onChange={(event) => update('benefits', event.target.value)}
                      placeholder={'Flexible work arrangements\nLearning and development support\nModern tools and clear systems'}
                      className={`${inputClass} resize-y leading-6`}
                    />
                  </Field>
                </div>

                <div className="md:col-span-2">
                  <Field label="Apply URL">
                    <input
                      value={editor.applyUrl}
                      onChange={(event) => update('applyUrl', event.target.value)}
                      placeholder="/contact?interest=careers"
                      className={inputClass}
                    />
                  </Field>
                </div>
              </div>

              {error && <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

              <div className="mt-7 flex flex-col-reverse gap-3 border-t border-slate-800 pt-5 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeEditor} className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-black text-slate-300 transition hover:border-slate-500 hover:text-white">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="rounded-xl bg-orange-500 px-6 py-3 text-sm font-black text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50">
                  {saving ? 'Saving...' : editor.originalSlug ? 'Save changes' : 'Create opportunity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label>
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  )
}
