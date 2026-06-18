type RateLimitOptions = {
  key: string
  limit: number
  windowMs: number
}

type RateLimitResult =
  | {
      ok: true
      remaining: number
      resetAt: number
    }
  | {
      ok: false
      remaining: 0
      resetAt: number
    }

type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

function now() {
  return Date.now()
}

export function getRateLimitIdentity(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for') || ''
  const ip = forwardedFor.split(',')[0]?.trim()
  if (ip) return ip

  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp

  return 'unknown'
}

export function applyRateLimit(options: RateLimitOptions): RateLimitResult {
  const currentTime = now()
  const existing = buckets.get(options.key)

  if (!existing || existing.resetAt <= currentTime) {
    const resetAt = currentTime + options.windowMs
    buckets.set(options.key, { count: 1, resetAt })
    return {
      ok: true,
      remaining: Math.max(options.limit - 1, 0),
      resetAt,
    }
  }

  if (existing.count >= options.limit) {
    return {
      ok: false,
      remaining: 0,
      resetAt: existing.resetAt,
    }
  }

  existing.count += 1
  return {
    ok: true,
    remaining: Math.max(options.limit - existing.count, 0),
    resetAt: existing.resetAt,
  }
}
