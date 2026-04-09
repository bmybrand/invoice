'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useDashboardProfile } from '@/components/DashboardLayout'
import { clearRequiredFieldInvalid, handleRequiredFieldInvalid } from '@/lib/form-validation'

const plusJakarta = Plus_Jakarta_Sans({ subsets: ['latin'] })

type PaymentGatewayRow = {
  id: number
  name: string
  minimumDepositAmount: number
  maximumDepositAmount: number
  testingPublishableKey: string
  testingSecretKey: string
  livePublishableKey: string
  liveSecretKey: string
  status: string
  lastActiveMode: 'Testing' | 'Live'
}

type PaymentGatewayApiRow = {
  id: number
  name: string
  minimum_deposit_amount: number | string
  maximum_deposit_amount: number | string
  testing_publishable_key: string | null
  testing_secret_key: string | null
  live_publishable_key: string | null
  live_secret_key: string | null
  status: string | null
  last_active_mode?: string | null
}

type GatewayFormState = {
  name: string
  minimumDepositAmount: string
  maximumDepositAmount: string
  testingPublishableKey: string
  testingSecretKey: string
  livePublishableKey: string
  liveSecretKey: string
  status: string
}

type SettingsScopedCache = {
  ownerAuthId: string | null
  gateways: PaymentGatewayRow[]
}

let settingsGatewaysCache: SettingsScopedCache | null = null

const EMPTY_FORM: GatewayFormState = {
  name: '',
  minimumDepositAmount: '',
  maximumDepositAmount: '',
  testingPublishableKey: '',
  testingSecretKey: '',
  livePublishableKey: '',
  liveSecretKey: '',
  status: 'Testing',
}

function PlusIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

function SearchIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  )
}

function PencilIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
    </svg>
  )
}

function TrashIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  )
}

function PowerIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v9m6.364-5.364a9 9 0 11-12.728 0" />
    </svg>
  )
}

function ArrowsRightLeftIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 7.5h12m0 0-3-3m3 3-3 3M16.5 16.5h-12m0 0 3 3m-3-3 3-3" />
    </svg>
  )
}

function CloseIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

function mapGatewayRow(row: PaymentGatewayApiRow): PaymentGatewayRow {
  const normalizedStatus = (row.status?.trim() || 'Testing').toLowerCase()
  const normalizedLastActiveMode = (row.last_active_mode?.trim() || '').toLowerCase()
  const lastActiveMode: 'Testing' | 'Live' =
    normalizedLastActiveMode === 'live'
      ? 'Live'
      : normalizedLastActiveMode === 'testing'
        ? 'Testing'
        : normalizedStatus === 'live'
          ? 'Live'
          : 'Testing'

  return {
    id: row.id,
    name: row.name,
    minimumDepositAmount: Number(row.minimum_deposit_amount ?? 0),
    maximumDepositAmount: Number(row.maximum_deposit_amount ?? 0),
    testingPublishableKey: row.testing_publishable_key?.trim() || '',
    testingSecretKey: row.testing_secret_key?.trim() || '',
    livePublishableKey: row.live_publishable_key?.trim() || '',
    liveSecretKey: row.live_secret_key?.trim() || '',
    status: row.status?.trim() || 'Testing',
    lastActiveMode,
  }
}

function toFormState(gateway: PaymentGatewayRow | null): GatewayFormState {
  if (!gateway) return EMPTY_FORM

  return {
    name: gateway.name,
    minimumDepositAmount: String(gateway.minimumDepositAmount),
    maximumDepositAmount: String(gateway.maximumDepositAmount),
    testingPublishableKey: gateway.testingPublishableKey,
    testingSecretKey: gateway.testingSecretKey,
    livePublishableKey: gateway.livePublishableKey,
    liveSecretKey: gateway.liveSecretKey,
    status: gateway.status,
  }
}

function maskGatewayKey(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return '--'
  return trimmed.length > 18 ? `${trimmed.slice(0, 18)}...` : trimmed
}

function getGatewayStatusStyle(status: string): string {
  const normalized = status.trim().toLowerCase()
  if (normalized === 'live') return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
  if (normalized === 'testing') return 'border-amber-500/20 bg-amber-500/10 text-amber-400'
  if (normalized === 'inactive') return 'border-rose-500/20 bg-rose-500/10 text-rose-400'
  return 'border-slate-500/20 bg-slate-500/10 text-slate-400'
}

