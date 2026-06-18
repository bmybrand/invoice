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
    return NextResponse.json(
      {
        error: 'Strategy call storage is not configured.',
        hint: getStrategyCallStorageSetupHint(),
      },
      { status: 503 }
    )
  }

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')?.trim() || undefined
  const to = searchParams.get('to')?.trim() || undefined

  try {
    const bookings = await listStrategyCallBookings({ from, to })
    return NextResponse.json({ bookings })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load strategy call bookings'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
