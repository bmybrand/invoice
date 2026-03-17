'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { supabase } from '@/lib/supabase'
import { useDashboardProfile } from '@/components/DashboardLayout'
import { clearRequiredFieldInvalid, handleRequiredFieldInvalid } from '@/lib/form-validation'

const plusJakarta = Plus_Jakarta_Sans({ subsets: ['latin'] })

const PAGE_SIZE = 8

type ClientRow = {
  id: number
  name: string
  email: string
  brand_id: number | null
  brand_name?: string
}

type BrandOption = { id: number; brand_name: string }

function SearchIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
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

function CloseIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
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

function PencilIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
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

export default function Clients() {
  const { displayRole } = useDashboardProfile()
  const [clients, setClients] = useState<ClientRow[]>([])
  const [clientsLoading, setClientsLoading] = useState(true)
  const [brands, setBrands] = useState<BrandOption[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addName, setAddName] = useState('')
  const [addEmail, setAddEmail] = useState('')
  const [addPassword, setAddPassword] = useState('')
  const [addBrandId, setAddBrandId] = useState<number | null>(null)
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const normalizedRole = (displayRole || '').trim().toLowerCase().replace(/\s+/g, '')
  const isAdmin = normalizedRole === 'admin'
  const isSuperAdmin = normalizedRole === 'superadmin'
  const canAddClient = isAdmin || isSuperAdmin
  const canEditDelete = isAdmin || isSuperAdmin

  const [editingClient, setEditingClient] = useState<ClientRow | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editBrandId, setEditBrandId] = useState<number | null>(null)
  const [editPassword, setEditPassword] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [deletingClient, setDeletingClient] = useState<ClientRow | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const fetchBrands = useCallback(async () => {
    const { data, error } = await supabase.from('brands').select('id, brand_name').order('brand_name')
    if (error) {
      console.error('Failed to fetch brands', error)
      return
    }
    setBrands((data as BrandOption[]) ?? [])
  }, [])

  const fetchClients = useCallback(async () => {
    setClientsLoading(true)
    const { data: clientsData, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, email, brand_id')
      .order('id', { ascending: false })

    if (clientsError) {
      console.error('Failed to fetch clients', clientsError)
      setClients([])
      setClientsLoading(false)
      return
    }

    const clientRows = (clientsData as ClientRow[]) ?? []
    const brandIds = [...new Set(clientRows.map((c) => c.brand_id).filter(Boolean))] as number[]

    if (brandIds.length > 0) {
      const { data: brandsData } = await supabase
        .from('brands')
        .select('id, brand_name')
        .in('id', brandIds)
      const brandMap = new Map((brandsData ?? []).map((b: { id: number; brand_name: string }) => [b.id, b.brand_name]))
      clientRows.forEach((c) => {
        if (c.brand_id) (c as ClientRow).brand_name = brandMap.get(c.brand_id) ?? ''
      })
    }

    setClients(clientRows)
    setClientsLoading(false)
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchClients()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [fetchClients])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchBrands()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [fetchBrands])

  const filteredClients = searchQuery.trim()
    ? clients.filter(
        (c) =>
          (c.name || '').toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
          (c.email || '').toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
          (c.brand_name || '').toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : clients

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / PAGE_SIZE))
  const effectivePage = Math.min(currentPage, totalPages)
  const start = (effectivePage - 1) * PAGE_SIZE
  const end = start + PAGE_SIZE
  const paginatedClients = filteredClients.slice(start, end)

  async function getCurrentAuthToken() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token?.trim()) return session.access_token.trim()
    const { data: refreshedData, error } = await supabase.auth.refreshSession()
    if (error) return ''
    return refreshedData.session?.access_token?.trim() || ''
  }

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canAddClient) return
    setAddError(null)
    setAddLoading(true)

    const token = await getCurrentAuthToken()
    if (!token) {
      setAddLoading(false)
      setAddError('Authentication expired. Sign in again and try again.')
      return
    }

    const response = await fetch('/api/clients', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: addName,
        email: addEmail,
        password: addPassword,
        brand_id: addBrandId,
      }),
    })

    const result = (await response.json().catch(() => null)) as { error?: string } | null
    setAddLoading(false)

    if (!response.ok) {
      setAddError(result?.error || 'Failed to create client')
      return
    }

    setShowAddModal(false)
    setAddName('')
    setAddEmail('')
    setAddPassword('')
    setAddBrandId(null)
    await fetchClients()
  }

  function openEditModal(c: ClientRow) {
    setEditingClient(c)
    setEditName(c.name || '')
    setEditEmail(c.email || '')
    setEditBrandId(c.brand_id ?? null)
    setEditPassword('')
    setEditError(null)
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingClient || !canEditDelete) return
    if (editPassword.trim() && editPassword.trim().length < 8) {
      setEditError('Password must be at least 8 characters long.')
      return
    }
    setEditError(null)
    setEditLoading(true)

    const token = await getCurrentAuthToken()
    if (!token) {
      setEditLoading(false)
      setEditError('Authentication expired. Sign in again and try again.')
      return
    }

    const payload: Record<string, unknown> = {
      name: editName.trim(),
      email: editEmail.trim(),
      brand_id: editBrandId,
    }
    if (editPassword.trim()) {
      payload.password = editPassword.trim()
    }

    const response = await fetch(`/api/clients/${editingClient.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })

    const result = (await response.json().catch(() => null)) as { error?: string } | null
    setEditLoading(false)

    if (!response.ok) {
      setEditError(result?.error || 'Failed to update client')
      return
    }

    setEditingClient(null)
    await fetchClients()
  }

  async function handleDeleteConfirm() {
    if (!deletingClient || !canEditDelete) return
    setDeleteError(null)
    setDeleteLoading(true)

    const token = await getCurrentAuthToken()
    if (!token) {
      setDeleteLoading(false)
      setDeleteError('Authentication expired. Sign in again and try again.')
      return
    }

    const response = await fetch(`/api/clients/${deletingClient.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })

    const result = (await response.json().catch(() => null)) as { error?: string } | null
    setDeleteLoading(false)

    if (!response.ok) {
      setDeleteError(result?.error || 'Failed to delete client')
      return
    }

    setDeletingClient(null)
    await fetchClients()
  }

  return (
    <div className={`${plusJakarta.className} w-full flex flex-col text-white`}>
      <div className="w-full pb-6">
        <div className="w-full p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl sm:text-3xl font-black leading-tight text-white">Manage Clients</h1>
            <p className="text-slate-400 text-sm font-normal leading-5">Overview of your clients and their brands</p>
          </div>
          {canAddClient && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="h-12 min-w-36 px-6 bg-orange-500 rounded-xl shadow-[0px_4px_20px_0px_rgba(249,115,22,0.2)] flex justify-center items-center gap-2 hover:bg-orange-600 transition shrink-0"
            >
              <PlusIcon className="h-4 w-3 text-white" />
              <span className="text-white text-sm font-bold">Add New Client</span>
            </button>
          )}
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
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1)
                }}
                placeholder="Search by name, email or brand..."
                className="flex-1 min-w-0 h-full bg-transparent text-slate-300 text-sm placeholder:text-slate-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="w-full bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden">
        <div className="w-full overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[560px] table-fixed">
            <thead>
              <tr className="bg-slate-900/50 border-b border-slate-700">
                <th className="w-[72px] px-4 sm:px-6 py-4 text-left">
                  <span className="block truncate whitespace-nowrap text-slate-400 text-xs font-bold uppercase tracking-wide">No.</span>
                </th>
                <th className="px-4 sm:px-6 py-4 text-left">
                  <span className="block truncate whitespace-nowrap text-slate-400 text-xs font-bold uppercase tracking-wide">Client</span>
                </th>
                <th className="px-4 sm:px-6 py-4 text-left">
                  <span className="block truncate whitespace-nowrap text-slate-400 text-xs font-bold uppercase tracking-wide">Email</span>
                </th>
                <th className="px-4 sm:px-6 py-4 text-left">
                  <span className="block truncate whitespace-nowrap text-slate-400 text-xs font-bold uppercase tracking-wide">Brand</span>
                </th>
                {canEditDelete && (
                  <th className="w-[100px] px-4 sm:px-6 py-4 text-right">
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-wide">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {clientsLoading ? (
                <tr>
                  <td colSpan={canEditDelete ? 5 : 4} className="border-t border-slate-700 px-4 sm:px-6 py-8 text-center text-slate-400 text-sm">
                    Loading clients…
                  </td>
                </tr>
              ) : paginatedClients.length === 0 ? (
                <tr>
                  <td colSpan={canEditDelete ? 5 : 4} className="border-t border-slate-700 px-4 sm:px-6 py-8 text-center text-slate-400 text-sm">
                    {searchQuery.trim() ? 'No matching clients' : 'No clients yet. Add a client to get started.'}
                  </td>
                </tr>
              ) : (
                paginatedClients.map((c, rowIndex) => (
                  <tr key={c.id} className="border-t border-slate-700">
                    <td className="w-[72px] px-4 sm:px-6 py-4">
                      <span className="text-white text-sm font-bold font-mono block truncate whitespace-nowrap" title={`Row ${start + rowIndex + 1}`}>{start + rowIndex + 1}</span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 min-w-0">
                      <span className="text-white text-sm font-bold truncate block whitespace-nowrap" title={c.name || '-'}>{c.name || '-'}</span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 min-w-0">
                      <span className="text-slate-300 text-sm truncate block whitespace-nowrap" title={c.email || '-'}>{c.email || '-'}</span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 min-w-0">
                      <span className="text-slate-300 text-sm truncate block whitespace-nowrap" title={c.brand_name || '-'}>{c.brand_name || '-'}</span>
                    </td>
                    {canEditDelete && (
                      <td className="w-[100px] px-4 sm:px-6 py-4">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(c)}
                            className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-slate-300 transition"
                            aria-label="Edit"
                          >
                            <PencilIcon />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteError(null)
                              setDeletingClient(c)
                            }}
                            className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-red-400 transition"
                            aria-label="Delete"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="w-full px-4 sm:px-6 py-4 bg-slate-900/50 border-t border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-slate-400 text-xs">
            {clientsLoading
              ? 'Loading…'
              : filteredClients.length === 0
                ? searchQuery.trim() ? 'No matching clients' : 'No clients'
                : `Showing ${start + 1} to ${Math.min(end, filteredClients.length)} of ${filteredClients.length} clients`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={effectivePage <= 1}
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
                    …
                  </span>
                ) : (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-lg flex justify-center items-center text-xs font-medium transition ${
                      effectivePage === page
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
              disabled={effectivePage >= totalPages}
              className="w-8 h-8 rounded-lg border border-slate-700 flex justify-center items-center text-slate-400 hover:bg-slate-700/50 transition disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Next page"
            >
              <ChevronRightIcon />
            </button>
          </div>
        </div>
      </div>

      {editingClient && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => !editLoading && setEditingClient(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Edit Client</h2>
                <button
                  type="button"
                  onClick={() => !editLoading && setEditingClient(null)}
                  className="p-2 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white transition"
                  aria-label="Close"
                >
                  <CloseIcon />
                </button>
              </div>

              <form
                onSubmit={handleEditSubmit}
                onInvalidCapture={handleRequiredFieldInvalid}
                onInputCapture={clearRequiredFieldInvalid}
                onChangeCapture={clearRequiredFieldInvalid}
                className="flex flex-col gap-4"
              >
                <div>
                  <label htmlFor="edit-name" className="block text-sm font-medium text-slate-300 mb-1">Name</label>
                  <input
                    id="edit-name"
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Client name"
                    required
                    className="w-full rounded-xl border border-slate-600 bg-slate-900/50 px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label htmlFor="edit-email" className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                  <input
                    id="edit-email"
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="client@example.com"
                    required
                    className="w-full rounded-xl border border-slate-600 bg-slate-900/50 px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label htmlFor="edit-brand" className="block text-sm font-medium text-slate-300 mb-1">Brand</label>
                  <select
                    id="edit-brand"
                    value={editBrandId ?? ''}
                    onChange={(e) => setEditBrandId(e.target.value ? Number(e.target.value) : null)}
                    required
                    className="w-full rounded-xl border border-slate-600 bg-slate-900/50 px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Select a brand</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>{b.brand_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-password" className="block text-sm font-medium text-slate-300 mb-1">New password</label>
                  <input
                    id="edit-password"
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Leave blank to keep current password"
                    className="w-full rounded-xl border border-slate-600 bg-slate-900/50 px-4 py-3 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <p className="mt-0.5 text-xs text-slate-500">Leave blank if you do not want to change the password.</p>
                </div>

                {editError && (
                  <p className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400">{editError}</p>
                )}

                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setEditingClient(null)}
                    disabled={editLoading}
                    className="px-4 py-2 rounded-xl border border-slate-600 text-slate-300 text-sm font-medium hover:bg-slate-700 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editLoading}
                    className="px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition disabled:opacity-50"
                  >
                    {editLoading ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {deletingClient && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => !deleteLoading && setDeletingClient(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
              <h2 className="text-lg font-bold text-white">Delete Client</h2>
              <p className="mt-2 text-slate-400 text-sm">
                Are you sure you want to delete <span className="font-medium text-white">{deletingClient.name}</span> ({deletingClient.email})? This will also remove their account access.
              </p>
              {deleteError && (
                <p className="mt-4 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400">{deleteError}</p>
              )}
              <div className="mt-6 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setDeletingClient(null)}
                  disabled={deleteLoading}
                  className="px-4 py-2 rounded-xl border border-slate-600 text-slate-300 text-sm font-medium hover:bg-slate-700 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={deleteLoading}
                  className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition disabled:opacity-50"
                >
                  {deleteLoading ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {showAddModal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => !addLoading && setShowAddModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Add New Client</h2>
                <button
                  type="button"
                  onClick={() => !addLoading && setShowAddModal(false)}
                  className="p-2 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white transition"
                  aria-label="Close"
                >
                  <CloseIcon />
                </button>
              </div>

              <form
                onSubmit={handleAddSubmit}
                onInvalidCapture={handleRequiredFieldInvalid}
                onInputCapture={clearRequiredFieldInvalid}
                onChangeCapture={clearRequiredFieldInvalid}
                className="flex flex-col gap-4"
              >
                <div>
                  <label htmlFor="add-name" className="block text-sm font-medium text-slate-300 mb-1">Name</label>
                  <input
                    id="add-name"
                    type="text"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    placeholder="Client name"
                    required
                    className="w-full rounded-xl border border-slate-600 bg-slate-900/50 px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label htmlFor="add-email" className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                  <input
                    id="add-email"
                    type="email"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    placeholder="client@example.com"
                    required
                    className="w-full rounded-xl border border-slate-600 bg-slate-900/50 px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label htmlFor="add-password" className="block text-sm font-medium text-slate-300 mb-1">Password</label>
                  <input
                    id="add-password"
                    type="password"
                    value={addPassword}
                    onChange={(e) => setAddPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    required
                    minLength={8}
                    className="w-full rounded-xl border border-slate-600 bg-slate-900/50 px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label htmlFor="add-brand" className="block text-sm font-medium text-slate-300 mb-1">Brand</label>
                  <select
                    id="add-brand"
                    value={addBrandId ?? ''}
                    onChange={(e) => setAddBrandId(e.target.value ? Number(e.target.value) : null)}
                    required
                    className="w-full rounded-xl border border-slate-600 bg-slate-900/50 px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Select a brand</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>{b.brand_name}</option>
                    ))}
                  </select>
                </div>

                {addError && (
                  <p className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400">{addError}</p>
                )}

                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    disabled={addLoading}
                    className="px-4 py-2 rounded-xl border border-slate-600 text-slate-300 text-sm font-medium hover:bg-slate-700 transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addLoading}
                    className="px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition disabled:opacity-50"
                  >
                    {addLoading ? 'Creating…' : 'Create Client'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