function resolveGlobalGatewayMode(
  gateways: PaymentGatewayRow[],
  previousMode: 'Testing' | 'Live'
): 'Testing' | 'Live' {
  const activeGateways = gateways.filter((gateway) => {
    const normalized = gateway.status.trim().toLowerCase()
    return normalized !== 'inactive'
  })

  if (activeGateways.length === 0) {
    return previousMode
  }

  const allLive = activeGateways.every((gateway) => gateway.status.trim().toLowerCase() === 'live')
  if (allLive) {
    return 'Live'
  }

  const allTesting = activeGateways.every((gateway) => gateway.status.trim().toLowerCase() === 'testing')
  if (allTesting) {
    return 'Testing'
  }

  return previousMode
}

function gatewayHasLiveKeys(gateway: Pick<PaymentGatewayRow, 'livePublishableKey' | 'liveSecretKey'>): boolean {
  return Boolean(gateway.livePublishableKey.trim() && gateway.liveSecretKey.trim())
}

function normalizeGatewayMode(value: string): 'Testing' | 'Live' {
  return value.trim().toLowerCase() === 'live' ? 'Live' : 'Testing'
}

async function fetchWithSession(url: string, init?: RequestInit) {
  const { data } = await supabase.auth.getSession()
  const headers = new Headers(init?.headers)

  if (data.session?.access_token) {
    headers.set('Authorization', `Bearer ${data.session.access_token}`)
  }

  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  return fetch(url, {
    ...init,
    headers,
  })
}

