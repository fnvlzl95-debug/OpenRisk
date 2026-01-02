import { NextRequest, NextResponse } from 'next/server'

const KAKAO_REST_KEY = process.env.KAKAO_REST_KEY

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')

  if (!q || q.length < 1) {
    return NextResponse.json([])
  }

  if (!KAKAO_REST_KEY) {
    console.error('KAKAO_REST_KEY not set')
    return NextResponse.json([])
  }

  try {
    const results = await searchKakao(q)
    return NextResponse.json(results.slice(0, 8))
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json([])
  }
}

/**
 * 카카오 주소/장소 검색
 */
async function searchKakao(query: string) {
  const results: Array<{
    id: string
    name: string
    district: string
    display: string
    lat: number
    lng: number
    source: 'kakao'
  }> = []

  try {
    // 주소 검색 시도
    const addressRes = await fetch(
      `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}&size=3`,
      { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` } }
    )

    if (addressRes.ok) {
      const addressData = await addressRes.json()
      for (const doc of addressData.documents || []) {
        results.push({
          id: `kakao-addr-${doc.x}-${doc.y}`,
          name: doc.address_name || doc.road_address?.address_name || query,
          district: doc.address?.region_2depth_name || '',
          display: doc.address_name || doc.road_address?.address_name || query,
          lat: parseFloat(doc.y),
          lng: parseFloat(doc.x),
          source: 'kakao',
        })
      }
    }

    // 키워드 검색 (장소)
    const keywordRes = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=3`,
      { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` } }
    )

    if (keywordRes.ok) {
      const keywordData = await keywordRes.json()
      for (const doc of keywordData.documents || []) {
        // 이미 추가된 위치인지 확인
        const exists = results.some(
          r => Math.abs(r.lat - parseFloat(doc.y)) < 0.0005 && Math.abs(r.lng - parseFloat(doc.x)) < 0.0005
        )
        if (!exists) {
          results.push({
            id: `kakao-place-${doc.id}`,
            name: doc.place_name,
            district: doc.address_name?.split(' ').slice(0, 2).join(' ') || '',
            display: `${doc.place_name} (${doc.address_name?.split(' ').slice(1, 3).join(' ') || ''})`,
            lat: parseFloat(doc.y),
            lng: parseFloat(doc.x),
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
