/**
 * OpenRisk v2.0 분석 API
 * POST /api/v2/analyze
 *
 * 포인트 기반 리스크 분석 (반경 500m 고정, 업종 필수)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabase, SupabaseClient } from '@/lib/supabase'
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
import { getTopRiskCards } from '@/lib/v2/interpretations/risk-cards'
import type { MetricContext } from '@/lib/v2/interpretations/types'

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
    const traffic = calculateTraffic(gridTrafficData, lat, lng)

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

    // 5-5-1. 시간대 패턴 추정 (DB 데이터 없으면 상권 유형 기반)
    // DB에 시간대 데이터가 없는 경우 (모두 33/34/33인 경우) 상권 유형으로 추정
    const isDefaultTimePattern =
      traffic.timePattern.morning === 33 &&
      traffic.timePattern.day === 34 &&
      traffic.timePattern.night === 33

    if (isDefaultTimePattern) {
      const estimatedPattern = estimateTimePatternByAreaType(areaType, anchors)
      traffic.timePattern = estimatedPattern.timePattern
      traffic.peakTime = estimatedPattern.peakTime
      traffic.weekendRatio = estimatedPattern.weekendRatio
    }

    // 5-6. 생존율 지표 (closure-risk.ts 추정 로직 사용)
    const survival = calculateSurvivalWithEstimation(
      gridStoreData,
      targetCategory,
      traffic.level,
      cost.level,
      areaType
    )

    // 6. 리스크 점수 계산 (상권 유형 패널티 포함)
    const riskScore = calculateRiskScore(
      targetCategory,
      {
        competition,
        traffic,
        cost,
        survival,
        anchors,
      },
      areaType  // 상권 유형별 패널티 적용
    )
    const riskLevel = getRiskLevel(riskScore)

    // 8. 해석 문구 생성
    const interpretation = generateInterpretation(
      targetCategory,
      riskScore,
      riskLevel,
      { competition, traffic, cost, survival, anchors },
      areaType
    )

    // 9. 리스크 카드 생성 (v2.1 신규)
    const metricContext: MetricContext = {
      sameCategory: competition.sameCategory,
      totalStores: competition.total,
      densityLevel: competition.densityLevel === 'low' ? 'low' : competition.densityLevel === 'medium' ? 'medium' : 'high',
      trafficLevel: traffic.level === 'very_low' || traffic.level === 'low' ? 'low' :
                    traffic.level === 'medium' ? 'medium' : 'high',
      trafficIndex: traffic.index,
      isEstimated: true,
      rentLevel: cost.level,
      avgRent: cost.avgRent,
      closureRate: survival.closureRate,
      openingRate: survival.openingRate,
      netChange: survival.netChange,
      survivalRisk: survival.risk,
      peakTime: traffic.peakTime,
      timePattern: traffic.timePattern,
      weekendRatio: traffic.weekendRatio,
      areaType,
      subwayDistance: anchors.subway?.distance,
      subwayName: anchors.subway?.name,
      hasNearbyAnchor: anchors.hasAnyAnchor,
      categoryName: getCategoryName(targetCategory),
    }
    const riskCards = getTopRiskCards(metricContext, 3)

    // 10. 응답 구성
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
      riskCards,
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
  let hasCategoryData = false

  for (const grid of gridData) {
    // H3 셀 중심이 실제 500m 반경 내에 있는지 확인
    const cellDistance = getDistance(centerLat, centerLng, grid.center_lat, grid.center_lng)
    if (cellDistance > ANALYSIS_RADIUS) {
      continue // 500m 반경 밖의 셀은 제외
    }

    total += grid.total_count || 0

    // 해당 업종 수
    const counts = grid.store_counts || {}
    const categoryCount = counts[category] || 0
    sameCategory += categoryCount

    // DB에 해당 카테고리 키가 있는지 확인
    if (category in counts) {
      hasCategoryData = true
    }
  }

  // 밀도 계산 (0~1)
  const density = total > 0 ? Math.min(1, sameCategory / 20) : 0

  return {
    total,
    sameCategory,
    density,
    densityLevel: getCompetitionLevel(sameCategory),
    hasCategoryData, // DB에 해당 업종 데이터 존재 여부
  }
}

/**
 * 유동인구 지표 계산
 */