export default function Settings() {
  const searchParams = useSearchParams()
  const { currentUserAuthId, displayRole } = useDashboardProfile()
  const normalizedRole = (displayRole || '').trim().toLowerCase().replace(/\s+/g, '')
  const canViewGateways = normalizedRole === 'superadmin' || normalizedRole === 'admin'
  const canManageGateways = normalizedRole === 'superadmin'
  const scopedGatewaysCache =
    settingsGatewaysCache?.ownerAuthId === currentUserAuthId ? settingsGatewaysCache.gateways : null
  const hasScopedGatewaysCache = Boolean(scopedGatewaysCache)

  const [gateways, setGateways] = useState<PaymentGatewayRow[]>(() => scopedGatewaysCache ?? [])
  const [gatewaysLoading, setGatewaysLoading] = useState(() => !hasScopedGatewaysCache)
  const [pageError, setPageError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState(() => (searchParams.get('globalSearch') || '').trim())
  const [modalOpen, setModalOpen] = useState(false)
  const [editingGateway, setEditingGateway] = useState<PaymentGatewayRow | null>(null)
  const [formState, setFormState] = useState<GatewayFormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [globalModeLoading, setGlobalModeLoading] = useState(false)
  const [globalGatewayMode, setGlobalGatewayMode] = useState<'Testing' | 'Live'>('Testing')
  const suppressBackgroundRefreshRef = useRef(false)
  const refreshTimeoutRef = useRef<number | null>(null)
  const fetchVersionRef = useRef(0)
  const mutationVersionRef = useRef(0)

  const loadGateways = useCallback(async (options?: { background?: boolean }) => {
    const isBackgroundRefresh = options?.background ?? false
    if (isBackgroundRefresh && suppressBackgroundRefreshRef.current) {
      return
    }
    const fetchVersion = ++fetchVersionRef.current
    const mutationVersionAtStart = mutationVersionRef.current

    if (!canViewGateways) {
      setGateways([])
      setGatewaysLoading(false)
      return
    }

    if (!isBackgroundRefresh && !hasScopedGatewaysCache) {
      setGatewaysLoading(true)
    }
    if (!isBackgroundRefresh) {
      setPageError(null)
    }

    const res = await fetchWithSession('/api/settings/payment-gateways')
    const payload = (await res.json().catch(() => ({}))) as { gateways?: PaymentGatewayApiRow[]; error?: string }

    if (fetchVersion !== fetchVersionRef.current || mutationVersionAtStart !== mutationVersionRef.current) {
      return
    }

    if (!res.ok) {
      if (!isBackgroundRefresh) {
        setPageError(payload.error ?? 'Failed to load payment gateways.')
        if (!hasScopedGatewaysCache) {
          setGateways([])
        }
        setGatewaysLoading(false)
      }
      return
    }

    const nextGateways = (payload.gateways ?? []).map(mapGatewayRow)
    settingsGatewaysCache = {
      ownerAuthId: currentUserAuthId,
      gateways: nextGateways,
    }
    setGateways(nextGateways)
    setGlobalGatewayMode((previousMode) => resolveGlobalGatewayMode(nextGateways, previousMode))

    if (!isBackgroundRefresh) {
      setGatewaysLoading(false)
    }
  }, [canViewGateways, currentUserAuthId, hasScopedGatewaysCache])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadGateways({ background: hasScopedGatewaysCache })
    }, 0)

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadGateways({ background: true })
      }
    }, 5000)

    return () => {
      window.clearTimeout(timeoutId)
      window.clearInterval(intervalId)
      if (refreshTimeoutRef.current !== null) {
        window.clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [hasScopedGatewaysCache, loadGateways])

  useEffect(() => {
    const nextQuery = (searchParams.get('globalSearch') || '').trim()
    setSearchQuery((prev) => (prev === nextQuery ? prev : nextQuery))
  }, [searchParams])

  function openCreateModal() {
    if (!canManageGateways) return
    setEditingGateway(null)
    setFormState(EMPTY_FORM)
    setFormError(null)
    setModalOpen(true)
  }

  function openEditModal(gateway: PaymentGatewayRow) {
    if (!canManageGateways) return
    setEditingGateway(gateway)
    setFormState(toFormState(gateway))
    setFormError(null)
    setModalOpen(true)
  }

  function closeModal() {
    if (submitting) return
    setModalOpen(false)
    setEditingGateway(null)
    setFormState(EMPTY_FORM)
    setFormError(null)
  }

  function normalizeGatewayStatus(status: string): 'Testing' | 'Live' | 'Inactive' {
    const normalized = status.trim().toLowerCase()
    if (normalized === 'live') return 'Live'
    if (normalized === 'inactive') return 'Inactive'
    return 'Testing'
  }

  function scheduleGatewayRefresh() {
    suppressBackgroundRefreshRef.current = true
    if (refreshTimeoutRef.current !== null) {
      window.clearTimeout(refreshTimeoutRef.current)
    }
    refreshTimeoutRef.current = window.setTimeout(() => {
      suppressBackgroundRefreshRef.current = false
      refreshTimeoutRef.current = null
      void loadGateways({ background: true })
    }, 1250)
  }

  async function updateGatewayStatus(gateway: PaymentGatewayRow, nextStatus: 'Testing' | 'Live' | 'Inactive') {
    if (!canManageGateways) return
    setPageError(null)
    if (nextStatus === 'Live' && !gatewayHasLiveKeys(gateway)) {
      setPageError('Enter both live keys before switching a gateway to Live mode.')
      return
    }
    mutationVersionRef.current += 1
    const previousGateways = gateways

    const nextLastActiveMode =
      nextStatus === 'Inactive'
        ? normalizeGatewayStatus(gateway.status) === 'Inactive'
          ? gateway.lastActiveMode
          : normalizeGatewayMode(gateway.status)
        : normalizeGatewayMode(nextStatus)

    const applyStatus = (rows: PaymentGatewayRow[]) =>
      rows.map((row) =>
        row.id === gateway.id ? { ...row, status: nextStatus, lastActiveMode: nextLastActiveMode } : row
      )

    const optimisticGateways = applyStatus(gateways)
    setGateways(optimisticGateways)
    setGlobalGatewayMode((previousMode) => resolveGlobalGatewayMode(optimisticGateways, previousMode))

    const res = await fetchWithSession(`/api/settings/payment-gateways/${gateway.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: gateway.name,
        minimumDepositAmount: gateway.minimumDepositAmount,
        maximumDepositAmount: gateway.maximumDepositAmount,
        testingPublishableKey: gateway.testingPublishableKey,
        testingSecretKey: gateway.testingSecretKey,
        livePublishableKey: gateway.livePublishableKey,
        liveSecretKey: gateway.liveSecretKey,
        status: nextStatus,
        lastActiveMode: nextLastActiveMode,
      }),
    })

    const payload = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      setGateways(previousGateways)
      setGlobalGatewayMode((previousMode) => resolveGlobalGatewayMode(previousGateways, previousMode))
      setPageError(payload.error ?? 'Failed to update payment gateway.')
      return
    }

    scheduleGatewayRefresh()
  }

  async function handleToggleGatewayMode(gateway: PaymentGatewayRow) {
    const currentStatus = normalizeGatewayStatus(gateway.status)
    const nextStatus = currentStatus === 'Live' ? 'Testing' : 'Live'
    await updateGatewayStatus(gateway, nextStatus)
  }

  async function handleToggleGatewayEnabled(gateway: PaymentGatewayRow) {
    const currentStatus = normalizeGatewayStatus(gateway.status)
    const nextStatus = currentStatus === 'Inactive' ? gateway.lastActiveMode : 'Inactive'
    await updateGatewayStatus(gateway, nextStatus)
  }

  async function handleDeleteGateway(gateway: PaymentGatewayRow) {
    if (!canManageGateways) return
    if (!window.confirm(`Delete ${gateway.name}?`)) return

    setPageError(null)
    const res = await fetchWithSession(`/api/settings/payment-gateways/${gateway.id}`, {
      method: 'DELETE',
    })
    const payload = (await res.json().catch(() => ({}))) as { error?: string }

    if (!res.ok) {
      setPageError(payload.error ?? 'Failed to delete payment gateway.')
      return
    }

    await loadGateways()
  }

  async function handleSetGlobalGatewayMode(nextStatus: 'Testing' | 'Live') {
    if (!canManageGateways) return
    if (globalModeLoading) return

    const targetGateways = gateways.filter(
      (gateway) => normalizeGatewayStatus(gateway.status) !== 'Inactive' &&
        normalizeGatewayStatus(gateway.status) !== nextStatus
    )

    if (targetGateways.length === 0) {
      return
    }

    if (nextStatus === 'Live' && targetGateways.some((gateway) => !gatewayHasLiveKeys(gateway))) {
      setPageError('Every active gateway needs both live keys before switching all gateways to Live mode.')
      return
    }

    setPageError(null)
    setGlobalModeLoading(true)
    setGlobalGatewayMode(nextStatus)
    mutationVersionRef.current += 1
    suppressBackgroundRefreshRef.current = true
    const previousGateways = gateways

    const optimisticGateways = gateways.map((gateway) => {
      if (normalizeGatewayStatus(gateway.status) === 'Inactive') return gateway
      return { ...gateway, status: nextStatus, lastActiveMode: nextStatus }
    })

    setGateways(optimisticGateways)

    const results = await Promise.all(
      targetGateways.map(async (gateway) => {
        const res = await fetchWithSession(`/api/settings/payment-gateways/${gateway.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: gateway.name,
            minimumDepositAmount: gateway.minimumDepositAmount,
            maximumDepositAmount: gateway.maximumDepositAmount,
            testingPublishableKey: gateway.testingPublishableKey,
            testingSecretKey: gateway.testingSecretKey,
            livePublishableKey: gateway.livePublishableKey,
            liveSecretKey: gateway.liveSecretKey,
            status: nextStatus,
            lastActiveMode: nextStatus,
          }),
        })

        const payload = (await res.json().catch(() => ({}))) as { error?: string }
        return { ok: res.ok, error: payload.error }
      })
    )

    const failedResult = results.find((result) => !result.ok)
    if (failedResult) {
      suppressBackgroundRefreshRef.current = false
      setGateways(previousGateways)
      setGlobalGatewayMode((previousMode) => resolveGlobalGatewayMode(previousGateways, previousMode))
      setPageError(failedResult.error ?? 'Failed to update gateway mode.')
      setGlobalModeLoading(false)
      return
    }

    scheduleGatewayRefresh()
    setGlobalModeLoading(false)
  }

  const filteredGateways = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return gateways

    return gateways.filter((gateway) =>
      [
        gateway.name,
        String(gateway.minimumDepositAmount),
        String(gateway.maximumDepositAmount),
        gateway.testingPublishableKey,
        gateway.testingSecretKey,
        gateway.livePublishableKey,
        gateway.liveSecretKey,
        gateway.status,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    )
  }, [gateways, searchQuery])

  const formTitle = useMemo(
    () => (editingGateway ? 'Edit Payment Gateway' : 'Add Payment Gateway'),
    [editingGateway]
  )

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canManageGateways) {
      setFormError('Only super admin can manage payment gateways.')
      return
    }
    if (submitting) return

    const name = formState.name.trim()
    const minimumDepositAmount = Number(formState.minimumDepositAmount)
    const maximumDepositAmount = Number(formState.maximumDepositAmount)

    if (!name) {
      setFormError('Gateway name is required.')
      return
    }

    if (!Number.isFinite(minimumDepositAmount) || !Number.isFinite(maximumDepositAmount)) {
      setFormError('Deposit amounts must be valid numbers.')
      return
    }

    if (minimumDepositAmount < 0 || maximumDepositAmount < minimumDepositAmount) {
      setFormError('Maximum deposit amount must be greater than or equal to minimum deposit amount.')
      return
    }

    const normalizedStatus = normalizeGatewayStatus(formState.status)
    if (
      normalizedStatus === 'Live' &&
      !gatewayHasLiveKeys({
        livePublishableKey: formState.livePublishableKey,
        liveSecretKey: formState.liveSecretKey,
      })
    ) {
      setFormError('Gateway live publishable key and live secret key are required for Live mode.')
      return
    }

    setSubmitting(true)
    setFormError(null)

    const payload = {
      name,
      minimumDepositAmount,
      maximumDepositAmount,
      testingPublishableKey: formState.testingPublishableKey.trim(),
      testingSecretKey: formState.testingSecretKey.trim(),
      livePublishableKey: formState.livePublishableKey.trim(),
      liveSecretKey: formState.liveSecretKey.trim(),
      status: normalizedStatus,
    }

    const endpoint = editingGateway
      ? `/api/settings/payment-gateways/${editingGateway.id}`
      : '/api/settings/payment-gateways'
    const method = editingGateway ? 'PATCH' : 'POST'

    const res = await fetchWithSession(endpoint, {
      method,
      body: JSON.stringify(payload),
    })

    const responsePayload = (await res.json().catch(() => ({}))) as { gateway?: PaymentGatewayApiRow; error?: string }

    setSubmitting(false)

    if (!res.ok) {
      setFormError(responsePayload.error ?? 'Failed to save payment gateway.')
      return
    }

    closeModal()
    await loadGateways()
  }

  return (
    <div className={`${plusJakarta.className} flex w-full flex-col text-white`}>
      <div className="w-full pb-6">
        <div className="flex w-full flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-black leading-tight text-white sm:text-3xl">Payment Gateways</h1>
            <p className="mt-2 text-sm font-normal leading-5 text-slate-400">
              Manage payment gateway limits and keys from one place.
            </p>
          </div>
          {canManageGateways && (
            <div className="flex shrink-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={openCreateModal}
                className="flex h-12 min-w-36 shrink-0 items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 shadow-[0px_4px_20px_0px_rgba(249,115,22,0.2)] transition hover:bg-orange-600"
              >
                <PlusIcon className="h-4 w-3 text-white" />
                <span className="text-sm font-bold text-white">Add Gateway</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {!canViewGateways ? (
        <div className="rounded-xl border border-slate-700 bg-slate-800/80 px-6 py-5 text-sm text-slate-400">
          Payment gateway settings are restricted to admin users.
        </div>
      ) : (
        <>
          {pageError ? (
            <div className="w-full pb-6">
              <div className="message-fade-slide-in rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-300 sm:px-6">
                {pageError}
              </div>
            </div>
          ) : null}

          <div className="w-full pb-6">
            <div className="flex w-full flex-col gap-4 rounded-xl border border-slate-700 bg-slate-800/80 p-4 sm:flex-row sm:gap-4 sm:p-6">
              <div className="min-w-0 flex-1">
                <div className="flex h-12 w-full items-center gap-3 overflow-hidden rounded-xl border border-slate-700 bg-slate-900/50 pl-4">
                  <SearchIcon className="h-4 w-4 shrink-0 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, status, amount or gateway key..."
                    className="h-full min-w-0 flex-1 bg-transparent pr-4 text-sm text-slate-300 placeholder:text-slate-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-800/80">
            <div className="w-full overflow-x-auto scrollbar-thin">
              <div className="min-w-[1660px]">
                <div className="grid grid-cols-[1fr_190px_190px_1.65fr_1.65fr_1.65fr_1.65fr_110px_190px] border-b border-slate-700 bg-slate-900/50">
                  {[
                    'Name',
                    'Minimum Deposit Amount',
                    'Maximum Deposit Amount',
                    'Gateway Testing Key Publishable key',
                    'Gateway Testing Key Secret key',
                    'Gateway Live Key Publishable key',
                    'Gateway Live Key Secret key',
                    'Status',
                    'Action',
                  ].map((label) => (
                    <div key={label} className="flex min-w-0 items-center px-4 py-4 sm:px-6">
                      <span className="block truncate whitespace-nowrap text-xs font-bold uppercase tracking-wide text-slate-400">
                        {label}
                      </span>
                    </div>
                  ))}
                </div>

                {gatewaysLoading ? (
                  <div className="px-4 py-12 text-center text-sm text-slate-400">Loading payment gateways...</div>
                ) : filteredGateways.length === 0 ? (
                  <div className="px-4 py-12 text-center text-sm text-slate-400">
                    {searchQuery.trim() ? 'No matching gateways found.' : 'No payment gateways configured yet.'}
                  </div>
                ) : (
                  filteredGateways.map((gateway) => (
                    <div
                      key={gateway.id}
                      className="grid grid-cols-[1fr_190px_190px_1.65fr_1.65fr_1.65fr_1.65fr_110px_190px] items-center border-t border-slate-700"
                    >
                      <div className="min-w-0 px-4 py-4 sm:px-6">
                        <span className="block truncate whitespace-nowrap text-sm font-semibold text-white" title={gateway.name}>
                          {gateway.name}
                        </span>
                      </div>
                      <div className="min-w-0 px-4 py-4 text-sm text-slate-300 sm:px-6">
                        {gateway.minimumDepositAmount}
                      </div>
                      <div className="min-w-0 px-4 py-4 text-sm text-slate-300 sm:px-6">
                        {gateway.maximumDepositAmount}
                      </div>
                      <div className="min-w-0 px-4 py-4 sm:px-6">
                        <span
                          className="block truncate whitespace-nowrap text-sm text-slate-300"
                          title={gateway.testingPublishableKey || '--'}
                        >
                          {maskGatewayKey(gateway.testingPublishableKey)}
                        </span>
                      </div>
                      <div className="min-w-0 px-4 py-4 sm:px-6">
                        <span
                          className="block truncate whitespace-nowrap text-sm text-slate-300"
                          title={gateway.testingSecretKey || '--'}
                        >
                          {maskGatewayKey(gateway.testingSecretKey)}
                        </span>
                      </div>
                      <div className="min-w-0 px-4 py-4 sm:px-6">
                        <span
                          className="block truncate whitespace-nowrap text-sm text-slate-300"
                          title={gateway.livePublishableKey || '--'}
                        >
                          {maskGatewayKey(gateway.livePublishableKey)}
                        </span>
                      </div>
                      <div className="min-w-0 px-4 py-4 sm:px-6">
                        <span
                          className="block truncate whitespace-nowrap text-sm text-slate-300"
                          title={gateway.liveSecretKey || '--'}
                        >
                          {maskGatewayKey(gateway.liveSecretKey)}
                        </span>
                      </div>
                      <div className="min-w-0 px-4 py-4 sm:px-6">
                        <span
                          className={`inline-block max-w-full truncate whitespace-nowrap rounded-lg border px-2 py-1 text-xs font-medium ${getGatewayStatusStyle(gateway.status)}`}
                          title={gateway.status}
                        >
                          {normalizeGatewayStatus(gateway.status)}
                        </span>
                      </div>
                      <div className="flex justify-end gap-1 px-4 py-4 sm:px-6">
                        <button
                          type="button"
                          onClick={() => void handleToggleGatewayMode(gateway)}
                          disabled={!canManageGateways}
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-700/50 hover:text-amber-400"
                          aria-label={`Switch ${gateway.name} mode`}
                          title={`Switch ${gateway.name} between live and testing`}
                        >
                          <ArrowsRightLeftIcon />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleToggleGatewayEnabled(gateway)}
                          disabled={!canManageGateways}
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-700/50 hover:text-emerald-400"
                          aria-label={`${normalizeGatewayStatus(gateway.status) === 'Inactive' ? 'Enable' : 'Disable'} ${gateway.name}`}
                          title={`${normalizeGatewayStatus(gateway.status) === 'Inactive' ? 'Enable' : 'Disable'} ${gateway.name}`}
                        >
                          <PowerIcon />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(gateway)}
                          disabled={!canManageGateways}
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-700/50 hover:text-blue-400"
                          aria-label={`Edit ${gateway.name}`}
                          title={`Edit ${gateway.name}`}
                        >
                          <PencilIcon />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteGateway(gateway)}
                          disabled={!canManageGateways}
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-700/50 hover:text-rose-400"
                          aria-label={`Delete ${gateway.name}`}
                          title={`Delete ${gateway.name}`}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex w-full items-center justify-between border-t border-slate-700 bg-slate-900/50 px-4 py-4 sm:px-6">
              <p className="text-sm text-slate-400">
                {gatewaysLoading
                  ? 'Loading...'
                  : `Showing ${filteredGateways.length} of ${gateways.length} gateways`}
              </p>
            </div>
          </div>

          {canManageGateways ? (
            <div className="pointer-events-none fixed bottom-4 left-0 right-0 z-20 sm:bottom-6">
              <div className="mx-6 flex justify-end sm:mx-8">
                <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/85 px-3 py-2 shadow-[0px_14px_34px_rgba(2,6,23,0.32)] backdrop-blur">
                  <button
                    type="button"
                    onClick={() => void handleSetGlobalGatewayMode('Testing')}
                    disabled={globalModeLoading || globalGatewayMode === 'Testing'}
                    className={`rounded-md px-2 py-1 text-xs font-black uppercase tracking-[0.16em] transition ${
                      globalGatewayMode === 'Testing'
                        ? 'bg-slate-700 text-white'
                        : 'bg-slate-800/70 text-slate-400 hover:bg-slate-700/80 hover:text-slate-200'
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    Test
                  </button>
                  <label className="relative inline-block h-6 w-10">
                    <input
                      type="checkbox"
                      checked={globalGatewayMode === 'Live'}
                      onChange={() => void handleSetGlobalGatewayMode(globalGatewayMode === 'Live' ? 'Testing' : 'Live')}
                      disabled={globalModeLoading}
                      className="peer sr-only"
                      aria-label={`Switch global gateway mode to ${globalGatewayMode === 'Live' ? 'Testing' : 'Live'}`}
                    />
                    <span className="absolute inset-0 cursor-pointer rounded-full border border-orange-400/70 bg-orange-500 shadow-[inset_0_-2px_6px_rgba(0,0,0,0.18),0px_4px_12px_rgba(249,115,22,0.16)] transition peer-disabled:cursor-not-allowed peer-disabled:opacity-60" />
                    <span className="pointer-events-none absolute bottom-1 left-1 h-4 w-4 rounded-full bg-white shadow-[0px_3px_8px_rgba(15,23,42,0.2)] transition-transform duration-300 ease-out peer-checked:translate-x-4" />
                  </label>
                  <button
                    type="button"
                    onClick={() => void handleSetGlobalGatewayMode('Live')}
                    disabled={globalModeLoading || globalGatewayMode === 'Live'}
                    className={`rounded-md px-2 py-1 text-xs font-black uppercase tracking-[0.16em] transition ${
                      globalGatewayMode === 'Live'
                        ? 'bg-slate-700 text-white'
                        : 'bg-slate-800/70 text-slate-400 hover:bg-slate-700/80 hover:text-slate-200'
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    Live
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="relative w-full max-w-[640px]" onClick={(e) => e.stopPropagation()}>
            <div className="rounded-[26px] border border-slate-700 bg-[#0f172b] p-6 shadow-[0_30px_80px_rgba(2,6,23,0.72)] sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-[18px] font-semibold text-white sm:text-[20px]">{formTitle}</h2>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="rounded-full border border-orange-500/30 bg-orange-500/10 p-1.5 text-orange-400 transition hover:bg-orange-500/20 hover:text-orange-300 disabled:opacity-50"
                  aria-label="Close modal"
                >
                  <CloseIcon />
                </button>
              </div>

              <form
                onSubmit={handleSubmit}
                onInvalidCapture={handleRequiredFieldInvalid}
                onInputCapture={clearRequiredFieldInvalid}
                onChangeCapture={clearRequiredFieldInvalid}
                className="mt-6 space-y-4"
              >
                <div>
                  <label htmlFor="gateway-name" className="block text-[13px] font-medium text-slate-300">
                    Name
                  </label>
                  <input
                    id="gateway-name"
                    type="text"
                    required
                    value={formState.name}
                    onChange={(e) => setFormState((current) => ({ ...current, name: e.target.value }))}
                    className="mt-2 h-11 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-4 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
                  />
                </div>

                <div>
                  <label htmlFor="gateway-minimum-deposit" className="block text-[13px] font-medium text-slate-300">
                    Minimum Deposit Amount
                  </label>
                  <input
                    id="gateway-minimum-deposit"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formState.minimumDepositAmount}
                    onChange={(e) => setFormState((current) => ({ ...current, minimumDepositAmount: e.target.value }))}
                    className="mt-2 h-11 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-4 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
                  />
                </div>

                <div>
                  <label htmlFor="gateway-status" className="block text-[13px] font-medium text-slate-300">
                    Status
                  </label>
                  <select
                    id="gateway-status"
                    value={normalizeGatewayStatus(formState.status)}
                    onChange={(e) => setFormState((current) => ({ ...current, status: e.target.value }))}
                    className="mt-2 h-11 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-4 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
                  >
                    <option value="Testing">Testing</option>
                    <option value="Live">Live</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="gateway-maximum-deposit" className="block text-[13px] font-medium text-slate-300">
                    Maximum Deposit Amount
                  </label>
                  <input
                    id="gateway-maximum-deposit"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formState.maximumDepositAmount}
                    onChange={(e) => setFormState((current) => ({ ...current, maximumDepositAmount: e.target.value }))}
                    className="mt-2 h-11 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-4 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
                  />
                </div>

                <div>
                  <label htmlFor="gateway-testing-publishable" className="block text-[13px] font-medium text-slate-300">
                    Gateway Testing Key Publishable key
                  </label>
                  <input
                    id="gateway-testing-publishable"
                    type="text"
                    required
                    value={formState.testingPublishableKey}
                    onChange={(e) => setFormState((current) => ({ ...current, testingPublishableKey: e.target.value }))}
                    className="mt-2 h-11 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-4 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
                  />
                </div>

                <div>
                  <label htmlFor="gateway-testing-secret" className="block text-[13px] font-medium text-slate-300">
                    Gateway Testing Key Secret key
                  </label>
                  <input
                    id="gateway-testing-secret"
                    type="text"
                    required
                    value={formState.testingSecretKey}
                    onChange={(e) => setFormState((current) => ({ ...current, testingSecretKey: e.target.value }))}
                    className="mt-2 h-11 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-4 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
                  />
                </div>

                <div>
                  <label htmlFor="gateway-live-publishable" className="block text-[13px] font-medium text-slate-300">
                    Gateway live Key Publishable key
                  </label>
                  <input
                    id="gateway-live-publishable"
                    type="text"
                    value={formState.livePublishableKey}
                    onChange={(e) => setFormState((current) => ({ ...current, livePublishableKey: e.target.value }))}
                    className="mt-2 h-11 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-4 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
                  />
                </div>

                <div>
                  <label htmlFor="gateway-live-secret" className="block text-[13px] font-medium text-slate-300">
                    Gateway live Key Secret key
                  </label>
                  <input
                    id="gateway-live-secret"
                    type="text"
                    value={formState.liveSecretKey}
                    onChange={(e) => setFormState((current) => ({ ...current, liveSecretKey: e.target.value }))}
                    className="mt-2 h-11 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-4 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
                  />
                </div>

                {formError && (
                  <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                    {formError}
                  </p>
                )}

                <div className="flex items-center justify-end pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-[0px_4px_20px_0px_rgba(249,115,22,0.2)] transition hover:bg-orange-600 disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : 'Submit'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
