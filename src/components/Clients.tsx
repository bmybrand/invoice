'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { flushSync } from 'react-dom'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useDashboardProfile } from '@/components/DashboardLayout'
import { ClientChatModal } from '@/components/ClientChatModal'
import { clearRequiredFieldInvalid, handleRequiredFieldInvalid } from '@/lib/form-validation'
import { logFetchError } from '@/lib/fetch-error'

const plusJakarta = Plus_Jakarta_Sans({ subsets: ['latin'] })

const PAGE_SIZE = 8
const TABLE_REFRESH_INTERVAL_MS = 20000 // 20 seconds fallback polling
type ClientRow = {
  id: number
  name: string
  email: string
  handler_id?: string | null
  handler_name?: string | null
  created_at?: string | null
}

type ArchivedClientRow = {
  id: number
  name: string
  email: string
  status: string
  created_at?: string | null
}

type RegistrationRequestRow = {
  id: number
  name: string
  email: string
  status: string
  created_at?: string | null
}

type SalesAgentOption = {
  auth_id: string
  employee_name: string
}

type ClientTableRow = {
  rowType: 'client' | 'request'
  rowKey: string
  status: 'approved' | 'pending' | 'rejected'
  name: string
  email: string
  handlerName?: string | null
  created_at?: string | null
  client?: ClientRow
  request?: RegistrationRequestRow
}

type ClientsTableCache = {
  ownerAuthId: string | null
  clients: ClientRow[]
  registrationRequests: RegistrationRequestRow[]
}

let clientsTableCache: ClientsTableCache | null = null

type RequestActionMode = 'approve' | 'reject' | 'delete'
type RequestActionTarget = {
  id: number
  name: string
  email: string
  source: 'client' | 'request'
}
type RequestActionConfirmState = {
  mode: RequestActionMode
  request: RequestActionTarget
}

type ChatTarget = {
  clientId: number
  title: string
  subtitle?: string
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

function ArchiveIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5H3.75m15.75 0-1.06 11.126A2.25 2.25 0 0116.2 20.75H7.8a2.25 2.25 0 01-2.24-2.124L4.5 7.5m15 0-.47-2.114A2.25 2.25 0 0016.84 3.75H7.16a2.25 2.25 0 00-2.19 1.636L4.5 7.5m4.5 4.5h6m-3-3v6" />
    </svg>
  )
}

function ArrowPathIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356m0 0-3.181 3.182A8.25 8.25 0 105.25 19.5m2.727-4.848H3.015v4.992m0 0 3.182-3.182" />
    </svg>
  )
}

