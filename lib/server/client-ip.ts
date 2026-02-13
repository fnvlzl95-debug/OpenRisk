import { NextRequest } from 'next/server'

const IP_HEADERS = ['cf-connecting-ip', 'x-real-ip', 'x-forwarded-for'] as const

function normalizeIp(raw: string): string {
  const first = raw.split(',')[0]?.trim()
  return first || 'unknown'
}

export function getClientIp(request: NextRequest): string {
  for (const header of IP_HEADERS) {
    const value = request.headers.get(header)
    if (value) {
      return normalizeIp(value)
    }
  }

  return 'unknown'
}