function calculateTraffic(
  gridData: GridTrafficData[],
  centerLat: number,
  centerLng: number
): TrafficMetrics {
  const TRAFFIC_LEVEL_LABELS: Record<TrafficLevel, string> = {
    very_low: '매우 낮음',
    low: '낮음',
    medium: '보통',
    high: '높음',
    very_high: '매우 높음',
  }

  // 기본값 (데이터 없음)
  const defaultResult: TrafficMetrics = {
    index: 0,
    level: 'medium',
    levelLabel: '데이터 없음',
    peakTime: 'day',
    weekendRatio: 0.3,
    timePattern: { morning: 33, day: 34, night: 33 },
  }

  if (gridData.length === 0) {
    return defaultResult
  }

  let totalTraffic = 0
  let totalMorning = 0
  let totalDay = 0
  let totalNight = 0
  let weekendRatioSum = 0
  let count = 0

  for (const grid of gridData) {
    // DB 필드명: traffic_estimated, traffic_morning 등 (types.ts와 다름)
    const g = grid as any

    // H3 셀 중심이 실제 500m 반경 내에 있는지 확인
    if (g.center_lat && g.center_lng) {
      const cellDistance = getDistance(centerLat, centerLng, g.center_lat, g.center_lng)
      if (cellDistance > ANALYSIS_RADIUS) {
        continue // 500m 반경 밖의 셀은 제외
      }
    }

    const trafficValue = g.traffic_estimated || g.traffic_index || 0
    const morningValue = g.traffic_morning || g.time_morning || 33
    const dayValue = g.traffic_day || g.time_day || 34
    const nightValue = g.traffic_night || g.time_night || 33

    if (trafficValue > 0) {
      totalTraffic += trafficValue
      totalMorning += morningValue
      totalDay += dayValue
      totalNight += nightValue
      // weekend_ratio: 0~1 스케일 또는 0~100 스케일 모두 처리
      let weekendRatio = g.weekend_ratio ?? 0.3
      // 만약 1보다 크면 퍼센트로 저장된 것으로 간주 (예: 33 -> 0.33)
      if (weekendRatio > 1) {
        weekendRatio = weekendRatio / 100
      }
      // 1이면 100%인데, 이는 비정상 데이터이므로 기본값 사용
      if (weekendRatio >= 1) {
        weekendRatio = 0.3  // 기본값
      }
      weekendRatioSum += weekendRatio
      count++
    }
  }

  // 유효한 데이터가 없으면 기본값 반환
  if (count === 0 || totalTraffic === 0) {
    return defaultResult
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
  const { data, error } = await supabase
    .from('district_rent')
    .select('*')
    .ilike('district_name', `%${district}%`)
    .limit(1)
    .single()

  if (data) {
    // DB에 rent_level이 있으면 사용, 없으면 계산
    const level = data.rent_level || getCostLevel(data.avg_rent_per_pyeong || 100)
    return {
      avgRent: data.avg_rent_per_pyeong || 100,
      level: level as 'low' | 'medium' | 'high',
      districtAvg: data.avg_rent_per_pyeong,
    }
  }

  // 기본값 (데이터 없음) - DB 평균 기준 20만원/평
  return {
    avgRent: 20,
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
    const netChange = totalOpening - totalClosure
    const risk = getSurvivalRisk(closureRate)

    // 트렌드 및 직관적 표현 생성
    const { trend, trendLabel, riskLabel, summary } = buildSurvivalLabels(
      closureRate,
      openingRate,
      netChange,
      risk,
      true // 실제 데이터 사용
    )

    return {
      closureRate: Math.round(closureRate * 10) / 10,
      openingRate: Math.round(openingRate * 10) / 10,
      netChange,
      risk,
      trend,
      trendLabel,
      riskLabel,
      summary,
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
  const baseMetrics = calculateClosureRisk({
    category,
    competitionDensity,
    trafficLevel,
    rentLevel,
    areaType,
  })

  // 추정 데이터에도 직관적 표현 추가
  const { trend, trendLabel, riskLabel, summary } = buildSurvivalLabels(
    baseMetrics.closureRate,
    baseMetrics.openingRate,
    baseMetrics.netChange,
    baseMetrics.risk,
    false // 추정 데이터
  )

  return {
    ...baseMetrics,
    trend,
    trendLabel,
    riskLabel,
    summary,
  }
}

/**
 * 생존지표 직관적 레이블 생성
 */
function buildSurvivalLabels(
  closureRate: number,
  openingRate: number,
  netChange: number,
  risk: 'low' | 'medium' | 'high',
  isRealData: boolean
): {
  trend: 'growing' | 'stable' | 'shrinking'
  trendLabel: string
  riskLabel: string
  summary: string
} {
  // 1. 트렌드 판단 (순증감 기준)
  let trend: 'growing' | 'stable' | 'shrinking'
  let trendLabel: string

  // netChange가 실제 개수일 때
  const netChangeRate = openingRate - closureRate // 비율 차이

  if (netChangeRate > 2) {
    trend = 'growing'
    trendLabel = '📈 점포 증가세'
  } else if (netChangeRate < -2) {
    trend = 'shrinking'
    trendLabel = '📉 점포 감소세'
  } else {
    trend = 'stable'
    trendLabel = '➡️ 보합세'
  }

  // 2. 리스크 레이블 (등급 + 이유)
  let riskLabel: string
  if (risk === 'low') {
    riskLabel = '🟢 안정'
  } else if (risk === 'medium') {
    riskLabel = '🟡 보통'
  } else {
    riskLabel = '🔴 주의'
  }

  // 3. 한줄 요약 (트렌드 + 이유) - 비율 기반으로 표현
  let summary: string
  const period = isRealData ? '최근 10개월' : '추정치'

  // 순증감 비율 (폐업률 - 개업률)
  const netRateDiff = Math.abs(Math.round((closureRate - openingRate) * 10) / 10)

  if (trend === 'growing') {
    if (risk === 'low') {
      summary = `${period} 개업이 폐업보다 많아요. 성장하는 상권이에요.`
    } else {
      summary = `${period} 개업이 많지만, 경쟁도 치열해지고 있어요.`
    }
  } else if (trend === 'shrinking') {
    // 비율로 표현 (예: "10개 중 1.3개가 폐업")
    const closedPer10 = Math.round(closureRate) / 10
    if (closureRate > 15) {
      summary = `${period} 10개 중 ${closedPer10}개꼴로 폐업했어요. 신중하게 접근하세요.`
    } else {
      summary = `${period} 폐업이 개업보다 ${netRateDiff}%p 많아요. 안정화 단계일 수 있어요.`
    }
  } else {
    // stable
    if (risk === 'low') {
      summary = `${period} 점포 수 변동이 적어요. 안정적인 상권이에요.`
    } else {
      summary = `${period} 개업과 폐업이 비슷해요.`
    }
  }

  return { trend, trendLabel, riskLabel, summary }
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
    searchMart(lat, lng, 2000),                       // 2km 내 대형마트 (카테고리 검색)
    searchDepartmentStore(lat, lng, 2000),            // 2km 내 백화점
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
 * 카카오 카테고리 검색으로 대형마트 찾기 (MT1 = 대형마트)
 */
async function searchMart(
  lat: number,
  lng: number,
  radius: number
): Promise<{ name: string; distance: number } | null> {
  if (!KAKAO_REST_KEY) return null

  // 주요 대형마트 브랜드
  const majorMarts = ['이마트', '홈플러스', '코스트코', '롯데마트', '하나로마트', '킴스클럽']

  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/category.json?` +
        `category_group_code=MT1&` +
        `x=${lng}&y=${lat}&` +
        `radius=${radius}&` +
        `size=10&sort=distance`,
      {
        headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` },
      }
    )

    if (!res.ok) return null

    const data = await res.json()
    const docs = data.documents || []

    // 주요 대형마트만 필터링 (익스프레스, 슈퍼 제외)
    const majorOnly = docs.filter((d: any) => {
      const name = d.place_name || ''
      const isMajor = majorMarts.some(brand => name.includes(brand))
      const isExpress = /익스프레스|슈퍼|프레시/.test(name)
      return isMajor && !isExpress
    })

    if (majorOnly.length === 0) return null

    const nearest = majorOnly[0]
    return {
      name: nearest.place_name,
      distance: parseInt(nearest.distance, 10),
    }
  } catch (error) {
    console.error('Mart search error:', error)
    return null
  }
}

