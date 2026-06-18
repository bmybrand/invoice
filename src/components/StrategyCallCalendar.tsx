'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { useDashboardProfile } from '@/components/DashboardLayout'
import { useSessionContext } from '@/context/SessionContext'

const plusJakarta = Plus_Jakarta_Sans({ subsets: ['latin'] })

type StrategyCallBooking = {
  id: number
  email: string
  name: string
  countryCode: string
  phone: string
  companyName: string
  websiteUrl: string
  budget: string
  callNotes: string
  source: string
  appointmentDate: string
  appointmentTime: string
  timezone: string
  createdAt: string
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function normalizeRole(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

function toDateKey(year: number, month: number, day: number) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`
}

function parseDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  return {
    year: Number(match[1]),
    month: Number(match[2]) - 1,
    day: Number(match[3]),
  }
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date)
}

function formatLongDate(dateKey: string) {
  const parsed = parseDateKey(dateKey)
  if (!parsed) return dateKey
  const date = new Date(parsed.year, parsed.month, parsed.day)
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatCreatedAt(value: string) {
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
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

function CloseIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

function TrashIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673A2.25 2.25 0 0115.916 21H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
      />
    </svg>
  )
}

function buildMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const startOffset = firstDay.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const cells: Array<{ day: number; inMonth: boolean; dateKey: string }> = []

  for (let index = 0; index < 42; index += 1) {
    const dayNumber = index - startOffset + 1

    if (dayNumber < 1) {
      const day = daysInPrevMonth + dayNumber
      const prevMonth = month === 0 ? 11 : month - 1
      const prevYear = month === 0 ? year - 1 : year
      cells.push({ day, inMonth: false, dateKey: toDateKey(prevYear, prevMonth, day) })
      continue
    }

    if (dayNumber > daysInMonth) {
      const day = dayNumber - daysInMonth
      const nextMonth = month === 11 ? 0 : month + 1
      const nextYear = month === 11 ? year + 1 : year
      cells.push({ day, inMonth: false, dateKey: toDateKey(nextYear, nextMonth, day) })
      continue
    }

    cells.push({ day: dayNumber, inMonth: true, dateKey: toDateKey(year, month, dayNumber) })
  }

  return cells
}

export default function StrategyCallCalendar() {
  const { accountType, displayRole, profileLoaded } = useDashboardProfile()
  const { token } = useSessionContext()

  const [calendarDate, setCalendarDate] = useState(() => new Date())
  const [bookings, setBookings] = useState<StrategyCallBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedBooking, setSelectedBooking] = useState<StrategyCallBooking | null>(null)
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null)
  const [deleteConfirmBooking, setDeleteConfirmBooking] = useState<StrategyCallBooking | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const role = normalizeRole(displayRole || '')
  const canDelete = role === 'admin' || role === 'superadmin'
  const isEmployee = accountType === 'employee'

  const monthStart = useMemo(
    () => new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1),
    [calendarDate]
  )
  const monthEnd = useMemo(
    () => new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0),
    [calendarDate]
  )

  const fetchBookings = useCallback(async () => {
    const accessToken = token?.trim() || ''
    if (!accessToken || !isEmployee) {
      setBookings([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const from = toDateKey(monthStart.getFullYear(), monthStart.getMonth(), 1)
    const to = toDateKey(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate())
    const params = new URLSearchParams({ from, to })

    const response = await fetch(`/api/strategy-calls?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    const result = (await response.json().catch(() => null)) as
      | { bookings?: StrategyCallBooking[]; error?: string; hint?: string }
      | null

    if (!response.ok) {
      setBookings([])
      const parts = [result?.error || 'Could not load strategy call bookings.']
      if (result?.hint) parts.push(result.hint)
      setError(parts.join(' '))
      setLoading(false)
      return
    }

    setBookings(result?.bookings ?? [])
    setLoading(false)
  }, [isEmployee, monthEnd, monthStart, token])

  useEffect(() => {
    if (!profileLoaded) return
    void fetchBookings()
  }, [fetchBookings, profileLoaded])

  const bookingsByDate = useMemo(() => {
    const map = new Map<string, StrategyCallBooking[]>()
    for (const booking of bookings) {
      const key = booking.appointmentDate
      if (!key) continue
      const existing = map.get(key) ?? []
      existing.push(booking)
      map.set(key, existing)
    }
    for (const [, dayBookings] of map) {
      dayBookings.sort((a, b) => a.appointmentTime.localeCompare(b.appointmentTime))
    }
    return map
  }, [bookings])

  const monthCells = useMemo(
    () => buildMonthGrid(calendarDate.getFullYear(), calendarDate.getMonth()),
    [calendarDate]
  )

  const selectedDayBookings = selectedDateKey ? (bookingsByDate.get(selectedDateKey) ?? []) : []

  const todayKey = toDateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())

  async function handleDeleteBooking(booking: StrategyCallBooking) {
    const accessToken = token?.trim() || ''
    if (!accessToken || !canDelete) return

    setDeletingId(booking.id)
    setError(null)

    const response = await fetch(`/api/strategy-calls/${booking.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    const result = (await response.json().catch(() => null)) as
      | { error?: string; calendarWarning?: string }
      | null

    if (!response.ok) {
      setError(result?.error || 'Failed to delete booking.')
      setDeletingId(null)
      return
    }

    setBookings((prev) => prev.filter((row) => row.id !== booking.id))
    setDeleteConfirmBooking(null)
    if (selectedBooking?.id === booking.id) {
      setSelectedBooking(null)
    }
    setDeletingId(null)

    if (result?.calendarWarning) {
      setError(result.calendarWarning)
    }

    await fetchBookings()
  }

  if (!profileLoaded) {
    return (
      <div className="flex min-h-[240px] items-center justify-center text-sm text-slate-400">
        Loading calendar...
      </div>
    )
  }

  if (!isEmployee) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-[#0f172a]/95 px-6 py-10 text-center">
        <p className="text-sm text-slate-400">Strategy call schedules are available to staff only.</p>
      </section>
    )
  }

  return (
    <div className={`${plusJakarta.className} space-y-6`}>
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-800 bg-[#0f172a]/95">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.12),transparent_34%)]" />

        <div className="relative p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">Strategy Calls</p>
              <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Schedule Calendar</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                Bookings from the brand site strategy call form.{' '}
                {canDelete ? 'Admins can remove entries from the calendar.' : 'View only.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                }
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-slate-500 hover:text-white"
                aria-label="Previous month"
              >
                <ChevronLeftIcon />
              </button>
              <div className="min-w-[180px] rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-center text-sm font-semibold text-white">
                {formatMonthLabel(calendarDate)}
              </div>
              <button
                type="button"
                onClick={() =>
                  setCalendarDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                }
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-slate-500 hover:text-white"
                aria-label="Next month"
              >
                <ChevronRightIcon />
              </button>
              <button
                type="button"
                onClick={() => setCalendarDate(new Date())}
                className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-300 transition hover:bg-orange-500/20"
              >
                Today
              </button>
            </div>
          </div>

          {error ? (
            <p className="relative mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          ) : null}

          <div className="relative mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/60">
            <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-900/80">
              {WEEKDAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="px-2 py-3 text-center text-[11px] font-black uppercase tracking-wide text-slate-500 sm:text-xs"
                >
                  {label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {monthCells.map((cell) => {
                const dayBookings = bookingsByDate.get(cell.dateKey) ?? []
                const isToday = cell.dateKey === todayKey
                const isSelected = cell.dateKey === selectedDateKey

                return (
                  <button
                    key={cell.dateKey}
                    type="button"
                    onClick={() => {
                      setSelectedDateKey(cell.dateKey)
                      setSelectedBooking(null)
                    }}
                    className={`min-h-[92px] border-b border-r border-slate-800 p-2 text-left transition hover:bg-slate-900/70 sm:min-h-[110px] ${
                      cell.inMonth ? 'bg-transparent' : 'bg-slate-950/40'
                    } ${isSelected ? 'ring-2 ring-inset ring-orange-500/70' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                          isToday
                            ? 'bg-orange-500 text-white'
                            : cell.inMonth
                              ? 'text-slate-200'
                              : 'text-slate-600'
                        }`}
                      >
                        {cell.day}
                      </span>
                      {dayBookings.length > 0 ? (
                        <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-bold text-orange-300">
                          {dayBookings.length}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2 space-y-1">
                      {dayBookings.slice(0, 2).map((booking) => (
                        <div
                          key={booking.id}
                          onClick={(event) => {
                            event.stopPropagation()
                            setSelectedBooking(booking)
                            setSelectedDateKey(cell.dateKey)
                          }}
                          className="truncate rounded-md bg-orange-500/15 px-1.5 py-1 text-[10px] font-semibold text-orange-200 sm:text-[11px]"
                          title={`${booking.appointmentTime} · ${booking.name}`}
                        >
                          {booking.appointmentTime} · {booking.name}
                        </div>
                      ))}
                      {dayBookings.length > 2 ? (
                        <p className="text-[10px] font-semibold text-slate-500">+{dayBookings.length - 2} more</p>
                      ) : null}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {loading ? (
            <p className="relative mt-4 text-sm text-slate-400">Loading bookings...</p>
          ) : null}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-[#0f172a]/95 p-6">
          <h2 className="text-lg font-bold text-white">
            {selectedDateKey ? formatLongDate(selectedDateKey) : 'Select a day'}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {selectedDateKey
              ? `${selectedDayBookings.length} scheduled call${selectedDayBookings.length === 1 ? '' : 's'}`
              : 'Click a date on the calendar to see all bookings for that day.'}
          </p>

          <div className="mt-4 space-y-3">
            {selectedDateKey && selectedDayBookings.length === 0 ? (
              <p className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-6 text-sm text-slate-500">
                No strategy calls scheduled for this day.
              </p>
            ) : null}

            {selectedDayBookings.map((booking) => (
              <button
                key={booking.id}
                type="button"
                onClick={() => setSelectedBooking(booking)}
                className={`w-full rounded-xl border px-4 py-4 text-left transition hover:border-orange-500/40 hover:bg-slate-900/70 ${
                  selectedBooking?.id === booking.id
                    ? 'border-orange-500/50 bg-orange-500/10'
                    : 'border-slate-800 bg-slate-950/50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{booking.name}</p>
                    <p className="mt-1 text-sm text-orange-300">{booking.appointmentTime}</p>
                    <p className="mt-1 text-xs text-slate-400">{booking.companyName}</p>
                  </div>
                  <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    View
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0f172a]/95 p-6">
          <h2 className="text-lg font-bold text-white">Booking Details</h2>
          {selectedBooking ? (
            <div className="mt-4 space-y-4">
              <DetailRow label="Name" value={selectedBooking.name} />
              <DetailRow label="Email" value={selectedBooking.email} />
              <DetailRow
                label="Phone"
                value={
                  selectedBooking.countryCode
                    ? `${selectedBooking.countryCode} ${selectedBooking.phone}`
                    : selectedBooking.phone
                }
              />
              <DetailRow label="Company" value={selectedBooking.companyName} />
              <DetailRow label="Website" value={selectedBooking.websiteUrl || '—'} />
              <DetailRow label="Budget" value={selectedBooking.budget} />
              <DetailRow label="Date" value={formatLongDate(selectedBooking.appointmentDate)} />
              <DetailRow
                label="Time"
                value={`${selectedBooking.appointmentTime} (${selectedBooking.timezone || 'Timezone not set'})`}
              />
              <DetailRow label="Source" value={selectedBooking.source} />
              <DetailRow label="Submitted" value={formatCreatedAt(selectedBooking.createdAt)} />
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">Notes</p>
                <p className="mt-2 whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-slate-300">
                  {selectedBooking.callNotes || '—'}
                </p>
              </div>

              {canDelete ? (
                <button
                  type="button"
                  onClick={() => setDeleteConfirmBooking(selectedBooking)}
                  disabled={deletingId === selectedBooking.id}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                >
                  <TrashIcon className="h-4 w-4" />
                  {deletingId === selectedBooking.id ? 'Deleting...' : 'Delete Booking'}
                </button>
              ) : (
                <p className="text-xs text-slate-500">Only admins can delete scheduled calls.</p>
              )}
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-6 text-sm text-slate-500">
              Select a booking to view contact details, budget, and call notes.
            </p>
          )}
        </div>
      </section>

      {deleteConfirmBooking ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white">Delete this booking?</h3>
            <p className="mt-2 text-sm text-slate-400">
              This removes <span className="font-semibold text-white">{deleteConfirmBooking.name}</span> on{' '}
              {formatLongDate(deleteConfirmBooking.appointmentDate)} at {deleteConfirmBooking.appointmentTime} from
              the dashboard calendar and Google Calendar (when configured). This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmBooking(null)}
                disabled={deletingId === deleteConfirmBooking.id}
                className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteBooking(deleteConfirmBooking)}
                disabled={deletingId === deleteConfirmBooking.id}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deletingId === deleteConfirmBooking.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-200">{value}</p>
    </div>
  )
}
