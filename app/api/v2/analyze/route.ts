/**
 * OpenRisk v2.0 분석 API
 * POST /api/v2/analyze
 *
 * 포인트 기반 리스크 분석 (반경 500m 고정, 업종 필수)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import {
  latLngToH3,
  getH3CellsInRadius,
  h3ToLatLng,
  getDistance,
} from '@/lib/h3'
import {
  BusinessCategory,
  BUSINESS_CATEGORIES,
  getCategoryInfo,
  getCategoryName,
} from '@/lib/categories'
import {
  AnalyzeV2Request,
  AnalyzeV2Response,
  CompetitionMetrics,
  TrafficMetrics,
  TrafficLevel,
  CostMetrics,
  SurvivalMetrics,
  AnchorMetrics,
  GridStoreData,
  GridTrafficData,
  AreaType,
} from '@/lib/v2/types'
import {
  calculateRiskScore,
  getRiskLevel,
  determineAreaType,
  getCompetitionLevel,
  getTrafficLevel,
  getCostLevel,
  getSurvivalRisk,
  getPeakTime,
  generateInterpretation,
} from '@/lib/v2/riskEngine'
import {
  calculateClosureRisk,
  analyzeClosureRiskFactors,
} from '@/lib/v2/closure-risk'

// Supabase 클라이언트
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

// 카카오 API
const KAKAO_REST_KEY = process.env.KAKAO_REST_KEY

// 분석 반경 (고정)
const ANALYSIS_RADIUS = 500

export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeV2Request = await request.json()
    const { lat, lng, targetCategory } = body

    // 1. 입력 검증
    if (!lat || !lng || !targetCategory) {
      return NextResponse.json(
        { error: '위도, 경도, 업종을 모두 입력해주세요.' },
        { status: 400 }
      )
    }

    if (!BUSINESS_CATEGORIES[targetCategory]) {
      return NextResponse.json(
        { error: '유효하지 않은 업종입니다.' },
        { status: 400 }
      )
    }

    const supabase = getSupabase()

    // 2. H3 셀 계산
    const centerH3 = latLngToH3(lat, lng)
    const h3Cells = getH3CellsInRadius(lat, lng, ANALYSIS_RADIUS)

    // 3. 역지오코딩 (주소 조회)
    const addressInfo = await getAddressFromKakao(lat, lng)

    // 4. 그리드 데이터 조회
    const gridStoreData = await getGridStoreData(supabase, h3Cells)
    const gridTrafficData = await getGridTrafficData(supabase, h3Cells)

    // 5. 지표 계산
    const categoryInfo = getCategoryInfo(targetCategory)

    // 5-1. 경쟁 지표
    const competition = calculateCompetition(
      gridStoreData,
      targetCategory,
      lat,
      lng
    )

    // 5-2. 유동인구 지표
    const traffic = calculateTraffic(gridTrafficData)

    // 5-3. 임대료 지표
    const cost = await calculateCost(supabase, addressInfo.district)

    // 5-4. 앵커 시설
    const anchors = await calculateAnchors(supabase, lat, lng)

    // 5-5. 상권 유형 판별 (survival 계산에 필요)
    const storeCounts = aggregateStoreCounts(gridStoreData)
    const areaType = determineAreaType(
      { competition, traffic, anchors },
      storeCounts
    )

    // 5-6. 생존율 지표 (closure-risk.ts 추정 로직 사용)
    const survival = calculateSurvivalWithEstimation(
      gridStoreData,
      targetCategory,
      traffic.level,
      cost.level,
      areaType
    )

    // 6. 리스크 점수 계산
    const riskScore = calculateRiskScore(targetCategory, {
      competition,
      traffic,
      cost,
      survival,
      anchors,
    })
    const riskLevel = getRiskLevel(riskScore)

    // 8. 해석 문구 생성
    const interpretation = generateInterpretation(
      targetCategory,
      riskScore,
      riskLevel,
      { competition, traffic, cost, survival, anchors }
    )

    // 9. 응답 구성
    const response: AnalyzeV2Response = {
      location: {
        lat,
        lng,
        address: addressInfo.address,
        region: addressInfo.region,
        district: addressInfo.district,
      },
      analysis: {
        riskScore,
        riskLevel,
        areaType,
        targetCategory,
        categoryName: getCategoryName(targetCategory),
      },
      metrics: {
        competition,
        traffic,
        cost,
        survival,
      },
      anchors,
      interpretation,
      dataQuality: {
        storeDataAge: gridStoreData[0]?.period || 'N/A',
        trafficDataAge: gridTrafficData[0]?.h3_id ? '2025-01' : 'N/A',
        coverage: calculateCoverage(gridStoreData, gridTrafficData),
      },
      h3Cells,
      centerH3,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('v2 analyze error:', error)
    return NextResponse.json(
      { error: '분석 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// ===== 헬퍼 함수들 =====

/**
 * 카카오 역지오코딩
 */
