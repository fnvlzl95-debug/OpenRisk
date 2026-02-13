import { NextRequest, NextResponse } from 'next/server'
import { getClientIp } from '@/lib/server/client-ip'
import { checkServerRateLimit, getRetryAfterSeconds } from '@/lib/server/rate-limit'

const KAKAO_REST_KEY = process.env.KAKAO_REST_KEY
const SEARCH_RATE_LIMIT = { max: 45, windowMs: 60 * 1000 }
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000
const MAX_SEARCH_CACHE_SIZE = 2000

// 지원 지역 (서울, 경기, 인천, 부산)
const SUPPORTED_REGIONS = ['서울', '경기', '인천', '부산']

interface SearchResult {
  id: string
  name: string
  district: string
  display: string
  lat: number
  lng: number
  source: 'kakao'
}

interface SearchCacheEntry {
  results: SearchResult[]
  expiresAt: number
}

interface KakaoSearchDocument {
  id?: string
  x?: string
  y?: string
  place_name?: string
  address_name?: string
  road_address?: {
    address_name?: string
  }
  address?: {
    region_2depth_name?: string
  }
}

const searchCache = new Map<string, SearchCacheEntry>()

function sweepSearchCache(now: number) {
  for (const [key, entry] of searchCache.entries()) {
    if (entry.expiresAt <= now) {
      searchCache.delete(key)
    }
  }
}

export async function GET(request: NextRequest) {
  const clientIp = getClientIp(request)
  const rateLimit = checkServerRateLimit(`search:${clientIp}`, SEARCH_RATE_LIMIT)
  const rateLimitHeaders = {
    'X-RateLimit-Limit': String(SEARCH_RATE_LIMIT.max),
    'X-RateLimit-Remaining': String(rateLimit.remaining),
    'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetAt / 1000)),
  }

  if (!rateLimit.allowed) {
    return NextResponse.json(
      [],
      {
        status: 429,
        headers: {
          ...rateLimitHeaders,
          'Retry-After': String(getRetryAfterSeconds(rateLimit.resetAt)),
        },
      }
    )
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() || ''

  if (q.length < 2) {
    return NextResponse.json([], { headers: rateLimitHeaders })
  }

  if (!KAKAO_REST_KEY) {
    console.error('KAKAO_REST_KEY not set')
    return NextResponse.json([], { headers: rateLimitHeaders })
  }

  const cacheKey = q.toLowerCase()
  const now = Date.now()
  if (searchCache.size > MAX_SEARCH_CACHE_SIZE) {
    sweepSearchCache(now)
  }

  const cached = searchCache.get(cacheKey)
  if (cached && cached.expiresAt > now) {
    return NextResponse.json(cached.results, {
      headers: {
        ...rateLimitHeaders,
        'X-Search-Cache': 'HIT',
      },
    })
  }

  if (cached && cached.expiresAt <= now) {
    searchCache.delete(cacheKey)
  }

  try {
    const results = await searchKakao(q)
    // 지원 지역만 필터링
    const filtered = results.filter(r =>
      SUPPORTED_REGIONS.some(region => r.district.startsWith(region) || r.name.startsWith(region))
    )
    const sliced = filtered.slice(0, 8)
    searchCache.set(cacheKey, {
      results: sliced,
      expiresAt: now + SEARCH_CACHE_TTL_MS,
    })

    return NextResponse.json(sliced, {
      headers: {
        ...rateLimitHeaders,
        'X-Search-Cache': 'MISS',
      },
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json([], { headers: rateLimitHeaders })
  }
}

/**
 * 카카오 주소/장소 검색
 */
async function searchKakao(query: string) {
  const results: SearchResult[] = []

  const pushUniqueResult = (nextResult: SearchResult) => {
    const exists = results.some(
      (r) =>
        Math.abs(r.lat - nextResult.lat) < 0.0005 &&
        Math.abs(r.lng - nextResult.lng) < 0.0005
    )

    if (!exists) {
      results.push(nextResult)
    }
  }

  try {
    // 주소 검색 시도
    const addressRes = await fetch(
      `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}&size=5`,
      { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` } }
    )

    if (addressRes.ok) {
      const addressData = await addressRes.json()
      const docs = (addressData.documents || []) as KakaoSearchDocument[]

      for (const doc of docs) {
        const lat = Number.parseFloat(doc.y || '')
        const lng = Number.parseFloat(doc.x || '')
        if (Number.isNaN(lat) || Number.isNaN(lng)) {
          continue
        }

        pushUniqueResult({
          id: `kakao-addr-${doc.x}-${doc.y}`,
          name: doc.address_name || doc.road_address?.address_name || query,
          district: doc.address?.region_2depth_name || '',
          display: doc.address_name || doc.road_address?.address_name || query,
          lat,
          lng,
          source: 'kakao',
        })
      }
    }

    // 주소 검색만으로 충분하면 키워드 API는 생략
    if (results.length < 5) {
      const keywordRes = await fetch(
        `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=5`,
        { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` } }
      )

      if (keywordRes.ok) {
        const keywordData = await keywordRes.json()
        const docs = (keywordData.documents || []) as KakaoSearchDocument[]

        for (const doc of docs) {
          const lat = Number.parseFloat(doc.y || '')
          const lng = Number.parseFloat(doc.x || '')
          if (Number.isNaN(lat) || Number.isNaN(lng)) {
            continue
          }

          pushUniqueResult({
            id: `kakao-place-${doc.id}`,
            name: doc.place_name || query,
            district: doc.address_name?.split(' ').slice(0, 2).join(' ') || '',
            display: `${doc.place_name || query} (${doc.address_name?.split(' ').slice(1, 3).join(' ') || ''})`,
            lat,
            lng,
            source: 'kakao',
          })
        }
      }
    }
  } catch (error) {
    console.error('Kakao search error:', error)
  }

  return results
}
