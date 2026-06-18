import { google } from 'googleapis'

const CALL_DURATION_MINUTES = 30

const TIMEZONE_IANA: Record<string, string> = {
  'Asia/Mongolia/Ulaanbaatar': 'Asia/Ulaanbaatar',
  'Asia/Israel/Jerusalem': 'Asia/Jerusalem',
  'Asia/Afghanistan/Kabul': 'Asia/Kabul',
  'Asia/Russia/Kamchatka': 'Asia/Kamchatka',
  'Asia/Pakistan/Karachi': 'Asia/Karachi',
  'Asia/Uzbekistan/Tashkent': 'Asia/Tashkent',
  'Asia/Nepal/Kathmandu': 'Asia/Kathmandu',
  'Asia/India/Kolkata': 'Asia/Kolkata',
  'Asia/Russia/Krasnoyarsk': 'Asia/Krasnoyarsk',
}

export function isGoogleCalendarConfigured() {
  return Boolean(
    process.env.GOOGLE_CALENDAR_ID?.trim() &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()
  )
}

function getPrivateKey() {
  let raw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? ''
  raw = raw.trim()
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    raw = raw.slice(1, -1)
  }
  return raw.replace(/\\n/g, '\n')
}

function getCalendarErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'response' in error) {
    const res = (error as { response?: { data?: { error?: { message?: string } } } })
      .response?.data?.error?.message
    if (res) return res
  }
  if (error instanceof Error) return error.message
  return 'Unknown calendar error'
}

function toIanaTimezone(label: string) {
  if (!label) return 'UTC'
  if (/^[A-Za-z_]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?$/.test(label)) {
    return label
  }
  if (TIMEZONE_IANA[label]) return TIMEZONE_IANA[label]
  const parts = label.split('/').filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]}/${parts[parts.length - 1]}`
  }
  return 'UTC'
}

function parseTimeTo24h(timeLabel: string) {
  const trimmed = timeLabel.trim()
  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (match12) {
    let hours = Number(match12[1])
    const minutes = Number(match12[2])
    const period = match12[3].toUpperCase()
    if (period === 'PM' && hours !== 12) hours += 12
    if (period === 'AM' && hours === 12) hours = 0
    return { hours, minutes }
  }

  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/)
  if (match24) {
    return { hours: Number(match24[1]), minutes: Number(match24[2]) }
  }

  throw new Error(`Could not parse appointment time: ${timeLabel}`)
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function buildDateTimeParts(
  appointmentDate: string,
  appointmentTime: string,
  timezoneLabel: string
) {
  const { hours, minutes } = parseTimeTo24h(appointmentTime)
  const timeZone = toIanaTimezone(timezoneLabel)
  const [year, month, day] = appointmentDate.split('-').map(Number)
  const start = `${year}-${pad2(month)}-${pad2(day)}T${pad2(hours)}:${pad2(minutes)}:00`
  return { timeZone, start }
}

function getCalendarClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!.trim(),
    key: getPrivateKey(),
    scopes: ['https://www.googleapis.com/auth/calendar'],
  })

  return google.calendar({ version: 'v3', auth })
}

export async function deleteStrategyCallCalendarEvent(eventId: string) {
  if (!isGoogleCalendarConfigured()) {
    return { deleted: false as const, reason: 'not_configured' as const }
  }

  const calendarId = process.env.GOOGLE_CALENDAR_ID!.trim()
  const calendar = getCalendarClient()

  try {
    await calendar.events.delete({
      calendarId,
      eventId,
      sendUpdates: 'none',
    })
    return { deleted: true as const, eventId }
  } catch (error) {
    const message = getCalendarErrorMessage(error)
    if (/not found/i.test(message)) {
      return { deleted: false as const, reason: 'not_found' as const, eventId }
    }
    throw new Error(message)
  }
}

export async function deleteStrategyCallCalendarEventForBooking(input: {
  calendarEventId?: string | null
  name: string
  companyName: string
  appointmentDate: string
  appointmentTime: string
  timezone: string
}) {
  const eventId = input.calendarEventId?.trim()
  if (eventId) {
    return deleteStrategyCallCalendarEvent(eventId)
  }

  if (!isGoogleCalendarConfigured()) {
    return { deleted: false as const, reason: 'not_configured' as const }
  }

  const calendarId = process.env.GOOGLE_CALENDAR_ID!.trim()
  const { start } = buildDateTimeParts(
    input.appointmentDate,
    input.appointmentTime,
    input.timezone
  )
  const calendar = getCalendarClient()
  const summaryNeedle = `Strategy Call — ${input.name} (${input.companyName})`

  try {
    const list = await calendar.events.list({
      calendarId,
      timeMin: `${start.slice(0, 10)}T00:00:00Z`,
      timeMax: `${start.slice(0, 10)}T23:59:59Z`,
      singleEvents: true,
      maxResults: 50,
    })

    const match = (list.data.items ?? []).find((item) => item.summary === summaryNeedle)
    if (!match?.id) {
      return { deleted: false as const, reason: 'not_found' as const }
    }

    await calendar.events.delete({
      calendarId,
      eventId: match.id,
      sendUpdates: 'none',
    })

    return { deleted: true as const, eventId: match.id }
  } catch (error) {
    throw new Error(getCalendarErrorMessage(error))
  }
}