async function getAddressFromKakao(
  lat: number,
  lng: number
): Promise<{ address: string; region: '서울' | '경기' | '인천'; district: string }> {
  if (!KAKAO_REST_KEY) {
    return { address: '주소 조회 불가', region: '서울', district: '' }
  }

  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lng}&y=${lat}`,
      {
        headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` },
      }
    )

    if (!res.ok) {
      throw new Error('Kakao API error')
    }

    const data = await res.json()
    const doc = data.documents?.[0]

    if (!doc) {
      return { address: '주소 없음', region: '서울', district: '' }
    }

    const address = doc.road_address?.address_name || doc.address?.address_name || ''
    const region1 = doc.address?.region_1depth_name || ''
    const region2 = doc.address?.region_2depth_name || ''

    let region: '서울' | '경기' | '인천' = '서울'
    if (region1.includes('경기')) region = '경기'
    else if (region1.includes('인천')) region = '인천'

    return { address, region, district: region2 }
  } catch (error) {
    console.error('Kakao geocoding error:', error)
    return { address: '주소 조회 실패', region: '서울', district: '' }
  }
}

/**
 * 그리드 점포 데이터 조회
 */
async function getGridStoreData(
  supabase: SupabaseClient,
  h3Cells: string[]
): Promise<GridStoreData[]> {
  const { data, error } = await supabase
    .from('grid_store_counts')
    .select('*')
    .in('h3_id', h3Cells)

  if (error) {
    console.error('Grid store data error:', error)
    return []
  }

  return data || []
}

/**
 * 그리드 유동인구 데이터 조회
 */
async function getGridTrafficData(
  supabase: SupabaseClient,
  h3Cells: string[]
): Promise<GridTrafficData[]> {
  const { data, error } = await supabase
    .from('grid_traffic')
    .select('*')
    .in('h3_id', h3Cells)

  if (error) {
    console.error('Grid traffic data error:', error)
    return []
  }

  return data || []
}

/**
 * 경쟁 지표 계산
 */
function calculateCompetition(
  gridData: GridStoreData[],
  category: BusinessCategory,
  centerLat: number,
  centerLng: number
): CompetitionMetrics {
  let total = 0
  let sameCategory = 0

  for (const grid of gridData) {
    total += grid.total_count || 0

    // 해당 업종 수
    const counts = grid.store_counts || {}
    sameCategory += counts[category] || 0
  }

  // 밀도 계산 (0~1)
  const density = total > 0 ? Math.min(1, sameCategory / 20) : 0

  return {
    total,
    sameCategory,
    density,
    densityLevel: getCompetitionLevel(sameCategory),
  }
}

/**
 * 유동인구 지표 계산
 */
