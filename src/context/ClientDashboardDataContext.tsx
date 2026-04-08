'use client'

import { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useDashboardProfile } from '@/components/DashboardLayout'
import { logFetchError } from '@/lib/fetch-error'

export type ClientRow = {
  id: number
  name?: string
  email?: string
}

export type InvoiceRow = {
  id: number
  invoice_date?: string | null
  status?: string | null
  amount?: string | number | null
  payable_amount?: number | string | null
  email?: string | null
}

export type PaymentRow = {
  id: number
  invoice_id?: number | null
  amount?: string | number | null
  created_at?: string | null
  status?: string | null
  email?: string | null
}

type ClientDashboardData = {
  client: ClientRow | null
  clientEmail: string
  clientBrandName: string | null
  invoices: InvoiceRow[]
  payments: PaymentRow[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const ClientDashboardDataContext = createContext<ClientDashboardData | null>(null)
const TABLE_REFRESH_INTERVAL_MS = 5000

export function useClientDashboardData() {
  const ctx = useContext(ClientDashboardDataContext)
  return ctx
}

export function ClientDashboardDataProvider({ children }: { children: React.ReactNode }) {
  const { accountType } = useDashboardProfile()
  const [client, setClient] = useState<ClientRow | null>(null)
  const [clientEmail, setClientEmail] = useState('')
  const [clientBrandName, setClientBrandName] = useState<string | null>(null)
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasFetched, setHasFetched] = useState(false)
  const hasFetchedRef = useRef(false)
  const isFetchingRef = useRef(false)
  const queuedRefreshRef = useRef(false)
  const loadDataRef = useRef<((options?: { background?: boolean }) => Promise<void>) | null>(null)

  const markFetched = useCallback(() => {
    if (hasFetchedRef.current) return
    hasFetchedRef.current = true
    setHasFetched(true)
  }, [])

  const loadData = useCallback(async (options?: { background?: boolean }) => {
    if (accountType !== 'client') return

    if (isFetchingRef.current) {
      queuedRefreshRef.current = true
      return
    }

    const isBackgroundRefresh = options?.background ?? hasFetchedRef.current
    isFetchingRef.current = true

    if (!isBackgroundRefresh) {
      setLoading(true)
      setError(null)
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      if (!isBackgroundRefresh) {
        setError('Unable to load your account.')
        setLoading(false)
      }
      markFetched()
      isFetchingRef.current = false

      if (queuedRefreshRef.current) {
        queuedRefreshRef.current = false
        void loadDataRef.current?.({ background: true })
      }

      return
    }

    const authEmail = (user.email ?? '').trim()
    const email = authEmail
    setClientEmail(email)

    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('id, name, email')
      .eq('status', 'approved')
      .neq('isdeleted', true)
      .or(`handler_id.eq.${user.id},email.eq.${email}`)
      .maybeSingle()

    if (clientError) {
      logFetchError('Failed to load client profile', clientError)
      if (!isBackgroundRefresh) {
        setError(clientError.message)
        setLoading(false)
      }
      markFetched()
      isFetchingRef.current = false

      if (queuedRefreshRef.current) {
        queuedRefreshRef.current = false
        void loadDataRef.current?.({ background: true })
      }

      return
    }

    const clientRow = (clientData as ClientRow | null) ?? null
    setClient(clientRow)

    let invoiceRows: InvoiceRow[] = []

    if (clientRow?.id) {
      const { data: invoiceByClient, error: clientInvoiceError } = await supabase
        .from('invoices')
        .select('id, invoice_date, status, amount, payable_amount, email')
        .eq('client_id', clientRow.id)
        .order('created_at', { ascending: false })

      if (!clientInvoiceError && invoiceByClient?.length) {
        invoiceRows = invoiceByClient as InvoiceRow[]
      }
      if (clientInvoiceError) {
        logFetchError('Failed to load invoices', clientInvoiceError)
      }
    }
    setClientBrandName(null)
    setInvoices(invoiceRows)

    const invoiceIds = invoiceRows.map((inv) => inv.id).filter((id) => Number.isFinite(id))

    let paymentData: Array<{
      id: number
      invoice_id?: number | null
      amount_paid?: number | string | null
      payment_status?: string | null
      created_at?: string | null
      email?: string | null
    }> = []

    if (invoiceIds.length > 0) {
      const { data, error: paymentError } = await supabase
        .from('payment_submissions')
        .select('id, invoice_id, amount_paid, payment_status, created_at, email')
        .in('invoice_id', invoiceIds)
        .order('created_at', { ascending: false })

      if (paymentError) {
        logFetchError('Failed to load payments', paymentError)
      }
      paymentData = (data ?? []) as typeof paymentData
    } else {
      const { data, error: paymentError } = await supabase
        .from('payment_submissions')
        .select('id, invoice_id, amount_paid, payment_status, created_at, email')
        .ilike('email', email)
        .order('created_at', { ascending: false })

      if (paymentError) {
        logFetchError('Failed to load payments', paymentError)
      }
      paymentData = (data ?? []) as typeof paymentData
    }

    const mappedPayments: PaymentRow[] = (paymentData as Array<{
      id: number
      invoice_id?: number | null
      amount_paid?: number | string | null
      payment_status?: string | null
      created_at?: string | null
      email?: string | null
    }>).map((p) => ({
      id: p.id,
      invoice_id: p.invoice_id,
      amount: p.amount_paid,
      created_at: p.created_at,
      status: p.payment_status,
      email: p.email,
    }))

    setPayments(mappedPayments)
    markFetched()
    setError(null)

    if (!isBackgroundRefresh) {
      setLoading(false)
    }

    isFetchingRef.current = false

    if (queuedRefreshRef.current) {
      queuedRefreshRef.current = false
      void loadDataRef.current?.({ background: true })
    }
  }, [accountType, markFetched])

  useEffect(() => {
    loadDataRef.current = loadData
  }, [loadData])

  useEffect(() => {
    if (accountType !== 'client') return

    if (!hasFetched) {
      const timeoutId = window.setTimeout(() => {
        void loadData()
      }, 0)

      return () => {
        window.clearTimeout(timeoutId)
      }
    }
  }, [accountType, hasFetched, loadData])

  useEffect(() => {
    if (accountType !== 'client' || !hasFetched) return

    const refresh = () => {
      void loadData({ background: true })
    }

    const intervalId = window.setInterval(() => {
      refresh()
    }, TABLE_REFRESH_INTERVAL_MS)

    const channelName = `client-dashboard-sync-${client?.id ?? 'unknown'}`
    const channel = supabase.channel(channelName)

    if (client?.id != null) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invoices',
          filter: `client_id=eq.${client.id}`,
        },
        refresh
      )
    }

    if (clientEmail) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payment_submissions',
          filter: `email=eq.${clientEmail}`,
        },
        refresh
      )
    }

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        refresh()
      }
    })

    return () => {
      window.clearInterval(intervalId)
      void supabase.removeChannel(channel)
    }
  }, [accountType, client?.id, clientEmail, hasFetched, loadData])

  const refetch = useCallback(async () => {
    if (accountType !== 'client') return
    await loadData({ background: true })
  }, [accountType, loadData])

  const value: ClientDashboardData = {
    client,
    clientEmail,
    clientBrandName,
    invoices,
    payments,
    loading,
    error,
    refetch,
  }

  return (
    <ClientDashboardDataContext.Provider value={value}>
      {children}
    </ClientDashboardDataContext.Provider>
  )
}

