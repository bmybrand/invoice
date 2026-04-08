type ErrorLike = {
  message?: string
  code?: string
  details?: string
  hint?: string
  name?: string
}

const RECENT_LOGS = new Map<string, number>()
const REPEAT_SUPPRESS_MS = 15000

function normalize(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function toErrorLike(error: unknown): ErrorLike {
  if (!error || typeof error !== 'object') return {}
  return error as ErrorLike
}

function shouldSuppressRepeated(key: string): boolean {
  const now = Date.now()
  const prev = RECENT_LOGS.get(key) ?? 0
  if (now - prev < REPEAT_SUPPRESS_MS) return true
  RECENT_LOGS.set(key, now)
  return false
}

function isTransient(message: string, name: string): boolean {
  const text = `${name} ${message}`.toLowerCase()
  return (
    !text.trim() ||
    text.includes('abort') ||
    text.includes('networkerror') ||
    text.includes('failed to fetch') ||
    text.includes('timed out') ||
    text.includes("lock broken by another request with the 'steal' option")
  )
}

export function logFetchError(scope: string, error: unknown): void {
  const typed = toErrorLike(error)
  const message = normalize(typed.message)
  const code = normalize(typed.code)
  const details = normalize(typed.details)
  const hint = normalize(typed.hint)
  const name = normalize(typed.name)

  const key = `${scope}|${name}|${code}|${message}|${details}|${hint}`
  if (shouldSuppressRepeated(key)) return

  const transient = isTransient(message, name)
  const hasDetails = Boolean(message || code || details || hint || name)

  if (transient || !hasDetails) {
    if (message) {
      console.warn(`${scope}: ${message}`)
    }
    return
  }

  console.error(scope, {
    name,
    message,
    code,
    details,
    hint,
  })
}