function calculateTraffic(gridData: GridTrafficData[]): TrafficMetrics {
  const TRAFFIC_LEVEL_LABELS: Record<TrafficLevel, string> = {
    very_low: '매우 낮음',
    low: '낮음',
    medium: '보통',
    high: '높음',
    very_high: '매우 높음',
  }

  if (gridData.length === 0) {
    return {
      index: 0,
      level: 'low',
      levelLabel: '낮음',
      peakTime: 'day',
      weekendRatio: 0.3,
      timePattern: { morning: 33, day: 34, night: 33 },
    }
  }

  let totalTraffic = 0
  let totalMorning = 0
  let totalDay = 0
  let totalNight = 0
  let weekendRatioSum = 0
  let count = 0

  for (const grid of gridData) {
    if (grid.traffic_index) {
      totalTraffic += grid.traffic_index
      totalMorning += grid.time_morning || 33
      totalDay += grid.time_day || 34
      totalNight += grid.time_night || 33
      weekendRatioSum += grid.weekend_ratio || 0.3
      count++
    }
  }

  const avgWeekendRatio = count > 0 ? weekendRatioSum / count : 0.3
  const peakTime = getPeakTime(totalMorning, totalDay, totalNight)
  const level = getTrafficLevel(totalTraffic)

  // 시간대별 패턴 (비율 정규화)
  const totalTimePattern = totalMorning + totalDay + totalNight || 100
  const timePattern = {
    morning: Math.round((totalMorning / totalTimePattern) * 100),
    day: Math.round((totalDay / totalTimePattern) * 100),
    night: Math.round((totalNight / totalTimePattern) * 100),
  }

  return {
    index: totalTraffic,
    level,
    levelLabel: TRAFFIC_LEVEL_LABELS[level],
    peakTime,
    weekendRatio: avgWeekendRatio,
    timePattern,
  }
}

/**
 * 임대료 지표 계산
 */
async function calculateCost(
  supabase: SupabaseClient,
  district: string
): Promise<CostMetrics> {
  // 법정동별 임대료 조회
  const { data } = await supabase
    .from('district_rent')
    .select('*')
    .ilike('district_name', `%${district}%`)
    .limit(1)
    .single()

  if (data) {
    return {
      avgRent: data.avg_rent_per_pyeong || 100,
      level: getCostLevel(data.avg_rent_per_pyeong || 100),
      districtAvg: data.avg_rent_per_pyeong,
    }
  }

  // 기본값 (데이터 없음)
  return {
    avgRent: 100, // 서울 평균 추정
    level: 'medium',
  }
}

/**
 * 생존율 지표 계산 (closure-risk.ts 통합)
 * 실제 폐업 데이터가 있으면 사용, 없으면 추정 로직 적용
 */
function calculateSurvivalWithEstimation(
  gridData: GridStoreData[],
  category: BusinessCategory,
  trafficLevel: TrafficLevel,
  rentLevel: 'low' | 'medium' | 'high',
  areaType: AreaType
): SurvivalMetrics {
  // 1. 실제 폐업 데이터 확인
  let totalClosure = 0
  let totalOpening = 0
  let totalPrev = 0

  for (const grid of gridData) {
    totalClosure += grid.closure_count || 0
    totalOpening += grid.opening_count || 0
    totalPrev += grid.prev_period_count || grid.total_count || 0
  }

  // 2. 실제 데이터가 있으면 사용
  if (totalClosure > 0 && totalPrev > 0) {
    const closureRate = (totalClosure / totalPrev) * 100
    const openingRate = (totalOpening / totalPrev) * 100
    return {
      closureRate: Math.round(closureRate * 10) / 10,
      openingRate: Math.round(openingRate * 10) / 10,
      netChange: totalOpening - totalClosure,
      risk: getSurvivalRisk(closureRate),
    }
  }

  // 3. 실제 데이터 없음 → 추정 로직 사용
  // 경쟁 밀도 계산 (동종 업종 비율)
  let totalStores = 0
  let sameCategoryStores = 0
  for (const grid of gridData) {
    totalStores += grid.total_count || 0
    sameCategoryStores += grid.store_counts?.[category] || 0
  }
  const competitionDensity = totalStores > 0 ? sameCategoryStores / totalStores : 0

  // closure-risk.ts 함수 호출
  return calculateClosureRisk({
    category,
    competitionDensity,
    trafficLevel,
    rentLevel,
    areaType,
  })
}

