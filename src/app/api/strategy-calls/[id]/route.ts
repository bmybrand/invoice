import { NextResponse } from 'next/server'
import { requireAdminOrSuperAdmin } from '@/lib/server-admin-auth'
import { deleteStrategyCallBooking, isStrategyCallStorageConfigured } from '@/lib/strategy-call-bookings'

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
    await deleteStrategyCallBooking(bookingId)
    return NextResponse.json({ ok: true, id: bookingId })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete booking'
    const status = message === 'Booking not found' ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
