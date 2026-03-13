'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { supabase } from '@/lib/supabase'
import { useDashboardProfile } from '@/components/DashboardLayout'

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
}

type GatewayFormState = {
  name: string
  minimumDepositAmount: string
  maximumDepositAmount: string
  testingPublishableKey: string
  testingSecretKey: string
  livePublishableKey: string
  liveSecretKey: string
}

const EMPTY_FORM: GatewayFormState = {
  name: '',
  minimumDepositAmount: '',
  maximumDepositAmount: '',
  testingPublishableKey: '',
  testingSecretKey: '',
  livePublishableKey: '',
  liveSecretKey: '',
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

function CloseIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

function mapGatewayRow(row: PaymentGatewayApiRow): PaymentGatewayRow {
  return {
    id: row.id,
    name: row.name,
    minimumDepositAmount: Number(row.minimum_deposit_amount ?? 0),
    maximumDepositAmount: Number(row.maximum_deposit_amount ?? 0),
    testingPublishableKey: row.testing_publishable_key?.trim() || '',
    testingSecretKey: row.testing_secret_key?.trim() || '',
    livePublishableKey: row.live_publishable_key?.trim() || '',
    liveSecretKey: row.live_secret_key?.trim() || '',
    status: row.status?.trim() || 'Active',
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
  }
}

function maskGatewayKey(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return '--'
  return trimmed.length > 18 ? `${trimmed.slice(0, 18)}...` : trimmed
}

function getGatewayStatusStyle(status: string): string {
  const normalized = status.trim().toLowerCase()
  if (normalized === 'active') return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
  if (normalized === 'inactive') return 'border-rose-500/20 bg-rose-500/10 text-rose-400'
  return 'border-slate-500/20 bg-slate-500/10 text-slate-400'
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
  const { displayRole } = useDashboardProfile()
  const normalizedRole = (displayRole || '').trim().toLowerCase().replace(/\s+/g, '')
  const canManageGateways = normalizedRole === 'superadmin' || normalizedRole === 'admin'

  const [gateways, setGateways] = useState<PaymentGatewayRow[]>([])
  const [gatewaysLoading, setGatewaysLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingGateway, setEditingGateway] = useState<PaymentGatewayRow | null>(null)
  const [formState, setFormState] = useState<GatewayFormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const loadGateways = useCallback(async () => {
    if (!canManageGateways) {
      setGateways([])
      setGatewaysLoading(false)
      return
    }

    setGatewaysLoading(true)
    setPageError(null)

    const res = await fetchWithSession('/api/settings/payment-gateways')
    const payload = (await res.json().catch(() => ({}))) as { gateways?: PaymentGatewayApiRow[]; error?: string }

    if (!res.ok) {
      setPageError(payload.error ?? 'Failed to load payment gateways.')
      setGateways([])
      setGatewaysLoading(false)
      return
    }

    setGateways((payload.gateways ?? []).map(mapGatewayRow))
    setGatewaysLoading(false)
  }, [canManageGateways])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadGateways()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadGateways])

  function openCreateModal() {
    setEditingGateway(null)
    setFormState(EMPTY_FORM)
    setFormError(null)
    setModalOpen(true)
  }

  function openEditModal(gateway: PaymentGatewayRow) {
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
      status: editingGateway?.status ?? 'Active',
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
            <button
              type="button"
              onClick={openCreateModal}
              className="flex h-12 min-w-36 shrink-0 items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 shadow-[0px_4px_20px_0px_rgba(249,115,22,0.2)] transition hover:bg-orange-600"
            >
              <PlusIcon className="h-4 w-3 text-white" />
              <span className="text-sm font-bold text-white">Add Gateway</span>
            </button>
          )}
        </div>
      </div>

      {!canManageGateways ? (
        <div className="rounded-xl border border-slate-700 bg-slate-800/80 px-6 py-5 text-sm text-slate-400">
          Payment gateway settings are restricted to admin users.
        </div>
      ) : (
        <>
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
              <div className="min-w-[1520px]">
                <div className="grid grid-cols-[1fr_190px_190px_1.65fr_1.65fr_1.65fr_1.65fr_90px_72px] border-b border-slate-700 bg-slate-900/50">
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
                ) : pageError ? (
                  <div className="px-4 py-12 text-center text-sm text-rose-400">{pageError}</div>
                ) : filteredGateways.length === 0 ? (
                  <div className="px-4 py-12 text-center text-sm text-slate-400">
                    {searchQuery.trim() ? 'No matching gateways found.' : 'No payment gateways configured yet.'}
                  </div>
                ) : (
                  filteredGateways.map((gateway) => (
                    <div
                      key={gateway.id}
                      className="grid grid-cols-[1fr_190px_190px_1.65fr_1.65fr_1.65fr_1.65fr_90px_72px] items-center border-t border-slate-700"
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
                          {gateway.status}
                        </span>
                      </div>
                      <div className="flex justify-end px-4 py-4 sm:px-6">
                        <button
                          type="button"
                          onClick={() => openEditModal(gateway)}
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-700/50 hover:text-blue-400"
                          aria-label={`Edit ${gateway.name}`}
                          title={`Edit ${gateway.name}`}
                        >
                          <PencilIcon />
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

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