/**
 * 앵커 시설 계산 (지하철 + 카카오 POI)
 */
async function calculateAnchors(
  supabase: SupabaseClient,
  lat: number,
  lng: number
): Promise<AnchorMetrics> {
  // 1. 가장 가까운 지하철역 (DB)
  const { data: subwayData } = await supabase.rpc('find_nearest_subway', {
    p_lat: lat,
    p_lng: lng,
    p_limit: 1,
  })

  const subway = subwayData?.[0]
    ? {
        name: subwayData[0].station_name,
        line: subwayData[0].line,
        distance: Math.round(subwayData[0].distance_meters),
      }
    : null

  // 2. 카카오 POI API로 앵커 시설 조회
  const [starbucks, mart, department] = await Promise.all([
    searchStarbucks(lat, lng, 1000),                  // 1km 내 스타벅스
    searchKakaoPOI(lat, lng, '이마트 홈플러스 코스트코 롯데마트', 2000), // 2km 내 대형마트
    searchKakaoPOI(lat, lng, '백화점', 2000),        // 2km 내 백화점
  ])

  const hasAnyAnchor = !!subway || !!starbucks || !!mart || !!department

  return {
    subway,
    starbucks,
    mart,
    department,
    hasAnyAnchor,
  }
}

/**
 * 카카오 로컬 API로 스타벅스 검색 (개수 포함)
 */
async function searchStarbucks(
  lat: number,
  lng: number,
  radius: number
): Promise<{ distance: number; count: number } | null> {
  if (!KAKAO_REST_KEY) return null

  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?` +
        `query=${encodeURIComponent('스타벅스')}&` +
        `x=${lng}&y=${lat}&` +
        `radius=${radius}&` +
        `size=15&sort=distance`,
      {
        headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` },
      }
    )

    if (!res.ok) return null

    const data = await res.json()
    const docs = data.documents || []

    const starbucksList = docs.filter((d: any) =>
      d.place_name?.includes('스타벅스')
    )

    if (starbucksList.length === 0) return null

    return {
      distance: parseInt(starbucksList[0].distance, 10),
      count: starbucksList.length,
    }
  } catch (error) {
    console.error('Kakao POI search error:', error)
    return null
  }
}

/**
 * 카카오 로컬 API로 POI 검색 (대형마트/백화점용)
 */
async function searchKakaoPOI(
  lat: number,
  lng: number,
  query: string,
  radius: number
): Promise<{ name: string; distance: number } | null> {
  if (!KAKAO_REST_KEY) return null

  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?` +
        `query=${encodeURIComponent(query)}&` +
        `x=${lng}&y=${lat}&` +
        `radius=${radius}&` +
        `size=15&sort=distance`,
      {
        headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` },
      }
    )

    if (!res.ok) return null

    const data = await res.json()
    const docs = data.documents || []

    if (docs.length === 0) return null

    const nearest = docs[0]
    return {
      name: nearest.place_name,
      distance: parseInt(nearest.distance, 10),
    }
  } catch (error) {
    console.error('Kakao POI search error:', error)
    return null
  }
}

/**
 * 점포 수 집계
 */
function aggregateStoreCounts(
  gridData: GridStoreData[]
): Record<string, number> {
  const result: Record<string, number> = {}

  for (const grid of gridData) {
    const counts = grid.store_counts || {}
    for (const [key, value] of Object.entries(counts)) {
      result[key] = (result[key] || 0) + (value as number)
    }
  }

  return result
}

/**
 * 데이터 커버리지 계산
 */
function calculateCoverage(
  storeData: GridStoreData[],
  trafficData: GridTrafficData[]
): 'high' | 'medium' | 'low' {
  const storeCount = storeData.length
  const trafficCount = trafficData.length

  if (storeCount >= 5 && trafficCount >= 3) return 'high'
  if (storeCount >= 2 || trafficCount >= 1) return 'medium'
  return 'low'
}
