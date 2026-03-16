'use client'

import { createContext, useContext, useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useDashboardProfile } from '@/components/DashboardLayout'

export type ClientRow = {
  id: number
  name?: string
  email?: string
  brand_id?: number | null
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

  const loadData = useCallback(async () => {
    if (accountType !== 'client') return

    setLoading(true)
    setError(null)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      setError('Unable to load your account.')
      setLoading(false)
      return
    }

    const authEmail = (user.email ?? '').trim()
    const email = authEmail
    setClientEmail(email)

    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('id, name, email, brand_id')
      .eq('email', email)
      .maybeSingle()

    if (clientError) {
      console.error('Failed to load client profile', clientError)
      setError(clientError.message)
      setLoading(false)
      return
    }

    const clientRow = (clientData as ClientRow | null) ?? null
    setClient(clientRow)

    let invoiceRows: InvoiceRow[] = []

    if (clientRow?.brand_id) {
      const { data: brandData } = await supabase
        .from('brands')
        .select('brand_name')
        .eq('id', clientRow.brand_id)
        .maybeSingle()

      const brandName = (brandData as { brand_name?: string } | null)?.brand_name
      setClientBrandName(brandName ?? null)
      if (brandName) {
        const { data: invoiceByBrand, error: brandInvoiceError } = await supabase
          .from('invoices')
          .select('id, invoice_date, status, amount, payable_amount, email')
          .eq('brand_name', brandName)
          .order('created_at', { ascending: false })

        if (!brandInvoiceError && invoiceByBrand?.length) {
          invoiceRows = invoiceByBrand as InvoiceRow[]
        }
        if (brandInvoiceError) {
          console.error('Failed to load invoices', brandInvoiceError.message)
        }
      }
    } else {
      setClientBrandName(null)
    }
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
        console.error('Failed to load payments', paymentError.message)
      }
      paymentData = (data ?? []) as typeof paymentData
    } else {
      const { data, error: paymentError } = await supabase
        .from('payment_submissions')
        .select('id, invoice_id, amount_paid, payment_status, created_at, email')
        .ilike('email', email)
        .order('created_at', { ascending: false })

      if (paymentError) {
        console.error('Failed to load payments', paymentError.message)
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
    setLoading(false)
    setHasFetched(true)
  }, [accountType])

  useEffect(() => {
    if (accountType !== 'client') {
      setLoading(false)
      return
    }
    if (!hasFetched) {
      void loadData()
    }
  }, [accountType, hasFetched, loadData])

  const refetch = useCallback(async () => {
    if (accountType !== 'client') return
    await loadData()
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
