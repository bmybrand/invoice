'use client'

import { useMemo } from 'react'
import { useClientDashboardData } from '@/context/ClientDashboardDataContext'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  BarChart,
  Bar,
} from 'recharts'

type ClientRow = {
  id: number
  name?: string
  email?: string
  brand_id?: number | null
}

type InvoiceRow = {
  id: number
  invoice_date?: string | null
  status?: string | null
  amount?: string | number | null
  payable_amount?: number | string | null
  email?: string | null
}

type PaymentRow = {
  id: number
  invoice_id?: number | null
  amount?: string | number | null
  created_at?: string | null
  status?: string | null
  email?: string | null
}

type DashboardStats = {
  totalInvoices: number
  paidInvoices: number
  pendingInvoices: number
  overdueInvoices: number
  totalDue: number
  totalPaid: number
}

type NotificationItem = {
  id: string
  title: string
  description: string
  tone: 'orange' | 'blue' | 'green' | 'red'
}

type MonthlyPoint = {
  month: string
  paid: number
}

type StatusPoint = {
  name: string
  value: number
}

function formatCurrency(value: number) {
  return `$ ${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function normalizeStatus(status: string | null | undefined) {
  const value = String(status ?? '').trim().toLowerCase()

  if (value.includes('paid') || value.includes('complete')) return 'paid'
  if (value.includes('overdue')) return 'overdue'
  if (value.includes('pending') || value.includes('unpaid')) return 'pending'
  if (value.includes('partial')) return 'pending'

  return value || 'unknown'
}

function amountToNumber(value: string | number | null | undefined) {
  if (typeof value === 'number') return value
  return Number(String(value ?? '0').replace(/[^0-9.-]/g, '')) || 0
}

function getInvoiceAmount(invoice: InvoiceRow): number {
  const payable = invoice.payable_amount
  if (payable != null && payable !== '') {
    return amountToNumber(payable)
  }
  return amountToNumber(invoice.amount)
}

function formatDate(value?: string | null) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function daysUntil(dateString?: string | null) {
  if (!dateString) return null
  const today = new Date()
  const due = new Date(dateString)
  if (Number.isNaN(due.getTime())) return null

  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const startDue = new Date(due.getFullYear(), due.getMonth(), due.getDate())

  return Math.round((startDue.getTime() - startToday.getTime()) / (1000 * 60 * 60 * 24))
}

export default function ClientDashboardPage() {
  const { client, clientEmail, invoices, payments, loading, error, refetch } =
    useClientDashboardData() ?? {
      client: null,
      clientEmail: '',
      invoices: [] as InvoiceRow[],
      payments: [] as PaymentRow[],
      loading: true,
      error: null,
      refetch: async () => {},
    }

  const stats = useMemo<DashboardStats>(() => {
    const today = new Date()

    let totalDue = 0
    let paidInvoices = 0
    let pendingInvoices = 0
    let overdueInvoices = 0

    invoices.forEach((invoice) => {
      const status = normalizeStatus(invoice.status)
      const amount = getInvoiceAmount(invoice)
      const dueDate = invoice.invoice_date ? new Date(invoice.invoice_date) : null
      const isOverdue =
        status !== 'paid' &&
        dueDate &&
        !Number.isNaN(dueDate.getTime()) &&
        dueDate.getTime() < today.getTime()

      if (status === 'paid') {
        paidInvoices += 1
      } else if (isOverdue || status === 'overdue') {
        overdueInvoices += 1
        totalDue += amount
      } else {
        pendingInvoices += 1
        totalDue += amount
      }
    })

    const totalPaid = payments.reduce((sum, p) => sum + amountToNumber(p.amount), 0)

    return {
      totalInvoices: invoices.length,
      paidInvoices,
      pendingInvoices,
      overdueInvoices,
      totalDue,
      totalPaid,
    }
  }, [invoices, payments])

  const recentInvoices = useMemo(() => {
    return [...invoices]
      .sort((a, b) => {
        const aTime = new Date(a.invoice_date ?? '').getTime() || 0
        const bTime = new Date(b.invoice_date ?? '').getTime() || 0
        return bTime - aTime
      })
      .slice(0, 6)
  }, [invoices])

  const recentPayments = useMemo(() => {
    return [...payments]
      .sort((a, b) => {
        const aTime = new Date(a.created_at ?? '').getTime() || 0
        const bTime = new Date(b.created_at ?? '').getTime() || 0
        return bTime - aTime
      })
      .slice(0, 5)
  }, [payments])

  const notifications = useMemo<NotificationItem[]>(() => {
    const items: NotificationItem[] = []

    const overdue = invoices.filter((invoice) => {
      const status = normalizeStatus(invoice.status)
      if (status === 'paid') return false
      const diff = daysUntil(invoice.invoice_date)
      return diff !== null && diff < 0
    })

    const dueSoon = invoices.filter((invoice) => {
      const status = normalizeStatus(invoice.status)
      if (status === 'paid') return false
      const diff = daysUntil(invoice.invoice_date)
      return diff !== null && diff >= 0 && diff <= 7
    })

    if (overdue.length > 0) {
      items.push({
        id: 'overdue',
        title: `${overdue.length} overdue invoice${overdue.length > 1 ? 's' : ''}`,
        description: 'Please review overdue balances and complete payment as soon as possible.',
        tone: 'red',
      })
    }

    if (dueSoon.length > 0) {
      items.push({
        id: 'due-soon',
        title: `${dueSoon.length} invoice${dueSoon.length > 1 ? 's are' : ' is'} due soon`,
        description: 'You have upcoming payment deadlines within the next 7 days.',
        tone: 'orange',
      })
    }

    if (recentPayments.length > 0) {
      items.push({
        id: 'payment-received',
        title: 'Recent payment activity available',
        description: 'Your latest payment records and receipts are ready to review.',
        tone: 'green',
      })
    }

    if (!items.length) {
      items.push({
        id: 'all-clear',
        title: 'Everything looks good',
        description: 'No urgent invoice alerts at the moment.',
        tone: 'blue',
      })
    }

    return items.slice(0, 4)
  }, [invoices, recentPayments])

  const statusChartData = useMemo<StatusPoint[]>(() => {
    return [
      { name: 'Paid', value: stats.paidInvoices },
      { name: 'Pending', value: stats.pendingInvoices },
      { name: 'Overdue', value: stats.overdueInvoices },
    ]
  }, [stats])

  const pieChartData = useMemo(() => {
    const total = stats.paidInvoices + stats.pendingInvoices + stats.overdueInvoices
    if (total === 0) {
      return [{ name: 'No data', value: 1 }]
    }
    return statusChartData
  }, [statusChartData, stats])

  const monthlyPaidData = useMemo<MonthlyPoint[]>(() => {
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
    const currentYear = new Date().getFullYear()

    return months.map((monthLabel, index) => {
      const monthNumber = index + 1
      const total = payments.reduce((sum, payment) => {
        const date = payment.created_at ? new Date(payment.created_at) : null
        if (!date || Number.isNaN(date.getTime())) return sum
        if (date.getFullYear() !== currentYear || date.getMonth() + 1 !== monthNumber) return sum
        return sum + amountToNumber(payment.amount)
      }, 0)

      return {
        month: monthLabel,
        paid: Number(total.toFixed(2)),
      }
    })
  }, [payments])

  const accountName = client?.name?.trim() || clientEmail || 'Client'

  if (loading) {
    return (
      <div className="flex min-h-[400px] w-full items-center justify-center py-16  ">
        <div className="relative">
          <div
            className="h-20 w-20 animate-spin rounded-full border-4 border-transparent border-t-orange-500"
            style={{ boxShadow: '0 0 24px rgba(249, 115, 22, 0.4)' }}
            role="status"
            aria-label="Loading"
          />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-[32px] border border-red-500/30 bg-red-500/10 p-8">
          <h1 className="text-xl font-black text-white">Unable to load dashboard</h1>
          <p className="mt-2 text-sm text-red-300">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col gap-4 sm:gap-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-black leading-tight text-white sm:text-2xl md:text-3xl lg:text-4xl">
            Welcome back, {accountName}
          </h1>
          <p className="mt-1 text-xs font-medium leading-5 text-slate-500 sm:text-sm md:text-base md:leading-6">
            Your private client portal for invoices, payments, receipts, and account updates.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refetch()}
          className="shrink-0 rounded-xl border border-slate-800 bg-slate-900 p-3"
          aria-label="Refresh"
        >
          <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-6">
        <div className="rounded-2xl border border-slate-800 bg-linear-to-b from-slate-900 to-gray-900 p-4 sm:rounded-3xl sm:p-6">
          <div className="flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-3.866 0-7 1.79-7 4s3.134 4 7 4 7-1.79 7-4-3.134-4-7-4zm0 0V4m0 12v4" />
              </svg>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[2px] text-slate-500">Amount Due</p>
          </div>
          <p className="mt-4 text-2xl font-black text-white sm:text-3xl">{formatCurrency(stats.totalDue)}</p>
          <p className="mt-2 text-xs text-slate-500">Outstanding unpaid balance across pending and overdue invoices.</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-linear-to-b from-slate-900 to-gray-900 p-4 sm:rounded-3xl sm:p-6">
          <div className="flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75h9A2.25 2.25 0 0118.75 6v12A2.25 2.25 0 0116.5 20.25h-9A2.25 2.25 0 015.25 18V6A2.25 2.25 0 017.5 3.75z" />
              </svg>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[2px] text-slate-500">Invoices</p>
          </div>
          <p className="mt-4 text-2xl font-black text-white sm:text-3xl">{stats.totalInvoices}</p>
          <p className="mt-2 text-xs text-slate-500">Total invoices assigned to your account.</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-linear-to-b from-slate-900 to-gray-900 p-4 sm:rounded-3xl sm:p-6">
          <div className="flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m6 2.25A9 9 0 113 12a9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[2px] text-slate-500">Paid</p>
          </div>
          <p className="mt-4 text-2xl font-black text-white sm:text-3xl">{formatCurrency(stats.totalPaid)}</p>
          <p className="mt-2 text-xs text-slate-500">{stats.paidInvoices} invoice{stats.paidInvoices !== 1 ? 's' : ''} paid successfully.</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-linear-to-b from-slate-900 to-gray-900 p-4 sm:rounded-3xl sm:p-6">
          <div className="flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.007M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[2px] text-slate-500">Overdue</p>
          </div>
          <p className="mt-4 text-2xl font-black text-white sm:text-3xl">{stats.overdueInvoices}</p>
          <p className="mt-2 text-xs text-slate-500">Invoices that need immediate attention.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="relative overflow-hidden rounded-2xl border border-orange-500/20 bg-linear-to-br from-slate-900 to-slate-800 p-5 sm:rounded-[32px] sm:p-8 lg:col-span-2">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-orange-500/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="h-px w-8 bg-orange-500" />
              <p className="text-[10px] font-black uppercase tracking-[3px] text-orange-500 sm:text-xs">
                Account Overview
              </p>
            </div>

            <h2 className="mt-4 text-2xl font-black text-white sm:text-4xl lg:text-5xl">
              {formatCurrency(stats.totalDue)}
            </h2>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
              This is your current outstanding balance. Review recent invoices, complete payments,
              and download receipts anytime from your client portal.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-[6px]">
                <p className="text-[10px] font-black uppercase text-slate-500">Pending</p>
                <p className="mt-1 text-sm font-bold text-white">{stats.pendingInvoices} invoices</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-[6px]">
                <p className="text-[10px] font-black uppercase text-slate-500">Overdue</p>
                <p className="mt-1 text-sm font-bold text-white">{stats.overdueInvoices} invoices</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-[6px]">
                <p className="text-[10px] font-black uppercase text-slate-500">Paid Total</p>
                <p className="mt-1 text-sm font-bold text-white">{formatCurrency(stats.totalPaid)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-linear-to-br from-slate-900 to-gray-900 p-5 sm:rounded-[32px] sm:p-8">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-4 w-2 bg-orange-500 sm:h-5 sm:w-2.5" />
            <p className="text-sm font-black uppercase tracking-wider text-white">Notifications</p>
          </div>

          <div className="mt-5 flex flex-col gap-3">
            {notifications.map((item) => {
              const toneClasses =
                item.tone === 'red'
                  ? 'border-red-500/30 bg-red-500/10 text-red-300'
                  : item.tone === 'green'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : item.tone === 'orange'
                      ? 'border-orange-500/30 bg-orange-500/10 text-orange-300'
                      : 'border-blue-500/30 bg-blue-500/10 text-blue-300'

              return (
                <div key={item.id} className={`rounded-2xl border p-4 ${toneClasses}`}>
                  <p className="text-sm font-bold">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 opacity-90">{item.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2 lg:gap-6 lg:items-stretch">
        <div className="rounded-2xl border border-slate-800 bg-linear-to-br from-slate-900 to-gray-900 p-4 sm:rounded-[32px] sm:p-8">
          <div>
            <h2 className="text-base font-black text-white sm:text-xl">Invoice Status Mix</h2>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">Breakdown of your invoice portfolio</p>
          </div>

          <div className="mt-6 min-h-[280px] h-72 sm:h-80">
            <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0}>
              <PieChart>
                <Pie
                  data={pieChartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={pieChartData.length === 1 ? 0 : 4}
                >
                  {pieChartData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={
                        pieChartData.length === 1
                          ? '#334155'
                          : ['#10b981', '#3b82f6', '#f97316'][i]
                      }
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-white/5 p-3">
              <p className="text-[10px] uppercase text-slate-500">Paid</p>
              <p className="mt-1 text-sm font-bold text-white">{stats.paidInvoices}</p>
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <p className="text-[10px] uppercase text-slate-500">Pending</p>
              <p className="mt-1 text-sm font-bold text-white">{stats.pendingInvoices}</p>
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <p className="text-[10px] uppercase text-slate-500">Overdue</p>
              <p className="mt-1 text-sm font-bold text-white">{stats.overdueInvoices}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col rounded-2xl border border-slate-800 bg-linear-to-br from-slate-900 to-gray-900 p-4 sm:rounded-[32px] sm:p-8">
          <div>
            <h2 className="text-base font-black text-white sm:text-xl">Payment Activity</h2>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">Monthly payment volume across the current year</p>
          </div>

          <div className="mt-6 min-h-[280px] flex-1">
            <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0}>
              <AreaChart data={monthlyPaidData} margin={{ top: 8, right: 8, left: 8, bottom: 24 }}>
                <defs>
                  <linearGradient id="clientPaymentGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                />
                <YAxis hide domain={[0, 'dataMax']} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="paid"
                  stroke="#f97316"
                  strokeWidth={2}
                  fill="url(#clientPaymentGradient)"
                  dot={{ r: 4, fill: '#f97316', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#f97316', stroke: '#1e293b', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid w-full grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="w-full rounded-2xl border border-slate-800 bg-linear-to-br from-slate-900 to-gray-900 p-4 sm:rounded-[32px] sm:p-8 lg:col-span-2">
          <div>
            <h2 className="text-base font-black text-white sm:text-xl">Recent Invoices</h2>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">Only invoices assigned to your account appear here</p>
          </div>

          <div className="mt-6 w-full overflow-hidden rounded-2xl border border-white/5">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-full table-fixed">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[2px] text-slate-500">Invoice</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[2px] text-slate-500">Issued</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[2px] text-slate-500">Due</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[2px] text-slate-500">Amount</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[2px] text-slate-500">Status</th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[2px] text-slate-500">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.length > 0 ? (
                    recentInvoices.map((invoice) => {
                      const status = normalizeStatus(invoice.status)
                      const badgeClass =
                        status === 'paid'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : status === 'overdue'
                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                            : 'bg-orange-500/10 text-orange-400 border-orange-500/20'

                      return (
                        <tr key={invoice.id} className="border-t border-white/5">
                          <td className="px-4 py-4 text-sm font-semibold text-white">
                            INV-{invoice.id}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-400">{formatDate(invoice.invoice_date)}</td>
                          <td className="px-4 py-4 text-sm text-slate-400">{formatDate(invoice.invoice_date)}</td>
                          <td className="px-4 py-4 text-sm font-bold text-white">
                            {formatCurrency(getInvoiceAmount(invoice))}
                          </td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase ${badgeClass}`}>
                              {status}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <a
                              href={`/invoice?id=${invoice.id}`}
                              className="inline-flex rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
                            >
                              View
                            </a>
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                        No invoices available yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-linear-to-br from-slate-900 to-gray-900 p-4 sm:rounded-[32px] sm:p-8">
          <div>
            <h2 className="text-base font-black text-white sm:text-xl">Recent Payments</h2>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">Latest payment records and receipt access</p>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            {recentPayments.length > 0 ? (
              recentPayments.map((payment) => (
                <div key={payment.id} className="rounded-2xl border border-white/5 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white">
                        {formatCurrency(amountToNumber(payment.amount))}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{formatDate(payment.created_at)}</p>
                    </div>
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase text-emerald-400">
                      {normalizeStatus(payment.status) || 'paid'}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs text-slate-400">
                      Invoice #{payment.invoice_id ?? '--'}
                    </p>
                    {payment.invoice_id ? (
                      <a
                        href={`/invoice?id=${payment.invoice_id}`}
                        className="text-xs font-semibold text-orange-400 hover:text-orange-300"
                      >
                        View Invoice
                      </a>
                    ) : (
                      <span className="text-xs text-slate-500">—</span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/5 bg-white/5 p-6 text-sm text-slate-500">
                No payments recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-linear-to-br from-slate-900 to-gray-900 p-4 sm:rounded-[32px] sm:p-8">
        <div>
          <h2 className="text-base font-black text-white sm:text-xl">Quick Payment Snapshot</h2>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">Pending vs overdue invoice count</p>
        </div>

        <div className="mt-6 min-h-[280px] h-72 sm:h-80">
          <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={0}>
            <BarChart
              data={[
                { label: 'Pending', value: stats.pendingInvoices },
                { label: 'Overdue', value: stats.overdueInvoices },
                { label: 'Paid', value: stats.paidInvoices },
              ]}
              margin={{ top: 8, right: 8, left: 8, bottom: 24 }}
            >
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }}
              />
              <YAxis hide domain={[0, Math.max(1, stats.pendingInvoices, stats.overdueInvoices, stats.paidInvoices)]} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 12,
                }}
                cursor={{ fill: 'rgba(248,250,252,0.03)' }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={70}>
                <Cell fill="#3b82f6" />
                <Cell fill="#f97316" />
                <Cell fill="#10b981" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}