import { NextResponse } from 'next/server'
import { deleteStrategyCallCalendarEventForBooking } from '@/lib/google-calendar-strategy-call'
import { requireAdminOrSuperAdmin } from '@/lib/server-admin-auth'
import {
  deleteStrategyCallBooking,
  getStrategyCallBookingById,
  isStrategyCallStorageConfigured,
} from '@/lib/strategy-call-bookings'

type RouteParams = { id: string }

export async function DELETE(
  request: Request,
  { params }: { params: RouteParams | Promise<RouteParams> }
) {
  const auth = await requireAdminOrSuperAdmin(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (!isStrategyCallStorageConfigured()) {
    return NextResponse.json({ error: 'Strategy call storage is not configured.' }, { status: 503 })
  }

  const resolvedParams = params instanceof Promise ? await params : params
  const bookingId = resolvedParams.id ? Number.parseInt(resolvedParams.id, 10) : NaN

  if (!Number.isFinite(bookingId) || bookingId < 1) {
    return NextResponse.json({ error: 'Invalid booking ID' }, { status: 400 })
  }

  try {
    const booking = await getStrategyCallBookingById(bookingId)
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    let calendarDeleted = false
    let calendarWarning: string | null = null

    try {
      const calendarResult = await deleteStrategyCallCalendarEventForBooking({
        calendarEventId: booking.calendarEventId,
        name: booking.name,
        companyName: booking.companyName,
        appointmentDate: booking.appointmentDate,
        appointmentTime: booking.appointmentTime,
        timezone: booking.timezone,
      })
      calendarDeleted = calendarResult.deleted === true
      if (calendarResult.deleted === false && calendarResult.reason === 'not_configured') {
        calendarWarning = 'Google Calendar is not configured on the CRM; database record was still removed.'
      }
    } catch (calendarError) {
      calendarWarning =
        calendarError instanceof Error
          ? `Google Calendar event could not be removed: ${calendarError.message}`
          : 'Google Calendar event could not be removed.'
    }

    await deleteStrategyCallBooking(bookingId)

    return NextResponse.json({
      ok: true,
      id: bookingId,
      calendarDeleted,
      ...(calendarWarning ? { calendarWarning } : {}),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete booking'
    const status = message === 'Booking not found' ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
