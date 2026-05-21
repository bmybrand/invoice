export function briefFormClientError(
  error: unknown,
  fallback: string
): string {
  const message = error instanceof Error ? error.message.trim() : ''
  const debug =
    process.env.NODE_ENV === 'development' ||
    process.env.BRIEF_FORMS_DEBUG === 'true'

  if (debug && message) {
    return message
  }

  return fallback
}

export function briefFormStorageSetupHint(): string | null {
  const usesBridge = Boolean(
    (process.env.CPANEL_BRIEF_FORMS_BRIDGE_URL || '').trim() &&
      (process.env.CPANEL_BRIEF_FORMS_BRIDGE_SECRET || '').trim()
  )
  const usesMysql = Boolean(
    process.env.MYSQL_HOST && process.env.MYSQL_USER && process.env.MYSQL_DATABASE
  )

  if (usesBridge) {
    return null
  }

  if (!usesMysql) {
    return 'Set CPANEL_BRIEF_FORMS_BRIDGE_URL + SECRET (production) or MYSQL_* (local).'
  }

  const host = (process.env.MYSQL_HOST || '').trim()
  if (host === '127.0.0.1' || host === 'localhost') {
    const user = (process.env.MYSQL_USER || '').trim()
    if (user.includes('_') && !['root', 'admin'].includes(user.toLowerCase())) {
      return (
        'MYSQL_HOST is localhost but MYSQL_USER looks like a cPanel account. ' +
        'Use your cPanel Remote MySQL hostname as MYSQL_HOST, or set CPANEL_BRIEF_FORMS_BRIDGE_URL for local dev.'
      )
    }
  }

  return null
}
