import { getMysqlPool, isMysqlConfigured } from '@/lib/mysql'

export type StrategyCallBooking = {
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
  calendarEventId: string
  createdAt: string
}

function getBridgeConfig() {
  const url = (
    process.env.MYSQL_BRIDGE_URL ||
    process.env.STRATEGY_CALL_BRIDGE_URL ||
    ''
  )
    .trim()
    .replace(/\/$/, '')
  const secret = (
    process.env.MYSQL_BRIDGE_SECRET ||
    process.env.STRATEGY_CALL_BRIDGE_SECRET ||
    ''
  ).trim()

  if (!url || !secret) {
    return null
  }

  return { url, secret }
}

export function getStrategyCallStorageSetupHint(): string {
  return [
    'Add MYSQL_BRIDGE_URL and MYSQL_BRIDGE_SECRET to the CRM Vercel project (dashboard.bmybrand.com).',
    'Use the same values as the brand site (bmybrand.com) Vercel project, then redeploy the CRM.',
    'Also upload the latest cpanel-bridge/strategy-call.php to cPanel if list/delete was not added yet.',
  ].join(' ')
}

function buildBridgeUrl(baseUrl: string, secret: string, params: Record<string, string> = {}) {
  const url = new URL(baseUrl)
  url.searchParams.set('token', secret)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

function bridgeHeaders(secret: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${secret}`,
  }
}

function mapMysqlRow(row: Record<string, unknown>): StrategyCallBooking {
  return {
    id: Number(row.id),
    email: String(row.email ?? ''),
    name: String(row.name ?? ''),
    countryCode: String(row.country_code ?? ''),
    phone: String(row.phone ?? ''),
    companyName: String(row.company_name ?? ''),
    websiteUrl: String(row.website_url ?? ''),
    budget: String(row.budget ?? ''),
    callNotes: String(row.call_notes ?? ''),
    source: String(row.source ?? ''),
    appointmentDate: String(row.appointment_date ?? ''),
    appointmentTime: String(row.appointment_time ?? ''),
    timezone: String(row.timezone ?? ''),
    calendarEventId: String(row.calendar_event_id ?? row.calendarEventId ?? ''),
    createdAt: String(row.created_at ?? row.createdAt ?? ''),
  }
}

export function isStrategyCallStorageConfigured(): boolean {
  return Boolean(getBridgeConfig()) || isMysqlConfigured()
}

export async function listStrategyCallBookings(input?: {
  from?: string
  to?: string
}): Promise<StrategyCallBooking[]> {
  const bridge = getBridgeConfig()

  if (bridge) {
    const params: Record<string, string> = { list: '1' }
    if (input?.from) params.from = input.from
    if (input?.to) params.to = input.to

    const response = await fetch(buildBridgeUrl(bridge.url, bridge.secret, params), {
      method: 'GET',
      headers: bridgeHeaders(bridge.secret),
      cache: 'no-store',
    })

    const data = (await response.json().catch(() => null)) as
      | { bookings?: StrategyCallBooking[]; error?: string }
      | null

    if (!response.ok) {
      throw new Error(data?.error || 'Could not load strategy call bookings from bridge.')
    }

    return data?.bookings ?? []
  }

  if (!isMysqlConfigured()) {
    throw new Error(
      'Strategy call storage is not configured. Set MYSQL_BRIDGE_URL + MYSQL_BRIDGE_SECRET or MYSQL_HOST, MYSQL_USER, and MYSQL_DATABASE.'
    )
  }

  const pool = getMysqlPool()
  const conditions = ['appointment_date IS NOT NULL']
  const values: string[] = []

  if (input?.from) {
    conditions.push('appointment_date >= ?')
    values.push(input.from)
  }
  if (input?.to) {
    conditions.push('appointment_date <= ?')
    values.push(input.to)
  }

  const [rows] = await pool.execute(
    `SELECT id, email, name, country_code, phone, company_name, website_url,
            budget, call_notes, source, appointment_date, appointment_time, timezone,
            calendar_event_id, created_at
     FROM strategy_call_bookings
     WHERE ${conditions.join(' AND ')}
     ORDER BY appointment_date ASC, appointment_time ASC, id ASC`,
    values
  )

  if (!Array.isArray(rows)) {
    return []
  }

  return rows.map((row) => mapMysqlRow(row as Record<string, unknown>))
}

export async function getStrategyCallBookingById(id: number): Promise<StrategyCallBooking | null> {
  const bridge = getBridgeConfig()

  if (bridge) {
    const response = await fetch(
      buildBridgeUrl(bridge.url, bridge.secret, { id: String(id) }),
      {
        method: 'GET',
        headers: bridgeHeaders(bridge.secret),
        cache: 'no-store',
      }
    )

    const data = (await response.json().catch(() => null)) as
      | { booking?: StrategyCallBooking; error?: string }
      | null

    if (response.status === 404) {
      return null
    }

    if (!response.ok || !data?.booking) {
      throw new Error(data?.error || 'Could not load strategy call booking.')
    }

    return mapMysqlRow(data.booking as unknown as Record<string, unknown>)
  }

  if (!isMysqlConfigured()) {
    throw new Error('Strategy call storage is not configured.')
  }

  const pool = getMysqlPool()
  const [rows] = await pool.execute(
    `SELECT id, email, name, country_code, phone, company_name, website_url,
            budget, call_notes, source, appointment_date, appointment_time, timezone,
            calendar_event_id, created_at
     FROM strategy_call_bookings
     WHERE id = ?
     LIMIT 1`,
    [id]
  )

  if (!Array.isArray(rows) || rows.length === 0) {
    return null
  }

  return mapMysqlRow(rows[0] as Record<string, unknown>)
}

export async function deleteStrategyCallBooking(id: number): Promise<void> {
  const bridge = getBridgeConfig()

  if (bridge) {
    const response = await fetch(buildBridgeUrl(bridge.url, bridge.secret), {
      method: 'POST',
      headers: bridgeHeaders(bridge.secret),
      body: JSON.stringify({ action: 'delete', id }),
      cache: 'no-store',
    })

    const data = (await response.json().catch(() => null)) as { error?: string } | null

    if (!response.ok) {
      throw new Error(data?.error || 'Could not delete strategy call booking.')
    }

    return
  }

  if (!isMysqlConfigured()) {
    throw new Error('Strategy call storage is not configured.')
  }

  const pool = getMysqlPool()
  const [result] = await pool.execute('DELETE FROM strategy_call_bookings WHERE id = ? LIMIT 1', [id])

  const affectedRows =
    typeof result === 'object' && result !== null && 'affectedRows' in result
      ? Number((result as { affectedRows: number }).affectedRows)
      : 0

  if (affectedRows < 1) {
    throw new Error('Booking not found')
  }
}