// 주요 백화점 좌표 (카카오 API 한계로 하드코딩)
// 서울/경기/인천 주요 백화점 본점 위치
const DEPARTMENT_STORES: { name: string; lat: number; lng: number }[] = [
  // 신세계
  { name: '신세계백화점 본점', lat: 37.5610, lng: 126.9810 },
  { name: '신세계백화점 강남점', lat: 37.5045, lng: 127.0040 },
  { name: '신세계백화점 센텀시티점', lat: 35.1692, lng: 129.1311 },
  // 롯데
  { name: '롯데백화점 본점', lat: 37.5647, lng: 126.9816 },
  { name: '롯데백화점 잠실점', lat: 37.5117, lng: 127.0980 },
  { name: '롯데백화점 강남점', lat: 37.4968, lng: 127.0280 },
  { name: '롯데백화점 영등포점', lat: 37.5168, lng: 126.9032 },
  // 현대
  { name: '현대백화점 본점', lat: 37.5285, lng: 127.0283 },
  { name: '현대백화점 무역센터점', lat: 37.5087, lng: 127.0604 },
  { name: '더현대 서울', lat: 37.5261, lng: 126.9281 },
  { name: '현대백화점 판교점', lat: 37.3942, lng: 127.1118 },
  // 갤러리아
  { name: '갤러리아백화점 명품관', lat: 37.5277, lng: 127.0398 },
  { name: '갤러리아백화점 타임월드', lat: 36.3523, lng: 127.3780 },
  // AK
  { name: 'AK플라자 수원점', lat: 37.2664, lng: 127.0013 },
  { name: 'AK플라자 분당점', lat: 37.3784, lng: 127.1168 },
]

