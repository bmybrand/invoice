'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Cell,
} from 'recharts'

type TopOperativeStyle = {
  color: string
  opacity?: string
}

const topOperativeStyles: TopOperativeStyle[] = [
  { color: 'text-orange-500' },
  { color: 'text-white' },
  { color: 'text-slate-400', opacity: 'opacity-80' },
  { color: 'text-slate-500', opacity: 'opacity-60' },
  { color: 'text-slate-600', opacity: 'opacity-40' },
]

const WEEK_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const
const YEAR_MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const

type WeekDay = (typeof WEEK_DAYS)[number]
type YearMonth = (typeof YEAR_MONTHS)[number]
type DailyRevenuePoint = {
  day: WeekDay
  value: number
  highlight: boolean
}
type GrowthVelocityPoint = {
  month: YearMonth
  value: number
}

type InvoiceServiceLine = {
  qty?: number
  price?: string | number
}

type DashboardMetric = {
  changeLabel: string
  valueLabel: string
}

type AnnualOverview = {
  totalLabel: string
  subtitle: string
  paidCountLabel: string
  upsaleLabel: string
}

export function Dashboard() {
  const [dailyRange, setDailyRange] = useState<'this_week' | 'last_week'>('this_week')
  const [dailyRangeOpen, setDailyRangeOpen] = useState(false)
  const [growthMetric, setGrowthMetric] = useState<'paid_revenue' | 'upsale_revenue'>('paid_revenue')
  const [growthMetricOpen, setGrowthMetricOpen] = useState(false)
  const [topOperatives, setTopOperatives] = useState<Array<{
    id: number
    name: string
    amount: string
    rank: number
    color: string
    opacity?: string
  }>>([])
  const [metrics, setMetrics] = useState<{
    today: DashboardMetric
    month: DashboardMetric
    upsale: DashboardMetric
  }>({
    today: { changeLabel: '0%', valueLabel: '$ 0.00' },
    month: { changeLabel: '0%', valueLabel: '$ 0.00' },
    upsale: { changeLabel: '0%', valueLabel: '$ 0.00' },
  })
  const [dailyRevenueData, setDailyRevenueData] = useState<DailyRevenuePoint[]>(
    WEEK_DAYS.map((day) => ({ day, value: 0, highlight: false }))
  )
  const [dailyRevenueSeries, setDailyRevenueSeries] = useState<{
    this_week: DailyRevenuePoint[]
    last_week: DailyRevenuePoint[]
  }>({
    this_week: WEEK_DAYS.map((day) => ({ day, value: 0, highlight: false })),
    last_week: WEEK_DAYS.map((day) => ({ day, value: 0, highlight: false })),
  })
  const [growthVelocityData, setGrowthVelocityData] = useState<GrowthVelocityPoint[]>(
    YEAR_MONTHS.map((month) => ({ month, value: 0 }))
  )
  const [growthVelocitySeries, setGrowthVelocitySeries] = useState<{
    paid_revenue: GrowthVelocityPoint[]
    upsale_revenue: GrowthVelocityPoint[]
  }>({
    paid_revenue: YEAR_MONTHS.map((month) => ({ month, value: 0 })),
    upsale_revenue: YEAR_MONTHS.map((month) => ({ month, value: 0 })),
  })
  const [annualOverview, setAnnualOverview] = useState<AnnualOverview>({
    totalLabel: '$ 0.00',
    subtitle: 'No paid revenue recorded this year yet.',
    paidCountLabel: '0 paid invoices',
    upsaleLabel: '$ 0.00 upsale',
  })

  useEffect(() => {
    async function loadDashboardData() {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, status, amount, service, invoice_date, invoice_type, invoice_creator_id, employees!invoice_creator_id(employee_name)')

      if (error) {
        console.error('Failed to fetch dashboard invoices', error)
        setTopOperatives([])
        setMetrics({
          today: { changeLabel: '0%', valueLabel: '$ 0.00' },
          month: { changeLabel: '0%', valueLabel: '$ 0.00' },
          upsale: { changeLabel: '0%', valueLabel: '$ 0.00' },
        })
        setDailyRevenueData(WEEK_DAYS.map((day) => ({ day, value: 0, highlight: false })))
        setDailyRevenueSeries({
          this_week: WEEK_DAYS.map((day) => ({ day, value: 0, highlight: false })),
          last_week: WEEK_DAYS.map((day) => ({ day, value: 0, highlight: false })),
        })
        setGrowthVelocityData(YEAR_MONTHS.map((month) => ({ month, value: 0 })))
        setGrowthVelocitySeries({
          paid_revenue: YEAR_MONTHS.map((month) => ({ month, value: 0 })),
          upsale_revenue: YEAR_MONTHS.map((month) => ({ month, value: 0 })),
        })
        setAnnualOverview({
          totalLabel: '$ 0.00',
          subtitle: 'No paid revenue recorded this year yet.',
          paidCountLabel: '0 paid invoices',
          upsaleLabel: '$ 0.00 upsale',
        })
        return
      }

      const invoices = (data as Array<Record<string, unknown>> | null) ?? []
      const todayIso = new Date().toISOString().slice(0, 10)
      const currentMonth = todayIso.slice(0, 7)
      const currentYear = todayIso.slice(0, 4)
      const todayDate = new Date(`${todayIso}T00:00:00`)
      const dayOfWeek = todayDate.getDay()
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      const weekStart = new Date(todayDate)
      weekStart.setDate(todayDate.getDate() + mondayOffset)
      const lastWeekStart = new Date(weekStart)
      lastWeekStart.setDate(weekStart.getDate() - 7)
      const lastMonthDate = new Date(todayDate)
      lastMonthDate.setMonth(lastMonthDate.getMonth() - 1)
      const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`
      const lastYear = String(Number(currentYear) - 1)

      const getInvoiceAmount = (row: Record<string, unknown>) => {
        const directAmount = Number(String(row.amount ?? '').replace(/[^0-9.-]/g, ''))
        const serviceLines = Array.isArray(row.service) ? (row.service as InvoiceServiceLine[]) : []
        const derivedAmount = serviceLines.reduce((sum, line) => {
          const qty = Number(line.qty ?? 0) || 0
          const price = Number(String(line.price ?? '').replace(/[^0-9.-]/g, '')) || 0
          return sum + qty * price
        }, 0)
        return directAmount > 0 ? directAmount : derivedAmount
      }

      const paidInvoices = invoices.filter((row) => {
        const normalizedStatus = String(row.status ?? '').toLowerCase()
        return normalizedStatus.includes('paid') || normalizedStatus.includes('completed')
      })

      const totalsByCreator = new Map<number, { id: number; name: string; total: number }>()
      for (const row of paidInvoices) {
        const creatorId = Number(row.invoice_creator_id ?? 0)
        if (!creatorId) continue
        const employee = row.employees as { employee_name?: string } | { employee_name?: string }[] | null
        const employeeRecord = Array.isArray(employee) ? employee[0] : employee
        const creatorName = employeeRecord?.employee_name?.trim() || '--'
        const invoiceAmount = getInvoiceAmount(row)
        const existing = totalsByCreator.get(creatorId)
        if (existing) {
          existing.total += invoiceAmount
        } else {
          totalsByCreator.set(creatorId, { id: creatorId, name: creatorName, total: invoiceAmount })
        }
      }

      const rankedCreators = Array.from(totalsByCreator.values())
        .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
        .slice(0, 5)
      setTopOperatives(
        rankedCreators.map((creator, index) => ({
          id: creator.id,
          name: creator.name,
          amount: `$${creator.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          rank: index + 1,
          color: topOperativeStyles[index]?.color ?? 'text-slate-400',
          opacity: topOperativeStyles[index]?.opacity,
        }))
      )

      const sumAmounts = (rows: Array<Record<string, unknown>>) =>
        rows.reduce((sum, row) => sum + getInvoiceAmount(row), 0)

      const currentDayPaid = paidInvoices.filter((row) => String(row.invoice_date ?? '').slice(0, 10) === todayIso)
      const currentMonthPaid = paidInvoices.filter((row) => String(row.invoice_date ?? '').slice(0, 7) === currentMonth)
      const lastMonthPaid = paidInvoices.filter((row) => String(row.invoice_date ?? '').slice(0, 7) === lastMonth)
      const currentMonthUpsales = currentMonthPaid.filter(
        (row) => String(row.invoice_type ?? '').toLowerCase() === 'upsale'
      )
      const lastYearPaid = paidInvoices.filter((row) => String(row.invoice_date ?? '').slice(0, 4) === lastYear)
      const currentYearPaid = paidInvoices.filter((row) => String(row.invoice_date ?? '').slice(0, 4) === currentYear)
      const currentYearUpsales = currentYearPaid.filter(
        (row) => String(row.invoice_type ?? '').toLowerCase() === 'upsale'
      )

      const formatCurrency = (value: number) =>
        `$ ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      const formatChange = (current: number, previous: number) => {
        if (previous <= 0) return current > 0 ? '100%' : '0%'
        return `${Math.round(((current - previous) / previous) * 100)}%`
      }

      const todayTotal = sumAmounts(currentDayPaid)
      const monthTotal = sumAmounts(currentMonthPaid)
      const lastMonthTotal = sumAmounts(lastMonthPaid)
      const upsaleTotal = sumAmounts(currentMonthUpsales)
      const lastYearTotal = sumAmounts(lastYearPaid)

      setMetrics({
        today: {
          changeLabel: formatChange(todayTotal, lastMonthTotal),
          valueLabel: formatCurrency(todayTotal),
        },
        month: {
          changeLabel: formatChange(monthTotal, lastYearTotal),
          valueLabel: formatCurrency(monthTotal),
        },
        upsale: {
          changeLabel: monthTotal > 0 ? `${Math.round((upsaleTotal / monthTotal) * 100)}%` : '0%',
          valueLabel: formatCurrency(upsaleTotal),
        },
      })

      const yearTotal = sumAmounts(currentYearPaid)
      const yearUpsaleTotal = sumAmounts(currentYearUpsales)
      setAnnualOverview({
        totalLabel: formatCurrency(yearTotal),
        subtitle:
          currentYearPaid.length > 0
            ? `Collected from ${currentYearPaid.length} paid invoice${currentYearPaid.length === 1 ? '' : 's'} in ${currentYear}.`
            : 'No paid revenue recorded this year yet.',
        paidCountLabel: `${currentYearPaid.length} paid invoice${currentYearPaid.length === 1 ? '' : 's'}`,
        upsaleLabel: `${formatCurrency(yearUpsaleTotal)} upsale`,
      })

      const buildWeekSeries = (startDate: Date, highlightToday: boolean) =>
        WEEK_DAYS.map((day, index) => {
          const date = new Date(startDate)
          date.setDate(startDate.getDate() + index)
          const iso = date.toISOString().slice(0, 10)
          return {
            day,
            value: Number(
              sumAmounts(paidInvoices.filter((row) => String(row.invoice_date ?? '').slice(0, 10) === iso)).toFixed(2)
            ),
            highlight: highlightToday && iso === todayIso,
          }
        })

      const thisWeekSeries = buildWeekSeries(weekStart, true)
      const lastWeekSeries = buildWeekSeries(lastWeekStart, false)
      setDailyRevenueSeries({
        this_week: thisWeekSeries,
        last_week: lastWeekSeries,
      })
      setDailyRevenueData(dailyRange === 'this_week' ? thisWeekSeries : lastWeekSeries)

      const paidRevenueSeries = YEAR_MONTHS.map((month, index) => {
          const monthKey = `${currentYear}-${String(index + 1).padStart(2, '0')}`
          return {
            month,
            value: Number(sumAmounts(paidInvoices.filter((row) => String(row.invoice_date ?? '').slice(0, 7) === monthKey)).toFixed(2)),
          }
        })
      const upsaleRevenueSeries = YEAR_MONTHS.map((month, index) => {
        const monthKey = `${currentYear}-${String(index + 1).padStart(2, '0')}`
        return {
          month,
          value: Number(
            sumAmounts(
              paidInvoices.filter(
                (row) =>
                  String(row.invoice_date ?? '').slice(0, 7) === monthKey &&
                  String(row.invoice_type ?? '').toLowerCase() === 'upsale'
              )
            ).toFixed(2)
          ),
        }
      })
      setGrowthVelocitySeries({
        paid_revenue: paidRevenueSeries,
        upsale_revenue: upsaleRevenueSeries,
      })
      setGrowthVelocityData(growthMetric === 'paid_revenue' ? paidRevenueSeries : upsaleRevenueSeries)
    }

    loadDashboardData()
  }, [])

  useEffect(() => {
    setDailyRevenueData(dailyRevenueSeries[dailyRange])
  }, [dailyRange, dailyRevenueSeries])

  useEffect(() => {
    setGrowthVelocityData(growthVelocitySeries[growthMetric])
  }, [growthMetric, growthVelocitySeries])

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
        <div className="flex justify-between items-start gap-2">
              <div className="flex flex-1 flex-col gap-1 sm:gap-2 min-w-0">
                <h1 className="text-xl font-black leading-tight text-white sm:text-2xl md:text-3xl lg:text-4xl lg:leading-10">Mission Control</h1>
                <p className="text-xs font-medium leading-5 text-slate-500 sm:text-sm md:text-base md:leading-6">Powering the next generation of creative dominance.</p>
              </div>
              <div className="flex shrink-0 gap-1.5 pt-1 sm:gap-2 sm:pt-2">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="rounded-xl border border-slate-800 bg-slate-900 p-3"
                  aria-label="Refresh"
                >
                  <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                </button>
              </div>
            </div>

            {/* Metric cards row */}
            <div className="flex flex-wrap gap-3 sm:gap-4 lg:flex-row flex-col lg:gap-6">
              <div className="relative min-h-[140px] min-w-0 w-full flex-1 rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900 to-gray-900 p-4 sm:min-h-[180px] sm:rounded-3xl sm:p-6 lg:min-w-0">
                <div className="flex justify-between items-start">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500 sm:h-12 sm:w-12 sm:rounded-xl">
                    <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black leading-4 text-green-400 sm:text-xs">{metrics.today.changeLabel}</p>
                    <p className="text-[9px] font-normal uppercase leading-3 text-slate-500 sm:text-[10px] sm:leading-4">vs last month</p>
                  </div>
                </div>
                <p className="mt-3 text-[10px] font-black uppercase leading-4 tracking-[2.4px] text-slate-400 sm:mt-4 sm:text-xs">Payments - Today</p>
                <p className="mt-0.5 text-xl font-black leading-8 text-white sm:mt-1 sm:text-2xl md:text-3xl md:leading-9">{metrics.today.valueLabel}</p>
              </div>
              <div className="relative min-h-[140px] min-w-0 w-full flex-1 rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900 to-gray-900 p-4 sm:min-h-[180px] sm:rounded-3xl sm:p-6 lg:min-w-0">
                <div className="flex justify-between items-start">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 sm:h-12 sm:w-12 sm:rounded-xl">
                    <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black leading-4 text-blue-400 sm:text-xs">{metrics.month.changeLabel}</p>
                    <p className="text-[9px] font-normal uppercase leading-3 text-slate-500 sm:text-[10px] sm:leading-4">vs last year</p>
                  </div>
                </div>
                <p className="mt-3 text-[10px] font-black uppercase leading-4 tracking-[2.4px] text-slate-400 sm:mt-4 sm:text-xs">Payments - Month</p>
                <p className="mt-0.5 text-xl font-black leading-8 text-white sm:mt-1 sm:text-2xl md:text-3xl md:leading-9">{metrics.month.valueLabel}</p>
              </div>
              <div className="relative min-h-[140px] min-w-0 w-full flex-1 rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900 to-gray-900 p-4 sm:min-h-[180px] sm:rounded-3xl sm:p-6 lg:min-w-0">
                <div className="flex justify-between items-start">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 sm:h-12 sm:w-12 sm:rounded-xl">
                    <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41" /></svg>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black leading-4 text-purple-400 sm:text-xs">{metrics.upsale.changeLabel}</p>
                    <p className="text-[9px] font-normal uppercase leading-3 text-slate-500 sm:text-[10px] sm:leading-4">Velocity</p>
                  </div>
                </div>
                <p className="mt-3 text-[10px] font-black uppercase leading-4 tracking-[2.4px] text-slate-400 sm:mt-4 sm:text-xs">Upsale - Month</p>
                <p className="mt-0.5 text-xl font-black leading-8 text-white sm:mt-1 sm:text-2xl md:text-3xl md:leading-9">{metrics.upsale.valueLabel}</p>
              </div>
            </div>

            {/* Annual target + Top Operatives row */}
            <div className="flex flex-wrap gap-3 sm:gap-4 lg:flex-nowrap lg:gap-6">
              <div className="relative flex max-h-80 min-h-56 min-w-0 w-full flex-col justify-center overflow-hidden rounded-2xl border border-orange-500/20 bg-gradient-to-br from-slate-900 to-slate-800 p-4 sm:min-h-80 sm:max-h-96 sm:rounded-[32px] sm:p-8 lg:w-0 lg:min-w-0 lg:flex-[7]">
                <div className="absolute inset-y-0 right-4 flex items-center opacity-5 sm:right-6">
                  <img src="/%24%20coin.svg" alt="" className="h-72 w-56 object-contain sm:h-80 sm:w-64" />
                </div>
                <div className="relative flex flex-col gap-2 sm:gap-4">
                  <div className="flex items-center gap-2">
                    <div className="h-px w-6 bg-orange-500 sm:w-8" />
                    <p className="text-[10px] font-black uppercase leading-4 tracking-[3.6px] text-orange-500 sm:text-xs">This Year Revenue</p>
                  </div>
                  <p className="break-words text-2xl font-black leading-tight text-white sm:text-3xl md:text-4xl md:leading-tight lg:text-6xl xl:text-7xl xl:leading-[72px] 2xl:text-7xl">{annualOverview.totalLabel}</p>
                  <p className="max-w-[576px] pt-1 text-xs font-medium leading-6 text-slate-400 sm:pt-2 sm:text-sm md:text-base md:leading-7 lg:text-lg">{annualOverview.subtitle}</p>
                  <div className="flex flex-wrap items-start gap-2 pt-2 sm:gap-4 sm:pt-4">
                    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 backdrop-blur-[6px] sm:gap-3 sm:rounded-2xl sm:px-6 sm:py-3">
                      <div className="flex h-4 w-4 items-center justify-center text-orange-500 sm:h-5 sm:w-5">
                        <svg className="h-full w-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase leading-4 text-slate-500 sm:text-[10px]">Invoices</p>
                        <p className="text-xs font-bold uppercase leading-4 tracking-wide text-white sm:text-sm sm:leading-5">{annualOverview.paidCountLabel}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 backdrop-blur-[6px] sm:gap-3 sm:rounded-2xl sm:px-6 sm:py-3">
                      <div className="flex h-4 w-4 items-center justify-center text-blue-400 sm:h-5 sm:w-5">
                        <svg className="h-full w-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 0115.306 3.28l1.094-1.094" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase leading-4 text-slate-500 sm:text-[10px]">Upsale</p>
                        <p className="text-xs font-bold uppercase leading-4 tracking-wide text-white sm:text-sm sm:leading-5">{annualOverview.upsaleLabel}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="relative flex max-h-80 min-h-56 min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-gray-900 p-4 sm:min-h-80 sm:max-h-96 sm:rounded-[32px] sm:p-8 lg:w-0 lg:flex-[3] lg:shrink-0">
                <div className="absolute -top-4 right-0 h-24 w-24 rounded-full bg-orange-500/20 blur-[20px] pointer-events-none" />
                <div className="shrink-0 pb-3 sm:pb-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="h-4 w-2 bg-orange-500 sm:h-5 sm:w-2.5" />
                      <p className="text-xs font-black uppercase leading-4 tracking-wider text-white sm:text-sm sm:leading-5">Top Operatives</p>
                    </div>
                    <p className="text-[9px] font-black uppercase leading-3 text-slate-500 sm:text-[10px] sm:leading-4">Weekly</p>
                  </div>
                </div>
                <div className="relative min-h-0 flex-1 min-w-0">
                  <div className="min-h-0 h-full overflow-y-auto scrollbar-thin pr-0.5">
                    <div className="flex flex-col gap-2 sm:gap-4">
                      {topOperatives.map((op) => (
                        <div key={op.id} className={`flex justify-between items-center rounded-lg border border-white/5 bg-white/5 px-2 py-2 sm:rounded-xl sm:px-3 sm:py-3 ${op.opacity || ''}`}>
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <div className="relative shrink-0">
                              <img src="https://placehold.co/40x40" alt="" className="h-8 w-8 rounded-lg shadow-[0px_0px_0px_1px_rgba(255,255,255,0.10)] sm:h-10 sm:w-10 sm:rounded-xl" />
                              <span className={`absolute -left-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-slate-900 text-[9px] font-black leading-4 text-white sm:-left-1 sm:-top-1 sm:h-5 sm:w-5 sm:text-[10px] ${op.rank === 1 ? 'bg-orange-500' : 'bg-slate-600'}`}>{op.rank}</span>
                            </div>
                            <p className="truncate text-xs font-bold leading-4 text-white sm:text-sm sm:leading-5">{op.name}</p>
                          </div>
                          <p className={`shrink-0 text-xs font-black leading-4 sm:text-sm sm:leading-5 ${op.rank === 1 ? 'text-orange-500' : op.color}`}>{op.amount}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="absolute left-0 right-2 bottom-0 z-10 h-6 bg-gradient-to-t from-gray-900 to-transparent pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Charts row */}
            <div className="flex flex-col gap-3 sm:gap-4 lg:gap-6 lg:flex-row xl:gap-8 pb-8 sm:pb-12">
              <div className="min-h-56 min-w-0 w-full flex-1 rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-gray-900 p-4 sm:min-h-80 sm:rounded-[32px] sm:p-8 xl:min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-black leading-6 text-white sm:text-lg md:text-xl md:leading-7">Daily Revenue Stream</h2>
                    <p className="mt-0.5 text-xs font-medium leading-4 text-slate-500 sm:mt-1 sm:text-sm sm:leading-5">Monitoring the energetic flow of assets</p>
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setDailyRangeOpen((open) => !open)}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/50 px-2.5 py-1.5 text-[10px] font-bold uppercase leading-4 text-slate-400 sm:text-xs"
                      aria-haspopup="listbox"
                      aria-expanded={dailyRangeOpen}
                    >
                      {dailyRange === 'this_week' ? 'This Week' : 'Last Week'}
                      <svg className="h-3 w-3 sm:h-3.5 sm:w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                    </button>
                    {dailyRangeOpen && (
                      <>
                        <div className="fixed inset-0 z-10" aria-hidden onClick={() => setDailyRangeOpen(false)} />
                        <div className="absolute right-0 top-full z-20 mt-1 min-w-[128px] overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
                          <button
                            type="button"
                            onClick={() => {
                              setDailyRange('this_week')
                              setDailyRangeOpen(false)
                            }}
                            className={`block w-full px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wide transition ${
                              dailyRange === 'this_week' ? 'bg-orange-500/20 text-orange-400' : 'text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            This Week
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDailyRange('last_week')
                              setDailyRangeOpen(false)
                            }}
                            className={`block w-full px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wide transition ${
                              dailyRange === 'last_week' ? 'bg-orange-500/20 text-orange-400' : 'text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            Last Week
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-4 h-44 sm:mt-6 sm:h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyRevenueData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }} />
                      <YAxis hide domain={[0, 'dataMax']} />
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} labelStyle={{ color: '#94a3b8' }} cursor={{ fill: 'rgba(248,250,252,0.03)' }} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={40}>
                        {dailyRevenueData.map((entry, index) => (
                          <Cell key={index} fill={entry.highlight ? '#f97316' : '#475569'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="min-h-56 min-w-0 w-full flex-1 rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-gray-900 p-4 sm:min-h-80 sm:rounded-[32px] sm:p-8 xl:min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-black leading-6 text-white sm:text-lg md:text-xl md:leading-7">Growth Velocity</h2>
                    <p className="mt-0.5 text-xs font-medium leading-4 text-slate-500 sm:mt-1 sm:text-sm sm:leading-5">Monthly trajectory of creative acquisition</p>
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setGrowthMetricOpen((open) => !open)}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-400"
                      aria-label="Growth options"
                      aria-haspopup="listbox"
                      aria-expanded={growthMetricOpen}
                    >
                      <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>
                    </button>
                    {growthMetricOpen && (
                      <>
                        <div className="fixed inset-0 z-10" aria-hidden onClick={() => setGrowthMetricOpen(false)} />
                        <div className="absolute right-0 top-full z-20 mt-1 min-w-[164px] overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
                          <button
                            type="button"
                            onClick={() => {
                              setGrowthMetric('paid_revenue')
                              setGrowthMetricOpen(false)
                            }}
                            className={`block w-full px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wide transition ${
                              growthMetric === 'paid_revenue' ? 'bg-orange-500/20 text-orange-400' : 'text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            Paid Revenue
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setGrowthMetric('upsale_revenue')
                              setGrowthMetricOpen(false)
                            }}
                            className={`block w-full px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wide transition ${
                              growthMetric === 'upsale_revenue' ? 'bg-orange-500/20 text-orange-400' : 'text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            Upsale Revenue
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-4 h-44 sm:mt-6 sm:h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={growthVelocityData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f97316" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }} />
                      <YAxis hide domain={[0, 'dataMax']} />
                      <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} labelStyle={{ color: '#94a3b8' }} />
                      <Area type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2} fill="url(#growthGradient)" dot={{ r: 4, fill: '#f97316', strokeWidth: 0 }} activeDot={{ r: 5, fill: '#f97316', stroke: '#1e293b', strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
  )
}
