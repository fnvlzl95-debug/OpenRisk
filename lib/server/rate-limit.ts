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
const UPSTASH_REDIS_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

function isRedisRateLimitEnabled(): boolean {
  return Boolean(UPSTASH_REDIS_URL && UPSTASH_REDIS_TOKEN)
}

function sweepExpiredEntries(now: number) {
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt <= now) {
      rateLimitStore.delete(key)
    }
  }
}

function checkInMemoryRateLimit(
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

async function checkRedisRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult | null> {
  if (!isRedisRateLimitEnabled()) {
    return null
  }

  try {
    const redisKey = `openrisk:rate:${key}`
    const response = await fetch(`${UPSTASH_REDIS_URL}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_REDIS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', redisKey],
        ['PEXPIRE', redisKey, config.windowMs, 'NX'],
        ['PTTL', redisKey],
      ]),
      cache: 'no-store',
    })

    if (!response.ok) {
      return null
    }

    const pipeline = await response.json() as Array<{ result?: number | string | null }>
    const incrementResult = pipeline?.[0]?.result
    const ttlResult = pipeline?.[2]?.result

    const count = typeof incrementResult === 'number'
      ? incrementResult
      : Number.parseInt(String(incrementResult ?? '0'), 10)

    const ttlMsRaw = typeof ttlResult === 'number'
      ? ttlResult
      : Number.parseInt(String(ttlResult ?? '-1'), 10)

    if (!Number.isFinite(count) || count <= 0) {
      return null
    }

    const ttlMs = ttlMsRaw > 0 ? ttlMsRaw : config.windowMs
    const resetAt = Date.now() + ttlMs

    return {
      allowed: count <= config.max,
      remaining: count >= config.max ? 0 : Math.max(config.max - count, 0),
      resetAt,
    }
  } catch {
    return null
  }
}

export async function checkServerRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redisResult = await checkRedisRateLimit(key, config)
  if (redisResult) {
    return redisResult
  }

  return checkInMemoryRateLimit(key, config)
}

export function getRetryAfterSeconds(resetAt: number): number {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
}