/**
 * 주요 백화점 검색 - 좌표 기반 (카카오 API 한계로 직접 계산)
 */
function searchDepartmentStore(
  lat: number,
  lng: number,
  radius: number
): { name: string; distance: number } | null {
  // Haversine 거리 계산
  const R = 6371000 // 지구 반지름 (미터)
  const toRad = (deg: number) => deg * (Math.PI / 180)

  let nearest: { name: string; distance: number } | null = null

  for (const store of DEPARTMENT_STORES) {
    const dLat = toRad(store.lat - lat)
    const dLng = toRad(store.lng - lng)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat)) * Math.cos(toRad(store.lat)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const distance = Math.round(R * c)

    if (distance <= radius) {
      if (!nearest || distance < nearest.distance) {
        nearest = { name: store.name, distance }
      }
    }
  }

  return nearest
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

/**
 * 상권 유형 기반 시간대 패턴 추정
 * DB에 시간대 데이터가 없을 때 상권 특성으로 추정
 */
function estimateTimePatternByAreaType(
  areaType: AreaType,
  anchors: AnchorMetrics
): {
  timePattern: { morning: number; day: number; night: number }
  peakTime: 'morning' | 'day' | 'night'
  weekendRatio: number
} {
  // 역세권 여부
  const hasSubway = anchors.subway && anchors.subway.distance < 300

  switch (areaType) {
    case 'A_주거':
      // 주거지: 아침 출근 + 저녁 귀가 패턴, 주말 비중 높음
      return {
        timePattern: { morning: 30, day: 25, night: 45 },
        peakTime: 'night',
        weekendRatio: 0.45,
      }

    case 'B_혼합':
      // 혼합: 균형잡힌 패턴
      if (hasSubway) {
        // 역세권 혼합: 출퇴근 패턴 강함
        return {
          timePattern: { morning: 35, day: 30, night: 35 },
          peakTime: 'morning',
          weekendRatio: 0.35,
        }
      }
      return {
        timePattern: { morning: 30, day: 35, night: 35 },
        peakTime: 'day',
        weekendRatio: 0.40,
      }

    case 'C_상업':
      // 상업지: 낮 + 저녁 중심, 평일 비중 높음
      if (hasSubway) {
        // 역세권 상업: 출퇴근 + 점심 피크
        return {
          timePattern: { morning: 30, day: 40, night: 30 },
          peakTime: 'day',
          weekendRatio: 0.30,
        }
      }
      return {
        timePattern: { morning: 25, day: 45, night: 30 },
        peakTime: 'day',
        weekendRatio: 0.35,
      }

    case 'D_특수':
      // 특수 (관광/유흥): 저녁 중심, 주말 비중 매우 높음
      return {
        timePattern: { morning: 20, day: 30, night: 50 },
        peakTime: 'night',
        weekendRatio: 0.55,
      }

    default:
      // 기본값
      return {
        timePattern: { morning: 33, day: 34, night: 33 },
        peakTime: 'day',
        weekendRatio: 0.35,
      }
  }
}
