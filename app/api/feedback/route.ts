import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { getClientIp } from '@/lib/server/client-ip'
import { checkServerRateLimit, getRetryAfterSeconds } from '@/lib/server/rate-limit'

const FEEDBACK_RATE_LIMIT = {
  max: 6,
  windowMs: 60 * 1000,
}

function sanitizePlainText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  const sanitized = value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!sanitized) return null
  return sanitized.slice(0, maxLength)
}

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request)
  const rateLimit = checkServerRateLimit(`feedback:${clientIp}`, FEEDBACK_RATE_LIMIT)
  const rateLimitHeaders = {
    'X-RateLimit-Limit': String(FEEDBACK_RATE_LIMIT.max),
    'X-RateLimit-Remaining': String(rateLimit.remaining),
    'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetAt / 1000)),
  }

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
      {
        status: 429,
        headers: {
          ...rateLimitHeaders,
          'Retry-After': String(getRetryAfterSeconds(rateLimit.resetAt)),
        },
      }
    )
  }

  try {
    const body = await request.json()
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: '잘못된 요청 형식입니다.' },
        { status: 400, headers: rateLimitHeaders }
      )
    }

    const { rating, comment, address, category, riskScore } = body as {
      rating?: number
      comment?: unknown
      address?: unknown
      category?: unknown
      riskScore?: unknown
    }

    // 유효성 검사
    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: '별점은 1~5 사이여야 합니다.' },
        { status: 400, headers: rateLimitHeaders }
      )
    }

    const normalizedComment = sanitizePlainText(comment, 1000)
    const normalizedAddress = sanitizePlainText(address, 200)
    const normalizedCategory = sanitizePlainText(category, 80)
    const normalizedRiskScore = typeof riskScore === 'number'
      ? Math.max(0, Math.min(100, Math.round(riskScore)))
      : null

    const supabase = getSupabase()

    // 피드백 저장
    const { error } = await supabase
      .from('feedbacks')
      .insert({
        rating,
        comment: normalizedComment,
        address: normalizedAddress,
        category: normalizedCategory,
        risk_score: normalizedRiskScore,
        created_at: new Date().toISOString(),
      })

    if (error) {
      console.error('Feedback save error:', error)
      return NextResponse.json(
        { error: '피드백 저장에 실패했습니다.' },
        { status: 500, headers: rateLimitHeaders }
      )
    }

    return NextResponse.json({ success: true }, { headers: rateLimitHeaders })
  } catch (error) {
    console.error('Feedback API error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500, headers: rateLimitHeaders }
    )
  }
}
