import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { GRADE_INFO, ChangeIndicator, Anchors, LocationStatus, LocationStatusType } from '@/lib/types'
import { calculateGrade, calculateMarketingElasticity, getGradeCopy } from '@/lib/engine'

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

// 카카오 Local API로 좌표 검색 (키워드 + 주소 검색 병행)
async function getCoordinatesFromKakao(query: string): Promise<{ lat: number; lng: number } | null> {
  if (!KAKAO_REST_KEY) return null

  // 1. 먼저 키워드 검색 시도
  try {
    const keywordRes = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`,
      {
        headers: {
          Authorization: `KakaoAK ${KAKAO_REST_KEY}`
        }
      }
    )

    if (keywordRes.ok) {
      const data = await keywordRes.json()
      if (data.documents && data.documents.length > 0) {
        const doc = data.documents[0]
        return {
          lat: parseFloat(doc.y),
          lng: parseFloat(doc.x)
        }
      }
    }
  } catch (error) {
    console.error('Kakao keyword API error:', error)
  }

  // 2. 키워드 검색 실패 시 주소 검색 시도 (주소 형태의 쿼리 지원)
  try {
    const addressRes = await fetch(
      `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}&size=1`,
      {
        headers: {
          Authorization: `KakaoAK ${KAKAO_REST_KEY}`
        }
      }
    )

    if (addressRes.ok) {
      const data = await addressRes.json()
      if (data.documents && data.documents.length > 0) {
        const doc = data.documents[0]
        return {
          lat: parseFloat(doc.y),
          lng: parseFloat(doc.x)
        }
      }
    }
  } catch (error) {
    console.error('Kakao address API error:', error)
  }

  return null
}

// 위치 상태에 따른 안내 문구 생성
function getConfidenceNote(status: LocationStatusType, areaName: string, distance: number | null): string {
  switch (status) {
    case 'IN':
      return `검색 위치가 ${areaName} 상권 영역 안에 있습니다.`
    case 'NEAR':
      return `${areaName} 상권에서 ${Math.round(distance || 0)}m 거리입니다. 참고용 데이터입니다.`
    case 'OUTSIDE':
      return `가장 가까운 상권(${areaName})에서 ${Math.round(distance || 0)}m 떨어져 있습니다. 분석 정확도가 낮을 수 있습니다.`
    default:
      return ''
  }
}

// 좌표 기반으로 상권 찾기 (폴리곤 포함 우선 → nearest fallback, 경계 처리 포함)
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
    let searchedLocation: { lat: number; lng: number } | null = null
    const coords = await getCoordinatesFromKakao(query)
    if (coords) {
      searchedLocation = coords
      area = await findAreaByPoint(coords.lat, coords.lng)
    }

    // 2. 카카오 실패 시 DB에서 상권명으로 직접 검색 (폴백)
    // 이름 검색은 위치 기반이 아니므로 location_status를 알 수 없음
    if (!area) {
      const nameResult = await findAreaByName(query)
      if (nameResult) {
        area = {
          ...nameResult,
          location_status: 'IN',  // 이름 검색은 상권 직접 지정이므로 IN으로 간주
          distance: null
        }
      }
    }

    if (!area) {
      return NextResponse.json({
        error: '해당 상권을 찾을 수 없습니다. 홍대, 강남, 신촌, 이태원, 합정, 망원, 성수 지역을 검색해보세요.'
      }, { status: 404 })
    }

    // 2. 해당 상권의 지표 조회 (Phase 2: 8지표 포함)
    const { data: metrics } = await supabase
      .from('area_metrics')
      .select('period,traffic_index,daypart_variance,weekend_ratio,resident_index,worker_index,competition_density,open_close_churn,cost_proxy')
      .eq('area_id', area.id)
      .order('period', { ascending: false })
      .limit(1)
      .single()

    // 2-1. 앵커 시설 조회 (Phase 2-C)
    const { data: anchorsData } = await supabase
      .from('area_anchors')
      .select('anchor_type')
      .eq('area_id', area.id)

    const anchors: Anchors = {
      subway: anchorsData?.some(a => a.anchor_type === 'subway') ?? false,
      university: anchorsData?.some(a => a.anchor_type === 'university') ?? false,
      hospital: anchorsData?.some(a => a.anchor_type === 'hospital') ?? false
    }

    // 2-2. 상권변화지표 조회 (Phase 2-C)
    const { data: changeData } = await supabase
      .from('area_change_indicators')
      .select('indicator')
      .eq('area_id', area.id)
      .order('period', { ascending: false })
      .limit(1)
      .single()

    const changeIndicator: ChangeIndicator = changeData?.indicator ?? null

    // 3. 지표가 없으면 "데이터 없음" 처리
    if (!metrics || metrics.traffic_index === null) {
      return NextResponse.json({
        error: `"${area.name}" 상권의 분석 데이터가 아직 없습니다. 다른 상권을 검색해보세요.`
      }, { status: 404 })
    }

    // 📊 지표 조회 결과 로깅
    console.log('\n========== 상권 분석 지표 ==========')
    console.log(`🔍 검색어: ${query}`)
    console.log(`📍 상권명: ${area.name} (${area.district})`)
    console.log(`📅 기준기간: ${metrics.period}`)
    console.log('--- 기본 지표 ---')
    console.log(`  traffic_index: ${metrics.traffic_index}`)
    console.log(`  daypart_variance: ${metrics.daypart_variance}`)
    console.log(`  weekend_ratio: ${metrics.weekend_ratio}`)
    console.log('--- Phase 2 확장 지표 ---')
    console.log(`  resident_index: ${metrics.resident_index}`)
    console.log(`  worker_index: ${metrics.worker_index}`)
    console.log(`  competition_density: ${metrics.competition_density}`)
    console.log(`  open_close_churn: ${metrics.open_close_churn}`)
    console.log(`  cost_proxy: ${metrics.cost_proxy}`)
    console.log('=====================================\n')

    // 4. 등급 계산 (Phase 2: 8지표 사용)
    const gradeResult = calculateGrade({
      traffic_index: metrics.traffic_index || 0,
      daypart_variance: metrics.daypart_variance || 0,
      weekend_ratio: metrics.weekend_ratio || 0,
      resident_index: metrics.resident_index || 0,
      worker_index: metrics.worker_index || 0,
      competition_density: metrics.competition_density || 0,
      open_close_churn: metrics.open_close_churn || 0,
      cost_proxy: metrics.cost_proxy || 0
    })

    // 5. 마케팅 탄성 계산 (Phase 2-C)
    const hasAnchor = anchors.subway || anchors.university || anchors.hospital
    const marketingElasticity = calculateMarketingElasticity({
      weekend_ratio: metrics.weekend_ratio || 0,
      resident_index: metrics.resident_index || 0,
      worker_index: metrics.worker_index || 0,
      competition_density: metrics.competition_density || 0,
      hasAnchor
    })

    // 6. 해석 문구 가져오기
    const copy = getGradeCopy(gradeResult.grade)
    const gradeInfo = GRADE_INFO[gradeResult.grade]

    // 7. 원본 데이터 계산
    const trafficTotal = Math.round(metrics.traffic_index * 10000)
    const weekendRatio = metrics.weekend_ratio || 0
    const trafficWeekend = Math.round(trafficTotal * weekendRatio)
    const trafficWeekday = trafficTotal - trafficWeekend

    // 7-1. 데이터 커버리지 계산 (8개 지표 중 유효한 값 개수)
    const metricsAvailability = [
      metrics.traffic_index,
      metrics.daypart_variance,
      metrics.weekend_ratio,
      metrics.resident_index,
      metrics.worker_index,
      metrics.competition_density,
      metrics.open_close_churn,
      metrics.cost_proxy
    ]
    const availableMetrics = metricsAvailability.filter(v => v !== null && v !== undefined && v > 0).length
    const totalMetrics = 8

    // 8. 위치 상태 구성 (경계 처리)
    const locationStatusValue: LocationStatusType = area.location_status || 'IN'
    const locationDistance: number | null = area.distance || null
    const locationStatus: LocationStatus = {
      status: locationStatusValue,
      distance: locationDistance,
      confidenceNote: getConfidenceNote(locationStatusValue, area.name, locationDistance)
    }

    // 위치 상태 로깅
    console.log(`📍 위치 상태: ${locationStatusValue}${locationDistance ? ` (${Math.round(locationDistance)}m)` : ''}`)

    // 9. 응답 구성 (Phase 2-C: 주관적 지표 제거, 새 지표 추가)
    const result = {
      searchQuery: query,  // 사용자가 입력한 검색어
      area: {
        id: area.id,
        name: area.name,
        district: area.district,
        center: { lat: area.center_lat, lng: area.center_lng },
        polygon: area.polygon || null
      },
      searchedLocation,  // 사용자가 검색한 실제 위치 (지도에 표시용)
      locationStatus,
      rawMetrics: {
        period: metrics.period,
        traffic_total: trafficTotal,
        traffic_weekday: trafficWeekday,
        traffic_weekend: trafficWeekend,
        resident_index: metrics.resident_index || 0,
        worker_index: metrics.worker_index || 0
      },
      dataQuality: {
        availableMetrics,
        totalMetrics,
        coverage: availableMetrics >= 6 ? 'high' : availableMetrics >= 4 ? 'medium' : 'low'
      },
      analysis: {
        grade: gradeResult.grade,
        gradeName: gradeInfo.name,
        description: gradeInfo.description,
        reasons: gradeResult.reasons,
        anchors,
        changeIndicator,
        marketingElasticity
      },
      interpretation: {
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
