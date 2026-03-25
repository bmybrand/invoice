'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { supabase } from '@/lib/supabase'
import { useDashboardProfile } from '@/components/DashboardLayout'
import { clearRequiredFieldInvalid, handleRequiredFieldInvalid } from '@/lib/form-validation'

const plusJakarta = Plus_Jakarta_Sans({ subsets: ['latin'] })

const PAGE_SIZE = 8
const TABLE_REFRESH_INTERVAL_MS = 5000

type ClientRow = {
  id: number
  name: string
  email: string
  brand_id: number | null
  brand_name?: string
}

type RegistrationRequestRow = {
  id: number
  name: string
  email: string
  brand_id: number | null
  status: string
  brand_name?: string
  created_at?: string | null
}

type ClientTableRow = {
  rowType: 'client' | 'request'
  rowKey: string
  status: 'approved' | 'pending' | 'rejected'
  name: string
  email: string
  brand_name?: string
  client?: ClientRow
  request?: RegistrationRequestRow
}

type BrandOption = { id: number; brand_name: string }

type ClientsTableCache = {
  clients: ClientRow[]
  registrationRequests: RegistrationRequestRow[]
  brands: BrandOption[]
}

let clientsTableCache: ClientsTableCache | null = null

type RequestActionMode = 'approve' | 'reject' | 'delete'
type RequestActionConfirmState = {
  mode: RequestActionMode
  request: RegistrationRequestRow
}

function areClientRowsEqual(a: ClientRow[], b: ClientRow[]) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function areRequestRowsEqual(a: RegistrationRequestRow[], b: RegistrationRequestRow[]) {
  return JSON.stringify(a) === JSON.stringify(b)
}

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

function CheckIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
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
  const [clients, setClients] = useState<ClientRow[]>(() => clientsTableCache?.clients ?? [])
  const [clientsLoading, setClientsLoading] = useState(() => !clientsTableCache)
  const [registrationRequests, setRegistrationRequests] = useState<RegistrationRequestRow[]>(
    () => clientsTableCache?.registrationRequests ?? []
  )
  const [brands, setBrands] = useState<BrandOption[]>(() => clientsTableCache?.brands ?? [])
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
  const [requestActionLoadingId, setRequestActionLoadingId] = useState<number | null>(null)
  const [requestActionError, setRequestActionError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [requestActionConfirm, setRequestActionConfirm] = useState<RequestActionConfirmState | null>(null)
  const pendingClientDeleteIdsRef = useRef<Set<number>>(new Set())
  const pendingRequestActionsRef = useRef<Map<number, RequestActionMode>>(new Map())

  async function getCurrentAuthToken() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token?.trim()) return session.access_token.trim()
    const { data: refreshedData, error } = await supabase.auth.refreshSession()
    if (error) return ''
    return refreshedData.session?.access_token?.trim() || ''
  }

  const fetchBrands = useCallback(async () => {
    const { data, error } = await supabase.from('brands').select('id, brand_name').order('brand_name')
    if (error) {
      console.error('Failed to fetch brands', error)
      return
    }
    const nextBrands = (data as BrandOption[]) ?? []
    setBrands(nextBrands)
    clientsTableCache = {
      clients: clientsTableCache?.clients ?? [],
      registrationRequests: clientsTableCache?.registrationRequests ?? [],
      brands: nextBrands,
    }
  }, [])

  const fetchClients = useCallback(async (options?: { background?: boolean }) => {
    const isBackgroundRefresh = options?.background ?? false
    if (!isBackgroundRefresh && !clientsTableCache) {
      setClientsLoading(true)
    }
    const { data: clientsData, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, email, brand_id, status, created_date')
      .neq('isdeleted', true)
      .order('created_date', { ascending: false })

    if (clientsError) {
      console.error('Failed to fetch clients', clientsError)
      if (!isBackgroundRefresh) {
        setClientsLoading(false)
      }
      return
    }

    const allClientRows =
      ((clientsData as Array<{
        id: number
        name: string
        email: string
        brand_id: number | null
        status: string | null
        created_date?: string | null
      }> | null) ?? [])

    const clientRows = allClientRows
      .filter((row) => (row.status || '').trim().toLowerCase() === 'approved')
      .map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        brand_id: row.brand_id,
      }))

    const requestsData: RegistrationRequestRow[] = allClientRows
      .filter((row) => {
        const status = (row.status || '').trim().toLowerCase()
        return status === 'pending' || status === 'rejected'
      })
      .map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        brand_id: row.brand_id,
        status: (row.status || '').trim().toLowerCase(),
        created_at: row.created_date ?? null,
      }))

    const visibleClientRows = clientRows.filter((c) => !pendingClientDeleteIdsRef.current.has(c.id))
    const allRequestRows = requestsData
    const latestRequestByEmail = new Map<string, RegistrationRequestRow>()
    allRequestRows.forEach((row) => {
      const emailKey = (row.email || '').trim().toLowerCase()
      if (!emailKey || latestRequestByEmail.has(emailKey)) return
      latestRequestByEmail.set(emailKey, row)
    })

    const requestRows = Array.from(latestRequestByEmail.values())
      .map((row) => {
        const pendingAction = pendingRequestActionsRef.current.get(row.id)
        if (pendingAction === 'approve' || pendingAction === 'delete') return null
        if (pendingAction === 'reject') return { ...row, status: 'rejected' }
        return row
      })
      .filter((row): row is RegistrationRequestRow => Boolean(row))
      .filter((row) => {
        const status = (row.status || '').trim().toLowerCase()
        return status === 'pending' || status === 'rejected'
      })

    pendingRequestActionsRef.current.forEach((action, requestId) => {
      const liveRow = allRequestRows.find((r) => r.id === requestId)
      if ((action === 'approve' || action === 'delete') && !liveRow) {
        pendingRequestActionsRef.current.delete(requestId)
      }
      if (action === 'reject' && (liveRow?.status || '').trim().toLowerCase() === 'rejected') {
        pendingRequestActionsRef.current.delete(requestId)
      }
    })

    const brandIds = [
      ...new Set([
        ...visibleClientRows.map((c) => c.brand_id).filter(Boolean),
        ...requestRows.map((r) => r.brand_id).filter(Boolean),
      ]),
    ] as number[]

    if (brandIds.length > 0) {
      const { data: brandsData } = await supabase
        .from('brands')
        .select('id, brand_name')
        .in('id', brandIds)
      const brandMap = new Map((brandsData ?? []).map((b: { id: number; brand_name: string }) => [b.id, b.brand_name]))
      visibleClientRows.forEach((c) => {
        if (c.brand_id) (c as ClientRow).brand_name = brandMap.get(c.brand_id) ?? ''
      })
      requestRows.forEach((r) => {
        if (r.brand_id) (r as RegistrationRequestRow).brand_name = brandMap.get(r.brand_id) ?? ''
      })
    }

    setClients((prev) => (areClientRowsEqual(prev, visibleClientRows) ? prev : visibleClientRows))
    setRegistrationRequests((prev) => (areRequestRowsEqual(prev, requestRows) ? prev : requestRows))
    clientsTableCache = {
      clients: visibleClientRows,
      registrationRequests: requestRows,
      brands: clientsTableCache?.brands ?? [],
    }
    if (!isBackgroundRefresh) {
      setClientsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchClients()
    }, 0)

    const intervalId = window.setInterval(() => {
      void fetchClients({ background: true })
    }, TABLE_REFRESH_INTERVAL_MS)

    return () => {
      window.clearTimeout(timeoutId)
      window.clearInterval(intervalId)
    }
  }, [fetchClients])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchBrands()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [fetchBrands])

  const tableRows: ClientTableRow[] = [
    ...registrationRequests
      .filter((row) => (row.status || '').trim().toLowerCase() === 'pending')
      .map((row) => ({
        rowType: 'request' as const,
        rowKey: `request-${row.id}`,
        status: 'pending' as const,
        name: row.name,
        email: row.email,
        brand_name: row.brand_name,
        request: row,
      })),
    ...clients.map((client) => ({
      rowType: 'client' as const,
      rowKey: `client-${client.id}`,
      status: 'approved' as const,
      name: client.name,
      email: client.email,
      brand_name: client.brand_name,
      client,
    })),
    ...registrationRequests
      .filter((row) => (row.status || '').trim().toLowerCase() === 'rejected')
      .map((row) => ({
        rowType: 'request' as const,
        rowKey: `request-${row.id}`,
        status: 'rejected' as const,
        name: row.name,
        email: row.email,
        brand_name: row.brand_name,
        request: row,
      })),
  ]

  const filteredClients = searchQuery.trim()
    ? tableRows.filter(
        (c) =>
          (c.name || '').toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
          (c.email || '').toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
          (c.brand_name || '').toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
          c.status.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : tableRows

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / PAGE_SIZE))
  const effectivePage = Math.min(currentPage, totalPages)
  const start = (effectivePage - 1) * PAGE_SIZE
  const end = start + PAGE_SIZE
  const paginatedClients = filteredClients.slice(start, end)

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
      setActionMessage({ type: 'error', text: result?.error || 'Failed to create client' })
      return
    }

    setShowAddModal(false)
    setAddName('')
    setAddEmail('')
    setAddPassword('')
    setAddBrandId(null)
    setActionMessage({ type: 'success', text: `Client ${addName.trim()} added successfully.` })
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
      setActionMessage({ type: 'error', text: result?.error || 'Failed to update client' })
      return
    }

    setEditingClient(null)
    setActionMessage({ type: 'success', text: `Client ${editName.trim()} updated successfully.` })
    await fetchClients()
  }

  async function handleDeleteConfirm() {
    if (!deletingClient || !canEditDelete) return
    setDeleteError(null)
    setRequestActionError(null)
    setDeleteLoading(true)

    const targetClient = deletingClient
    const previousClients = clients
    pendingClientDeleteIdsRef.current.add(targetClient.id)
    setClients((prev) => prev.filter((c) => c.id !== targetClient.id))

    const token = await getCurrentAuthToken()
    if (!token) {
      pendingClientDeleteIdsRef.current.delete(targetClient.id)
      setClients(previousClients)
      setDeleteLoading(false)
      setRequestActionError('Authentication expired. Sign in again and try again.')
      setActionMessage({ type: 'error', text: 'Authentication expired. Sign in again and try again.' })
      return
    }

    const response = await fetch(`/api/clients/${targetClient.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })

    const result = (await response.json().catch(() => null)) as { error?: string } | null
    setDeleteLoading(false)

    if (!response.ok) {
      pendingClientDeleteIdsRef.current.delete(targetClient.id)
      setClients(previousClients)
      setRequestActionError(result?.error || 'Failed to delete client')
      setActionMessage({ type: 'error', text: result?.error || 'Failed to delete client' })
      return
    }

    pendingClientDeleteIdsRef.current.delete(targetClient.id)
    setDeletingClient(null)
    setActionMessage({ type: 'success', text: `Client ${targetClient.name} deleted successfully.` })
    await fetchClients({ background: true })
  }

  async function handleRejectApprovedClient(targetClient: ClientRow) {
    if (!canEditDelete) return

    setRequestActionError(null)
    setActionMessage(null)
    setRequestActionLoadingId(targetClient.id)

    const token = await getCurrentAuthToken()
    if (!token) {
      setRequestActionLoadingId(null)
      setRequestActionError('Authentication expired. Sign in again and try again.')
      setActionMessage({ type: 'error', text: 'Authentication expired. Sign in again and try again.' })
      return
    }

    const response = await fetch(`/api/clients/registration-requests/${targetClient.id}/reject`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })

    const result = (await response.json().catch(() => null)) as { error?: string } | null

    if (!response.ok) {
      setRequestActionLoadingId(null)
      setRequestActionError(result?.error || 'Failed to reject client')
      setActionMessage({ type: 'error', text: result?.error || 'Failed to reject client' })
      return
    }

    setActionMessage({ type: 'success', text: `Client ${targetClient.name} rejected successfully.` })
    await fetchClients({ background: true })
    setRequestActionLoadingId(null)
  }

  function getStatusStyle(status: ClientTableRow['status']) {
    if (status === 'approved') return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
    if (status === 'pending') return 'border-amber-500/20 bg-amber-500/10 text-amber-400'
    return 'border-red-500/20 bg-red-500/10 text-red-400'
  }

  async function handleRequestDecision(requestId: number, decision: 'approve' | 'reject') {
    if (!canEditDelete) return

    setRequestActionError(null)
    setRequestActionLoadingId(requestId)
    pendingRequestActionsRef.current.set(requestId, decision)

    const token = await getCurrentAuthToken()
    if (!token) {
      pendingRequestActionsRef.current.delete(requestId)
      setRequestActionLoadingId(null)
      setRequestActionError('Authentication expired. Sign in again and try again.')
      setActionMessage({ type: 'error', text: 'Authentication expired. Sign in again and try again.' })
      return
    }

    const endpoint = `/api/clients/registration-requests/${requestId}/${decision}`
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const result = (await response.json().catch(() => null)) as { error?: string } | null

    if (!response.ok) {
      pendingRequestActionsRef.current.delete(requestId)
      setRequestActionLoadingId(null)
      setRequestActionError(result?.error || `Failed to ${decision} request`)
      setActionMessage({ type: 'error', text: result?.error || `Failed to ${decision} request` })
      return
    }

    setActionMessage({
      type: 'success',
      text: decision === 'approve' ? 'Request approved successfully.' : 'Request rejected successfully.',
    })
    await fetchClients({ background: true })
    setRequestActionLoadingId(null)
  }

  async function handleRequestDelete(requestId: number) {
    if (!canEditDelete) return

    setRequestActionError(null)
    setRequestActionLoadingId(requestId)

    const previousRequests = registrationRequests
    pendingRequestActionsRef.current.set(requestId, 'delete')
    setRegistrationRequests((prev) => prev.filter((r) => r.id !== requestId))

    const token = await getCurrentAuthToken()
    if (!token) {
      pendingRequestActionsRef.current.delete(requestId)
      setRegistrationRequests(previousRequests)
      setRequestActionLoadingId(null)
      setRequestActionError('Authentication expired. Sign in again and try again.')
      setActionMessage({ type: 'error', text: 'Authentication expired. Sign in again and try again.' })
      return
    }

    const response = await fetch(`/api/clients/registration-requests/${requestId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const result = (await response.json().catch(() => null)) as { error?: string } | null
    setRequestActionLoadingId(null)

    if (!response.ok) {
      pendingRequestActionsRef.current.delete(requestId)
      setRegistrationRequests(previousRequests)
      setRequestActionError(result?.error || 'Failed to delete request')
      setActionMessage({ type: 'error', text: result?.error || 'Failed to delete request' })
      return
    }

    setActionMessage({ type: 'success', text: 'Request deleted successfully.' })
    await fetchClients({ background: true })
  }

  async function handleRequestActionConfirm() {
    if (!requestActionConfirm) return
    const { mode, request } = requestActionConfirm
    setRequestActionConfirm(null)

    if (mode === 'delete') {
      await handleRequestDelete(request.id)
      return
    }

    await handleRequestDecision(request.id, mode)
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

      {(actionMessage || requestActionError) && (
        <div className="w-full pb-6">
          <p
            key={requestActionError || actionMessage?.text || 'message'}
            className={`message-fade-slide-in rounded-lg border px-4 py-3 text-sm ${
              requestActionError || actionMessage?.type === 'error'
                ? 'border-red-500/50 bg-red-500/10 text-red-400'
                : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
            }`}
          >
            {requestActionError || actionMessage?.text}
          </p>
        </div>
      )}

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
          <table className="w-full min-w-[760px] table-fixed">
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
                <th className="px-4 sm:px-6 py-4 text-left">
                  <span className="block truncate whitespace-nowrap text-slate-400 text-xs font-bold uppercase tracking-wide">Status</span>
                </th>
                {canEditDelete && (
                  <th className="w-[180px] px-4 sm:px-6 py-4 text-right">
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-wide">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {clientsLoading ? (
                <tr>
                  <td colSpan={canEditDelete ? 6 : 5} className="border-t border-slate-700 px-4 sm:px-6 py-8 text-center text-slate-400 text-sm">
                    Loading clients…
                  </td>
                </tr>
              ) : paginatedClients.length === 0 ? (
                <tr>
                  <td colSpan={canEditDelete ? 6 : 5} className="border-t border-slate-700 px-4 sm:px-6 py-8 text-center text-slate-400 text-sm">
                    {searchQuery.trim() ? 'No matching clients' : 'No clients yet. Add a client to get started.'}
                  </td>
                </tr>
              ) : (
                paginatedClients.map((c, rowIndex) => (
                  <tr key={c.rowKey} className="border-t border-slate-700">
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
                    <td className="px-4 sm:px-6 py-4 min-w-0">
                      <span
                        className={`inline-flex rounded-lg border px-2 py-1 text-xs font-medium capitalize ${
                          (c.rowType === 'client' && c.client && requestActionLoadingId === c.client.id) ||
                          (c.rowType === 'request' && c.request && requestActionLoadingId === c.request.id)
                            ? 'border-blue-500/20 bg-blue-500/10 text-blue-400'
                            : getStatusStyle(c.status)
                        }`}
                      >
                        {(c.rowType === 'client' && c.client && requestActionLoadingId === c.client.id) ||
                        (c.rowType === 'request' && c.request && requestActionLoadingId === c.request.id)
                          ? 'updating...'
                          : c.status}
                      </span>
                    </td>
                    {canEditDelete && (
                      <td className="w-[180px] px-4 sm:px-6 py-4">
                        <div className="flex justify-end gap-1">
                          {c.rowType === 'client' && c.client ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditModal(c.client!)}
                                disabled={requestActionLoadingId === c.client.id}
                                className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-slate-300 transition disabled:opacity-50"
                                aria-label="Edit"
                              >
                                <PencilIcon />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleRejectApprovedClient(c.client!)}
                                disabled={requestActionLoadingId === c.client.id}
                                className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-red-400 transition disabled:opacity-50"
                                title="Reject client"
                                aria-label="Reject client"
                              >
                                {requestActionLoadingId === c.client.id ? '...' : <CloseIcon className="h-3.5 w-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteError(null)
                                  setDeletingClient(c.client!)
                                }}
                                disabled={requestActionLoadingId === c.client.id}
                                className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-red-400 transition disabled:opacity-50"
                                aria-label="Delete"
                              >
                                <TrashIcon />
                              </button>
                            </>
                          ) : c.rowType === 'request' && c.request && c.status === 'pending' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setRequestActionConfirm({ mode: 'approve', request: c.request! })}
                                disabled={requestActionLoadingId === c.request.id}
                                className="group p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 transition disabled:opacity-50"
                                title="Accept request"
                                aria-label="Accept request"
                              >
                                {requestActionLoadingId === c.request.id ? '...' : <CheckIcon className="h-3.5 w-3.5 text-slate-400 transition-colors group-hover:text-emerald-400" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => setRequestActionConfirm({ mode: 'reject', request: c.request! })}
                                disabled={requestActionLoadingId === c.request.id}
                                className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-red-400 transition disabled:opacity-50"
                                title="Reject request"
                                aria-label="Reject request"
                              >
                                {requestActionLoadingId === c.request.id ? '...' : <CloseIcon className="h-3.5 w-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => setRequestActionConfirm({ mode: 'delete', request: c.request! })}
                                disabled={requestActionLoadingId === c.request.id}
                                className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-red-400 transition disabled:opacity-50"
                                title="Delete request"
                                aria-label="Delete request"
                              >
                                {requestActionLoadingId === c.request.id ? '...' : <TrashIcon className="h-3.5 w-3.5" />}
                              </button>
                            </>
                          ) : c.rowType === 'request' && c.request && c.status === 'rejected' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setRequestActionConfirm({ mode: 'approve', request: c.request! })}
                                disabled={requestActionLoadingId === c.request.id}
                                className="group p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 transition disabled:opacity-50"
                                title="Accept request"
                                aria-label="Accept request"
                              >
                                {requestActionLoadingId === c.request.id ? '...' : <CheckIcon className="h-3.5 w-3.5 text-slate-400 transition-colors group-hover:text-emerald-400" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => setRequestActionConfirm({ mode: 'delete', request: c.request! })}
                                disabled={requestActionLoadingId === c.request.id}
                                className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-red-400 transition disabled:opacity-50"
                                title="Delete request"
                                aria-label="Delete request"
                              >
                                {requestActionLoadingId === c.request.id ? '...' : <TrashIcon className="h-3.5 w-3.5" />}
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-slate-500">No actions</span>
                          )}
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
                Are you sure you want to delete <span className="font-medium text-white">{deletingClient.name}</span> ({deletingClient.email})? This will hide the client by marking it deleted.
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

      {requestActionConfirm && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => requestActionLoadingId === null && setRequestActionConfirm(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
              <h2 className="text-lg font-bold text-white">
                {requestActionConfirm.mode === 'approve'
                  ? 'Approve Request'
                  : requestActionConfirm.mode === 'reject'
                    ? 'Reject Request'
                    : 'Delete Request'}
              </h2>
              <p className="mt-2 text-slate-400 text-sm">
                {requestActionConfirm.mode === 'approve'
                  ? <>Are you sure you want to approve <span className="font-medium text-white">{requestActionConfirm.request.name}</span> ({requestActionConfirm.request.email})?</>
                  : requestActionConfirm.mode === 'reject'
                    ? <>Are you sure you want to reject <span className="font-medium text-white">{requestActionConfirm.request.name}</span> ({requestActionConfirm.request.email})?</>
                    : <>Are you sure you want to delete the request for <span className="font-medium text-white">{requestActionConfirm.request.name}</span> ({requestActionConfirm.request.email})?</>}
              </p>
              <div className="mt-6 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setRequestActionConfirm(null)}
                  disabled={requestActionLoadingId !== null}
                  className="px-4 py-2 rounded-xl border border-slate-600 text-slate-300 text-sm font-medium hover:bg-slate-700 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleRequestActionConfirm()}
                  disabled={requestActionLoadingId !== null}
                  className={`px-4 py-2 rounded-xl text-white text-sm font-semibold transition disabled:opacity-50 ${
                    requestActionConfirm.mode === 'approve' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'
                  }`}
                >
                  {requestActionLoadingId !== null
                    ? 'Processing…'
                    : requestActionConfirm.mode === 'approve'
                      ? 'Approve'
                      : requestActionConfirm.mode === 'reject'
                        ? 'Reject'
                        : 'Delete'}
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