export default function Clients() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentUserAuthId, displayRole } = useDashboardProfile()
  const scopedClientsCache = clientsTableCache?.ownerAuthId === currentUserAuthId ? clientsTableCache : null
  const [clients, setClients] = useState<ClientRow[]>(() => scopedClientsCache?.clients ?? [])
  const [clientsLoading, setClientsLoading] = useState(() => !scopedClientsCache)
  const [registrationRequests, setRegistrationRequests] = useState<RegistrationRequestRow[]>(
    () => scopedClientsCache?.registrationRequests ?? []
  )
  const [searchQuery, setSearchQuery] = useState(() => (searchParams.get('globalSearch') || '').trim())
  const [currentPage, setCurrentPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showArchivedModal, setShowArchivedModal] = useState(false)
  const [addName, setAddName] = useState('')
  const [addEmail, setAddEmail] = useState('')
  const [addPhone, setAddPhone] = useState('')
  const [addPassword, setAddPassword] = useState('')
  const [salesAgents, setSalesAgents] = useState<SalesAgentOption[]>([])
  const [agentsLoading, setAgentsLoading] = useState(false)
  const [addHandlerId, setAddHandlerId] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [archivedClients, setArchivedClients] = useState<ArchivedClientRow[]>([])
  const [archivedLoading, setArchivedLoading] = useState(false)
  const [archivedError, setArchivedError] = useState<string | null>(null)
  const [archivedActionClientId, setArchivedActionClientId] = useState<number | null>(null)

  const normalizedRole = (displayRole || '').trim().toLowerCase().replace(/\s+/g, '')
  const isAdmin = normalizedRole === 'admin'
  const isSuperAdmin = normalizedRole === 'superadmin'
  const canAddClient = isAdmin || isSuperAdmin
  const canEditDelete = isAdmin || isSuperAdmin

  const [editingClient, setEditingClient] = useState<ClientRow | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
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
  const [chatTarget, setChatTarget] = useState<ChatTarget | null>(() => {
    const chatClientId = Number.parseInt(searchParams.get('chatClientId') || '', 10)
    if (!Number.isFinite(chatClientId) || chatClientId < 1) return null

    const chatTitle = (searchParams.get('chatTitle') || '').trim() || 'Chat'
    const chatSubtitle = (searchParams.get('chatSubtitle') || '').trim()

    return {
      clientId: chatClientId,
      title: chatTitle,
      subtitle: chatSubtitle || undefined,
    }
  })
  const pendingClientDeleteIdsRef = useRef<Set<number>>(new Set())
  const suppressBackgroundRefreshRef = useRef(false)
  const refreshTimeoutRef = useRef<number | null>(null)
  const fetchVersionRef = useRef(0)
  const mutationVersionRef = useRef(0)
  const requestActionLoadingIdRef = useRef<number | null>(null)
  const isFetchingRef = useRef(false)
  const queuedRefreshRef = useRef(false)
  const fetchClientsRef = useRef<((options?: { background?: boolean }) => Promise<void>) | null>(null)

  useEffect(() => {
    requestActionLoadingIdRef.current = requestActionLoadingId
  }, [requestActionLoadingId])

  async function getCurrentAuthToken() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token?.trim()) return session.access_token.trim()
    const { data: refreshedData, error } = await supabase.auth.refreshSession()
    if (error) return ''
    return refreshedData.session?.access_token?.trim() || ''
  }

  const fetchSalesAgents = useCallback(async () => {
    setAgentsLoading(true)

    const { data, error } = await supabase
      .from('employees')
      .select('auth_id, employee_name')
      .neq('isdeleted', true)
      .ilike('department', '%sales%')
      .order('employee_name', { ascending: true })

    if (error) {
      setSalesAgents([])
      setAgentsLoading(false)
      return
    }

    const rows = (((data as Array<{ auth_id?: string | null; employee_name?: string | null }> | null) ?? []))
      .filter((row) => Boolean(row.auth_id?.trim()))
      .map((row) => ({
        auth_id: String(row.auth_id).trim(),
        employee_name: row.employee_name?.trim() || 'Sales Agent',
      }))

    setSalesAgents(rows)
    setAgentsLoading(false)
  }, [])

  useEffect(() => {
    if (chatTarget) return
    const timeoutId = window.setTimeout(() => {
      void fetchSalesAgents()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [chatTarget, fetchSalesAgents])

  const fetchClients = useCallback(async (options?: { background?: boolean }) => {
    const isBackgroundRefresh = options?.background ?? false
    if (isFetchingRef.current) {
      queuedRefreshRef.current = true
      return
    }
    if (isBackgroundRefresh && suppressBackgroundRefreshRef.current) {
      return
    }
    isFetchingRef.current = true
    const fetchVersion = ++fetchVersionRef.current
    const mutationVersionAtStart = mutationVersionRef.current
    if (!isBackgroundRefresh && !scopedClientsCache) {
      setClientsLoading(true)
    }
    const { data: clientsData, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, email, handler_id, status, created_date')
      .neq('isdeleted', true)
      .order('created_date', { ascending: false })

    if (clientsError) {
      if (fetchVersion !== fetchVersionRef.current || mutationVersionAtStart !== mutationVersionRef.current) {
        isFetchingRef.current = false
        return
      }
      logFetchError('Failed to fetch clients', clientsError)
      if (!isBackgroundRefresh) {
        setClientsLoading(false)
      }
      isFetchingRef.current = false
      if (queuedRefreshRef.current) {
        queuedRefreshRef.current = false
        void fetchClientsRef.current?.({ background: true })
      }
      return
    }

    if (fetchVersion !== fetchVersionRef.current || mutationVersionAtStart !== mutationVersionRef.current) {
      isFetchingRef.current = false
      return
    }

    const allClientRows =
      ((clientsData as Array<{
        id: number
        name: string
        email: string
        handler_id?: string | null
        status: string | null
        created_date?: string | null
      }> | null) ?? [])

    const handlerIds = Array.from(
      new Set(
        allClientRows
          .map((row) => (row.handler_id || '').trim())
          .filter((id) => Boolean(id))
      )
    )

    const handlerNameByAuthId = new Map<string, string>()
    if (handlerIds.length > 0) {
      const { data: handlersData, error: handlersError } = await supabase
        .from('employees')
        .select('auth_id, employee_name')
        .in('auth_id', handlerIds)
        .neq('isdeleted', true)

      if (!handlersError) {
        ;(((handlersData as Array<{ auth_id?: string | null; employee_name?: string | null }> | null) ?? [])).forEach(
          (row) => {
            const authId = (row.auth_id || '').trim()
            if (!authId) return
            handlerNameByAuthId.set(authId, row.employee_name?.trim() || 'Unassigned')
          }
        )
      }
    }

    const clientRows = allClientRows
      .filter((row) => isAdmin || isSuperAdmin || row.handler_id === currentUserAuthId)
      .filter((row) => (row.status || '').trim().toLowerCase() === 'approved')
      .map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        handler_id: row.handler_id ?? null,
        handler_name: row.handler_id ? handlerNameByAuthId.get(row.handler_id) || 'Unassigned' : 'Unassigned',
        created_at: row.created_date ?? null,
      }))

    const requestsData: RegistrationRequestRow[] = allClientRows
      .filter((row) => {
        if (!isAdmin && !isSuperAdmin && row.handler_id !== currentUserAuthId) return false
        const status = (row.status || '').trim().toLowerCase()
        return status === 'pending' || status === 'rejected'
      })
      .map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
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
      .filter((row): row is RegistrationRequestRow => Boolean(row))
      .filter((row) => {
        const status = (row.status || '').trim().toLowerCase()
        return status === 'pending' || status === 'rejected'
      })

    setClients((prev) => (areClientRowsEqual(prev, visibleClientRows) ? prev : visibleClientRows))
    setRegistrationRequests((prev) => (areRequestRowsEqual(prev, requestRows) ? prev : requestRows))
    clientsTableCache = {
      ownerAuthId: currentUserAuthId,
      clients: visibleClientRows,
      registrationRequests: requestRows,
    }
    if (!isBackgroundRefresh) {
      setClientsLoading(false)
    }
    isFetchingRef.current = false
    if (queuedRefreshRef.current) {
      queuedRefreshRef.current = false
      void fetchClientsRef.current?.({ background: true })
    }
  }, [currentUserAuthId, isAdmin, isSuperAdmin, scopedClientsCache])

  useEffect(() => {
    fetchClientsRef.current = fetchClients
  }, [fetchClients])

  const fetchArchivedClients = useCallback(async () => {
    setArchivedLoading(true)
    setArchivedError(null)

    const { data, error } = await supabase
      .from('clients')
      .select('id, name, email, handler_id, status, created_date')
      .eq('isdeleted', true)
      .order('created_date', { ascending: false })

    if (error) {
      setArchivedError(error.message || 'Failed to load archived clients')
      setArchivedLoading(false)
      return
    }

    setArchivedClients(
      (((data as Array<{
        id: number
        name: string
        email: string
        handler_id?: string | null
        status?: string | null
        created_date?: string | null
      }> | null) ?? []))
        .filter((row) => isAdmin || isSuperAdmin || row.handler_id === currentUserAuthId)
        .map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        status: (row.status || '').trim().toLowerCase() || 'archived',
        created_at: row.created_date ?? null,
      }))
    )
    setArchivedLoading(false)
  }, [currentUserAuthId, isAdmin, isSuperAdmin])

  useEffect(() => {
    if (chatTarget) return
    const timeoutId = window.setTimeout(() => {
      void fetchClients()
    }, 0)

    // Supabase Realtime subscription for clients table
    const channelName = `clients-table-sync-${currentUserAuthId || 'unknown'}`
    const channel = supabase.channel(channelName)

    if (currentUserAuthId) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clients',
          filter: `handler_id=eq.${currentUserAuthId}`,
        },
        () => { void fetchClients({ background: true }) }
      )
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'registration_requests',
        },
        () => { void fetchClients({ background: true }) }
      )
    }

    channel.subscribe()

    // Fallback polling every 20s
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible' && requestActionLoadingIdRef.current === null) {
        void fetchClients({ background: true })
      }
    }, TABLE_REFRESH_INTERVAL_MS)

    return () => {
      window.clearTimeout(timeoutId)
      window.clearInterval(intervalId)
      void supabase.removeChannel(channel)
      if (refreshTimeoutRef.current !== null) {
        window.clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [chatTarget, fetchClients, currentUserAuthId])

  useEffect(() => {
    const nextQuery = (searchParams.get('globalSearch') || '').trim()
    setSearchQuery((prev) => (prev === nextQuery ? prev : nextQuery))
  }, [searchParams])

  useEffect(() => {
    if (!showArchivedModal) return
    const timeoutId = window.setTimeout(() => {
      void fetchArchivedClients()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [fetchArchivedClients, showArchivedModal])

  const tableRows: ClientTableRow[] = [
    ...clients.map((client) => ({
      rowType: 'client' as const,
      rowKey: `client-record-${client.id}`,
      status: 'approved' as const,
      name: client.name,
      email: client.email,
      handlerName: client.handler_name ?? 'Unassigned',
      created_at: client.created_at,
      client,
    })),
    ...registrationRequests.map((row) => ({
      rowType: 'request' as const,
      rowKey: `client-record-${row.id}`,
      status: ((row.status || '').trim().toLowerCase() === 'rejected' ? 'rejected' : 'pending') as 'pending' | 'rejected',
      name: row.name,
      email: row.email,
      handlerName: 'Unassigned',
      created_at: row.created_at,
      request: row,
    })),
  ].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
    return bTime - aTime
  })

  const filteredClients = searchQuery.trim()
    ? tableRows.filter(
        (c) =>
        (c.name || '').toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        (c.email || '').toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        (c.handlerName || '').toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
        c.status.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : tableRows

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / PAGE_SIZE))
  const effectivePage = Math.min(currentPage, totalPages)
  const start = (effectivePage - 1) * PAGE_SIZE
  const end = start + PAGE_SIZE
  const paginatedClients = filteredClients.slice(start, end)

  function scheduleClientsRefresh() {
    suppressBackgroundRefreshRef.current = true
    if (refreshTimeoutRef.current !== null) {
      window.clearTimeout(refreshTimeoutRef.current)
    }
    refreshTimeoutRef.current = window.setTimeout(() => {
      suppressBackgroundRefreshRef.current = false
      refreshTimeoutRef.current = null
      void fetchClients({ background: true })
    }, 1250)
  }

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canAddClient) return
    setAddError(null)

    if (!addHandlerId) {
      setAddError('Select a sales agent before creating the client.')
      return
    }

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
        phone: addPhone,
        password: addPassword,
        handlerId: addHandlerId,
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
    setAddPhone('')
    setAddPassword('')
    setAddHandlerId('')
    setActionMessage({ type: 'success', text: `Client ${addName.trim()} added successfully.` })
    await fetchClients()
  }

  function openEditModal(c: ClientRow) {
    setEditingClient(c)
    setEditName(c.name || '')
    setEditEmail(c.email || '')
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
    if (showArchivedModal) {
      await fetchArchivedClients()
    }
  }

  async function handleArchivedClientAction(client: ArchivedClientRow, action: 'purge' | 'restore') {
    if (!canEditDelete || archivedActionClientId !== null) return

    setArchivedError(null)
    setArchivedActionClientId(client.id)

    const token = await getCurrentAuthToken()
    if (!token) {
      setArchivedActionClientId(null)
      setArchivedError('Authentication expired. Sign in again and try again.')
      return
    }

    const response = await fetch(`/api/clients/${client.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action }),
    })

    const result = (await response.json().catch(() => null)) as { error?: string } | null
    setArchivedActionClientId(null)

    if (!response.ok) {
      const fallbackMessage =
        action === 'restore' ? 'Failed to restore archived client' : 'Failed to permanently delete archived client'
      setArchivedError(result?.error || fallbackMessage)
      setActionMessage({ type: 'error', text: result?.error || fallbackMessage })
      return
    }

    setArchivedClients((prev) => prev.filter((row) => row.id !== client.id))
    setActionMessage({
      type: 'success',
      text:
        action === 'restore'
          ? `Archived client ${client.name} was restored.`
          : `Archived client ${client.name} was permanently deleted.`,
    })
    await fetchClients({ background: true })
  }

  async function handleRejectApprovedClient(targetClient: ClientRow) {
    if (!canEditDelete) return

    mutationVersionRef.current += 1
    suppressBackgroundRefreshRef.current = true
    setRequestActionError(null)
    flushSync(() => {
      setRequestActionLoadingId(targetClient.id)
      setClients((prev) => prev.filter((client) => client.id !== targetClient.id))
      setRegistrationRequests((prev) => [
        {
          id: targetClient.id,
          name: targetClient.name,
          email: targetClient.email,
          status: 'rejected',
          created_at: targetClient.created_at ?? new Date().toISOString(),
        },
        ...prev.filter((row) => row.id !== targetClient.id),
      ])
    })
    setActionMessage({ type: 'success', text: `Client ${targetClient.name} rejected successfully.` })
    const previousClients = clients
    const previousRequests = registrationRequests

    const token = await getCurrentAuthToken()
    if (!token) {
      suppressBackgroundRefreshRef.current = false
      setClients(previousClients)
      setRegistrationRequests(previousRequests)
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
      suppressBackgroundRefreshRef.current = false
      setClients(previousClients)
      setRegistrationRequests(previousRequests)
      setRequestActionLoadingId(null)
      setRequestActionError(result?.error || 'Failed to reject client')
      setActionMessage({ type: 'error', text: result?.error || 'Failed to reject client' })
      return
    }
    setRequestActionLoadingId(null)
    scheduleClientsRefresh()
  }

  function getStatusStyle(status: ClientTableRow['status']) {
    if (status === 'approved') return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
    if (status === 'pending') return 'border-amber-500/20 bg-amber-500/10 text-amber-400'
    return 'border-red-500/20 bg-red-500/10 text-red-400'
  }

  function getRowId(row: ClientTableRow) {
    if (row.rowType === 'client' && row.client) return row.client.id
    if (row.rowType === 'request' && row.request) return row.request.id
    return null
  }

  async function handleRequestDecision(requestId: number, decision: 'approve' | 'reject') {
    if (!canEditDelete) return

    mutationVersionRef.current += 1
    suppressBackgroundRefreshRef.current = true
    setRequestActionError(null)
    const previousClients = clients
    const previousRequests = registrationRequests
    const targetRequest = registrationRequests.find((row) => row.id === requestId) ?? null
    flushSync(() => {
      setRequestActionLoadingId(requestId)
      if (!targetRequest) return

      if (decision === 'approve') {
        setRegistrationRequests((prev) => prev.filter((row) => row.id !== requestId))
        setClients((prev) => [
          {
            id: targetRequest.id,
            name: targetRequest.name,
            email: targetRequest.email,
            created_at: targetRequest.created_at,
          },
          ...prev.filter((client) => client.id !== requestId),
        ])
        return
      }

      setRegistrationRequests((prev) =>
        prev.map((row) => (row.id === requestId ? { ...row, status: 'rejected' } : row))
      )
    })
    setActionMessage({
      type: 'success',
      text: decision === 'approve' ? 'Request approved successfully.' : 'Request rejected successfully.',
    })

    const token = await getCurrentAuthToken()
    if (!token) {
      suppressBackgroundRefreshRef.current = false
      setClients(previousClients)
      setRegistrationRequests(previousRequests)
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
      suppressBackgroundRefreshRef.current = false
      setClients(previousClients)
      setRegistrationRequests(previousRequests)
      setRequestActionLoadingId(null)
      setRequestActionError(result?.error || `Failed to ${decision} request`)
      setActionMessage({ type: 'error', text: result?.error || `Failed to ${decision} request` })
      return
    }
    setRequestActionLoadingId(null)
    scheduleClientsRefresh()
  }

  async function handleRequestDelete(requestId: number) {
    if (!canEditDelete) return

    suppressBackgroundRefreshRef.current = true
    setRequestActionError(null)
    setRequestActionLoadingId(requestId)
    setActionMessage({ type: 'success', text: 'Request deleted successfully.' })

    const token = await getCurrentAuthToken()
    if (!token) {
      suppressBackgroundRefreshRef.current = false
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
      suppressBackgroundRefreshRef.current = false
      setRequestActionError(result?.error || 'Failed to delete request')
      setActionMessage({ type: 'error', text: result?.error || 'Failed to delete request' })
      return
    }
    scheduleClientsRefresh()
  }

  async function handleRequestActionConfirm() {
    if (!requestActionConfirm) return
    const { mode, request } = requestActionConfirm
    setRequestActionConfirm(null)

    if (mode === 'delete') {
      await handleRequestDelete(request.id)
      return
    }

    if (mode === 'reject' && request.source === 'client') {
      await handleRejectApprovedClient({
        id: request.id,
        name: request.name,
        email: request.email,
      })
      return
    }

    await handleRequestDecision(request.id, mode)
  }

  useEffect(() => {
    const legacyChatClientId = Number.parseInt(searchParams.get('chatClientId') || '', 10)
    if (!Number.isFinite(legacyChatClientId) || legacyChatClientId < 1) return

    const timeoutId = window.setTimeout(() => {
      router.replace(`/dashboard/chat?clientId=${legacyChatClientId}`)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [router, searchParams])

  useEffect(() => {
    const chatClientId = Number.parseInt(searchParams.get('chatClientId') || '', 10)
    if (!Number.isFinite(chatClientId) || chatClientId < 1) return

    const chatTitle = (searchParams.get('chatTitle') || '').trim() || 'Chat'
    const chatSubtitle = (searchParams.get('chatSubtitle') || '').trim()

    const timeoutId = window.setTimeout(() => {
      setChatTarget((prev) => {
        if (prev?.clientId === chatClientId) return prev
        return {
          clientId: chatClientId,
          title: chatTitle,
          subtitle: chatSubtitle || undefined,
        }
      })
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [searchParams])

  function openChatInNewTab(row: ClientTableRow) {
    const rowId = getRowId(row)
    if (rowId == null) return
    router.push(`/dashboard/chat?clientId=${rowId}`)
  }

  if (chatTarget) {
    return (
      <div className={`${plusJakarta.className} w-full flex flex-col text-white`}>
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setChatTarget(null)
              router.replace('/dashboard/clients')
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/85 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Back to clients
          </button>
        </div>

        <ClientChatModal
          open={Boolean(chatTarget)}
          clientId={chatTarget.clientId}
          title={chatTarget.title || 'Chat'}
          subtitle={chatTarget.subtitle}
          onClose={() => setChatTarget(null)}
          variant="page"
        />
      </div>
    )
  }

  return (
    <div className={`${plusJakarta.className} w-full flex flex-col text-white`}>
      <div className="w-full pb-6">
        <div className="w-full p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl sm:text-3xl font-black leading-tight text-white">Manage Clients</h1>
            <p className="text-slate-400 text-sm font-normal leading-5">Overview of your clients and registration requests</p>
          </div>
          <div className="flex shrink-0 gap-3">
            {canEditDelete && (
              <button
                type="button"
                onClick={() => setShowArchivedModal(true)}
                className="h-12 min-w-12 rounded-xl border border-slate-700 bg-slate-900/70 px-4 text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white"
                aria-label="View archived clients"
                title="View archived clients"
              >
                <ArchiveIcon className="h-4 w-4" />
              </button>
            )}
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
                placeholder="Search by name, email or status..."
                className="flex-1 min-w-0 h-full bg-transparent text-slate-300 text-sm placeholder:text-slate-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="w-full bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden">
        <div className="w-full overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[900px] table-fixed">
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
                  <span className="block truncate whitespace-nowrap text-slate-400 text-xs font-bold uppercase tracking-wide">Status</span>
                </th>
                <th className="px-4 sm:px-6 py-4 text-left">
                  <span className="block truncate whitespace-nowrap text-slate-400 text-xs font-bold uppercase tracking-wide">Handler</span>
                </th>
                <th className="w-[96px] px-4 sm:px-6 py-4 text-center">
                  <span className="block truncate whitespace-nowrap text-slate-400 text-xs font-bold uppercase tracking-wide">Message</span>
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
                  <td colSpan={canEditDelete ? 7 : 6} className="border-t border-slate-700 px-4 sm:px-6 py-8 text-center text-slate-400 text-sm">
                    Loading clients…
                  </td>
                </tr>
              ) : paginatedClients.length === 0 ? (
                <tr>
                  <td colSpan={canEditDelete ? 7 : 6} className="border-t border-slate-700 px-4 sm:px-6 py-8 text-center text-slate-400 text-sm">
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
                      <span
                        className={`inline-flex rounded-lg border px-2 py-1 text-xs font-medium ${
                          requestActionLoadingId === getRowId(c)
                            ? 'border-slate-500/30 bg-slate-500/10 text-slate-300'
                            : `capitalize ${getStatusStyle(c.status)}`
                        }`}
                      >
                        {requestActionLoadingId === getRowId(c) ? 'Updating...' : c.status}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 min-w-0">
                      <span className="text-slate-300 text-sm truncate block whitespace-nowrap" title={c.handlerName || 'Unassigned'}>
                        {c.handlerName || 'Unassigned'}
                      </span>
                    </td>
                    <td className="w-[96px] px-4 sm:px-6 py-4 text-center">
                      {c.email?.trim() ? (
                        <button
                          type="button"
                          onClick={() => openChatInNewTab(c)}
                          className="inline-flex items-center rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-slate-600 hover:bg-slate-700/50 hover:text-orange-300"
                          title={`Message ${c.name || c.email}`}
                          aria-label={`Message ${c.name || c.email}`}
                        >
                          Chat
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">--</span>
                      )}
                    </td>
                    {canEditDelete && (
                      <td className="w-[180px] px-4 sm:px-6 py-4">
                        <div className="flex justify-end gap-1">
                          {requestActionLoadingId === getRowId(c) ? (
                            <span className="inline-flex items-center rounded-lg border border-slate-600/70 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-300">
                              Updating...
                            </span>
                          ) : c.rowType === 'client' && c.client ? (
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
                                onClick={() =>
                                  setRequestActionConfirm({
                                    mode: 'reject',
                                    request: {
                                      id: c.client!.id,
                                      name: c.client!.name,
                                      email: c.client!.email,
                                      source: 'client',
                                    },
                                  })
                                }
                                disabled={requestActionLoadingId === c.client.id}
                                className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-red-400 transition disabled:opacity-50"
                                title="Reject client"
                                aria-label="Reject client"
                              >
                                <CloseIcon className="h-3.5 w-3.5" />
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
                                onClick={() =>
                                  setRequestActionConfirm({
                                    mode: 'approve',
                                    request: {
                                      id: c.request!.id,
                                      name: c.request!.name,
                                      email: c.request!.email,
                                      source: 'request',
                                    },
                                  })
                                }
                                disabled={requestActionLoadingId === c.request.id}
                                className="group p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 transition disabled:opacity-50"
                                title="Accept request"
                                aria-label="Accept request"
                              >
                                <CheckIcon className="h-3.5 w-3.5 text-slate-400 transition-colors group-hover:text-emerald-400" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setRequestActionConfirm({
                                    mode: 'reject',
                                    request: {
                                      id: c.request!.id,
                                      name: c.request!.name,
                                      email: c.request!.email,
                                      source: 'request',
                                    },
                                  })
                                }
                                disabled={requestActionLoadingId === c.request.id}
                                className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-red-400 transition disabled:opacity-50"
                                title="Reject request"
                                aria-label="Reject request"
                              >
                                <CloseIcon className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setRequestActionConfirm({
                                    mode: 'delete',
                                    request: {
                                      id: c.request!.id,
                                      name: c.request!.name,
                                      email: c.request!.email,
                                      source: 'request',
                                    },
                                  })
                                }
                                disabled={requestActionLoadingId === c.request.id}
                                className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-red-400 transition disabled:opacity-50"
                                title="Delete request"
                                aria-label="Delete request"
                              >
                                <TrashIcon className="h-3.5 w-3.5" />
                              </button>
                            </>
                          ) : c.rowType === 'request' && c.request && c.status === 'rejected' ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  setRequestActionConfirm({
                                    mode: 'approve',
                                    request: {
                                      id: c.request!.id,
                                      name: c.request!.name,
                                      email: c.request!.email,
                                      source: 'request',
                                    },
                                  })
                                }
                                disabled={requestActionLoadingId === c.request.id}
                                className="group p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 transition disabled:opacity-50"
                                title="Accept request"
                                aria-label="Accept request"
                              >
                                <CheckIcon className="h-3.5 w-3.5 text-slate-400 transition-colors group-hover:text-emerald-400" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setRequestActionConfirm({
                                    mode: 'delete',
                                    request: {
                                      id: c.request!.id,
                                      name: c.request!.name,
                                      email: c.request!.email,
                                      source: 'request',
                                    },
                                  })
                                }
                                disabled={requestActionLoadingId === c.request.id}
                                className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-red-400 transition disabled:opacity-50"
                                title="Delete request"
                                aria-label="Delete request"
                              >
                                <TrashIcon className="h-3.5 w-3.5" />
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
                    ? requestActionConfirm.request.source === 'client'
                      ? 'Reject Client'
                      : 'Reject Request'
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

      {showArchivedModal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => archivedActionClientId === null && setShowArchivedModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="flex max-h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Archived Clients</h2>
                  <p className="mt-1 text-sm text-slate-400">Permanently delete clients that were already archived.</p>
                </div>
                <button
                  type="button"
                  onClick={() => archivedActionClientId === null && setShowArchivedModal(false)}
                  className="p-2 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white transition"
                  aria-label="Close archived clients"
                >
                  <CloseIcon />
                </button>
              </div>

              {archivedError && (
                <div className="px-6 pt-4">
                  <p className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                    {archivedError}
                  </p>
                </div>
              )}

              <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
                <table className="w-full min-w-[640px] table-fixed">
                  <thead>
                    <tr className="border-b border-slate-700 text-left">
                      <th className="w-[80px] px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">ID</th>
                      <th className="px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">Client</th>
                      <th className="px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">Email</th>
                      <th className="w-[120px] px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">Status</th>
                      <th className="w-[160px] px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">Archived</th>
                      <th className="w-[160px] px-3 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-400">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {archivedLoading ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-400">Loading archived clients...</td>
                      </tr>
                    ) : archivedClients.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-400">No archived clients found.</td>
                      </tr>
                    ) : (
                      archivedClients.map((client) => (
                        <tr key={client.id} className="border-b border-slate-700/60 last:border-b-0">
                          <td className="px-3 py-4 text-sm font-mono text-white">{client.id}</td>
                          <td className="px-3 py-4 text-sm font-semibold text-white">{client.name || '-'}</td>
                          <td className="px-3 py-4 text-sm text-slate-300">{client.email || '-'}</td>
                          <td className="px-3 py-4 text-sm text-slate-300 capitalize">{client.status || 'archived'}</td>
                          <td className="px-3 py-4 text-sm text-slate-400">{client.created_at ? new Date(client.created_at).toLocaleDateString() : '--'}</td>
                          <td className="px-3 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => void handleArchivedClientAction(client, 'restore')}
                                disabled={archivedActionClientId !== null}
                                className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
                                title="Restore client"
                                aria-label="Restore client"
                              >
                                <ArrowPathIcon className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleArchivedClientAction(client, 'purge')}
                                disabled={archivedActionClientId !== null}
                                className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                                title="Delete forever"
                                aria-label="Delete forever"
                              >
                                <TrashIcon className="h-4 w-4" />
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
                  <label htmlFor="add-phone" className="block text-sm font-medium text-slate-300 mb-1">Phone</label>
                  <input
                    id="add-phone"
                    type="tel"
                    value={addPhone}
                    onChange={(e) => setAddPhone(e.target.value)}
                    placeholder="+1 (555) 000-1234"
                    required
                    className="w-full rounded-xl border border-slate-600 bg-slate-900/50 px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label htmlFor="add-handler" className="block text-sm font-medium text-slate-300 mb-1">Handler</label>
                  <select
                    id="add-handler"
                    value={addHandlerId}
                    onChange={(e) => setAddHandlerId(e.target.value)}
                    required
                    disabled={agentsLoading || addLoading}
                    className="w-full rounded-xl border border-slate-600 bg-slate-900/50 px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-60"
                  >
                    <option value="">{agentsLoading ? 'Loading handlers...' : 'Select Handler'}</option>
                    {salesAgents.map((agent) => (
                      <option key={agent.auth_id} value={agent.auth_id}>
                        {agent.employee_name}
                      </option>
                    ))}
                  </select>
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
