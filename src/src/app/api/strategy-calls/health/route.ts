import { NextResponse } from 'next/server'
import { requireActiveEmployee } from '@/lib/server-employee-auth'
import {
  getStrategyCallStorageSetupHint,
  isStrategyCallStorageConfigured,
  listStrategyCallBookings,
} from '@/lib/strategy-call-bookings'

export async function GET(request: Request) {
  const auth = await requireActiveEmployee(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (!isStrategyCallStorageConfigured()) {
    return NextResponse.json({
      ok: false,
      configured: false,
      hint: getStrategyCallStorageSetupHint(),
    })
  }

  try {
    const from = new Date()
    from.setDate(1)
    const to = new Date(from.getFullYear(), from.getMonth() + 1, 0)
    const pad = (n: number) => String(n).padStart(2, '0')
    const fromKey = `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`
    const toKey = `${to.getFullYear()}-${pad(to.getMonth() + 1)}-${pad(to.getDate())}`

    const bookings = await listStrategyCallBookings({ from: fromKey, to: toKey })

    return NextResponse.json({
      ok: true,
      configured: true,
      bookingCount: bookings.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Health check failed'
    return NextResponse.json({
      ok: false,
      configured: true,
      error: message,
    })
  }
}
