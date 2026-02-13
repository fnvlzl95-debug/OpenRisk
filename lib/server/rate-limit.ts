interface RateLimitConfig {
  max: number
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()
const MAX_STORE_SIZE = 10_000

function sweepExpiredEntries(now: number) {
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt <= now) {
      rateLimitStore.delete(key)
    }
  }
}

export function checkServerRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now()

  if (rateLimitStore.size > MAX_STORE_SIZE) {
    sweepExpiredEntries(now)
  }

  const entry = rateLimitStore.get(key)

  if (!entry || entry.resetAt <= now) {
    const resetAt = now + config.windowMs
    rateLimitStore.set(key, { count: 1, resetAt })
    return {
      allowed: true,
      remaining: Math.max(config.max - 1, 0),
      resetAt,
    }
  }

  if (entry.count >= config.max) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    }
  }

  entry.count += 1
  rateLimitStore.set(key, entry)
  return {
    allowed: true,
    remaining: Math.max(config.max - entry.count, 0),
    resetAt: entry.resetAt,
  }
}

export function getRetryAfterSeconds(resetAt: number): number {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
}
