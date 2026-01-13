// Rate Limiting (쿠키 기반 간단 구현)

const RATE_LIMITS = {
  posts: { max: 5, windowMs: 3600000 },      // 시간당 5개
  comments: { max: 20, windowMs: 3600000 },  // 시간당 20개
} as const

type ActionType = keyof typeof RATE_LIMITS

interface RateLimitData {
  count: number
  resetAt: number
}

export function checkRateLimit(
  cookies: { get: (name: string) => { value: string } | undefined },
  action: ActionType
): { allowed: boolean; remaining: number; resetAt: number } {
  const limit = RATE_LIMITS[action]
  const cookieName = `rate_limit_${action}`
  const now = Date.now()

  try {
    const cookie = cookies.get(cookieName)
    if (cookie) {
      const data: RateLimitData = JSON.parse(cookie.value)

      // 윈도우 만료 확인
      if (now > data.resetAt) {
        return {
          allowed: true,
          remaining: limit.max - 1,
          resetAt: now + limit.windowMs
        }
      }

      // 제한 확인
      if (data.count >= limit.max) {
        return {
          allowed: false,
          remaining: 0,
          resetAt: data.resetAt
        }
      }

      return {
        allowed: true,
        remaining: limit.max - data.count - 1,
        resetAt: data.resetAt
      }
    }
  } catch {
    // 파싱 실패 시 허용
  }

  return {
    allowed: true,
    remaining: limit.max - 1,
    resetAt: now + limit.windowMs
  }
}

export function getRateLimitCookie(
  cookies: { get: (name: string) => { value: string } | undefined },
  action: ActionType
): { name: string; value: string; options: { path: string; maxAge: number; httpOnly: boolean } } {
  const limit = RATE_LIMITS[action]
  const cookieName = `rate_limit_${action}`
  const now = Date.now()

  let data: RateLimitData = {
    count: 1,
    resetAt: now + limit.windowMs
  }

  try {
    const cookie = cookies.get(cookieName)
    if (cookie) {
      const existing: RateLimitData = JSON.parse(cookie.value)

      if (now <= existing.resetAt) {
        data = {
          count: existing.count + 1,
          resetAt: existing.resetAt
        }
      }
    }
  } catch {
    // 파싱 실패 시 새로 시작
  }

  return {
    name: cookieName,
    value: JSON.stringify(data),
    options: {
      path: '/',
      maxAge: Math.ceil(limit.windowMs / 1000),
      httpOnly: true
    }
  }
}
