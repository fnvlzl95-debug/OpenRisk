import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { GRADE_INFO } from '@/lib/types'
import { calculateGrade, getGradeCopy } from '@/lib/engine'

// Lazy initialization for Supabase client
let supabaseInstance: SupabaseClient | null = null

function getSupabase(): SupabaseClient {
  if (supabaseInstance) return supabaseInstance

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Supabase 환경변수가 설정되지 않았습니다.')
  }

  supabaseInstance = createClient(url, key)
  return supabaseInstance
}

const KAKAO_REST_KEY = process.env.KAKAO_REST_KEY

// 카카오 Local API로 좌표 검색
async function getCoordinatesFromKakao(query: string): Promise<{ lat: number; lng: number } | null> {
  if (!KAKAO_REST_KEY) return null

  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`,
      {
        headers: {
          Authorization: `KakaoAK ${KAKAO_REST_KEY}`
        }
      }
    )

    if (!res.ok) {
      console.error('Kakao API error:', res.status, await res.text())
      return null
    }

    const data = await res.json()
    if (data.documents && data.documents.length > 0) {
      const doc = data.documents[0]
      return {
        lat: parseFloat(doc.y),
        lng: parseFloat(doc.x)
      }
    }
  } catch (error) {
    console.error('Kakao API fetch error:', error)
  }

  return null
}

// 좌표 기반으로 상권 찾기 (폴리곤 포함 우선 → nearest fallback)
async function findAreaByPoint(lat: number, lng: number) {
  const supabase = getSupabase()
  const { data, error } = await supabase.rpc('find_area_by_point', {
    p_lat: lat,
    p_lng: lng
  })

  if (error) {
    console.error('find_area_by_point error:', error)
    return null
  }

  if (!data || data.length === 0) return null

  const areaBasic = data[0]

  // RPC에서 polygon이 없으면 별도로 조회
  if (!areaBasic.polygon) {
    const { data: areaWithPolygon } = await supabase
      .from('trade_areas')
      .select('polygon')
      .eq('id', areaBasic.id)
      .single()

    if (areaWithPolygon?.polygon) {
      areaBasic.polygon = areaWithPolygon.polygon
    }
  }

  return areaBasic
}

// 키워드 → 실제 상권명 매핑 (폴백용)
const AREA_ALIASES: Record<string, string[]> = {
  '홍대': ['홍대입구역', '홍대입구역 1번', '홍대입구역 2번', '홍대입구역(2호선)'],
  '강남': ['강남역', '강남역 1번', '강남역(2호선)'],
  '신촌': ['신촌역', '신촌역(2호선)', '신촌로터리'],
  '이태원': ['이태원역', '이태원로', '이태원(6호선)'],
  '합정': ['합정역', '합정역(2호선)'],
  '망원': ['망원역', '망원동'],
  '성수': ['성수역', '성수동', '성수(2호선)'],
}

// DB에서 상권명으로 직접 검색 (폴백)
async function findAreaByName(query: string) {
  const supabase = getSupabase()
  const normalizedQuery = query.trim()
  const aliasTargets = AREA_ALIASES[normalizedQuery]

  // 필요한 컬럼 선택 (polygon GeoJSON 포함)
  const AREA_COLUMNS = 'id,name,district,center_lat,center_lng,polygon'

  if (aliasTargets) {
    for (const target of aliasTargets) {
      const { data } = await supabase
        .from('trade_areas')
        .select(AREA_COLUMNS)
        .ilike('name', `%${target}%`)
        .limit(1)
        .single()

      if (data) return data
    }
  }

  const { data: matches } = await supabase
    .from('trade_areas')
    .select(AREA_COLUMNS)
    .ilike('name', `%${normalizedQuery}%`)
    .limit(10)

  if (matches && matches.length > 0) {
    const priorityDistricts = ['마포구', '강남구', '서초구', '용산구', '성동구']
    const prioritized = matches.find(m =>
      priorityDistricts.some(d => m.district?.includes(d))
    )
    return prioritized || matches[0]
  }

  const { data: districtMatches } = await supabase
    .from('trade_areas')
    .select(AREA_COLUMNS)
    .ilike('district', `%${normalizedQuery}%`)
    .limit(5)

  if (districtMatches && districtMatches.length > 0) {
    return districtMatches[0]
  }

  return null
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('query')

  if (!query) {
    return NextResponse.json({ error: '검색어가 필요합니다.' }, { status: 400 })
  }

  try {
    const supabase = getSupabase()
    let area = null

    // 1. 카카오 API로 좌표 검색 → 폴리곤 포함/nearest 상권 찾기
    const coords = await getCoordinatesFromKakao(query)
    if (coords) {
      area = await findAreaByPoint(coords.lat, coords.lng)
    }

    // 2. 카카오 실패 시 DB에서 상권명으로 직접 검색 (폴백)
    if (!area) {
      area = await findAreaByName(query)
    }

    if (!area) {
      return NextResponse.json({
        error: '해당 상권을 찾을 수 없습니다. 홍대, 강남, 신촌, 이태원, 합정, 망원, 성수 지역을 검색해보세요.'
      }, { status: 404 })
    }

    // 2. 해당 상권의 지표 조회 (필요한 컬럼만)
    const { data: metrics } = await supabase
      .from('area_metrics')
      .select('period,traffic_index,daypart_variance,weekend_ratio,resident_index,worker_index')
      .eq('area_id', area.id)
      .order('period', { ascending: false })
      .limit(1)
      .single()

    // 3. 지표가 없으면 "데이터 없음" 처리
    if (!metrics || metrics.traffic_index === null) {
      return NextResponse.json({
        error: `"${area.name}" 상권의 분석 데이터가 아직 없습니다. 다른 상권을 검색해보세요.`
      }, { status: 404 })
    }

    // 4. 등급 계산
    const gradeResult = calculateGrade({
      traffic_index: metrics.traffic_index || 0,
      daypart_variance: metrics.daypart_variance || 0,
      weekend_ratio: metrics.weekend_ratio || 0
    })

    // 5. 해석 문구 가져오기
    const copy = getGradeCopy(gradeResult.grade)
    const gradeInfo = GRADE_INFO[gradeResult.grade]

    // 6. 원본 데이터 계산
    const trafficTotal = Math.round(metrics.traffic_index * 10000)
    const weekendRatio = metrics.weekend_ratio || 0
    const trafficWeekend = Math.round(trafficTotal * weekendRatio)
    const trafficWeekday = trafficTotal - trafficWeekend

    // 7. 응답 구성
    const result = {
      area: {
        id: area.id,
        name: area.name,
        district: area.district,
        center: { lat: area.center_lat, lng: area.center_lng },
        polygon: area.polygon || null
      },
      rawMetrics: {
        period: metrics.period,
        traffic_total: trafficTotal,
        traffic_weekday: trafficWeekday,
        traffic_weekend: trafficWeekend,
        resident_index: metrics.resident_index || 0,
        worker_index: metrics.worker_index || 0
      },
      lv3_5: {
        grade: gradeResult.grade,
        gradeName: gradeInfo.name,
        subTitle: gradeInfo.subTitle,
        difficulty: gradeInfo.difficulty,
        confidence: gradeResult.confidence,
        reasons: gradeResult.reasons,
        coreCopy: copy.coreCopy,
        actions: copy.actions,
        risks: copy.risks
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Analysis error:', error)
    return NextResponse.json({ error: '분석 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
