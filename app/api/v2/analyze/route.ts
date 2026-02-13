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
  getDistance,
  h3ToLatLng,
} from '@/lib/h3'
import {
  BusinessCategory,
  BUSINESS_CATEGORIES,
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
  calculateRiskScoreBreakdown,
  getRiskLevel,
  determineAreaType,
  getCompetitionLevel,
  getTrafficLevel,
  getCostLevel,
  getPeakTime,
  generateInterpretation,
} from '@/lib/v2/riskEngine'
import {
  calculateClosureRisk,
  getClosureRiskLevel,
} from '@/lib/v2/closure-risk'
import { createAnalysisIntegrity } from '@/lib/v2/integrity'
import { getTopRiskCards } from '@/lib/v2/interpretations/risk-cards'
import type { MetricContext } from '@/lib/v2/interpretations/types'
import { getClientIp } from '@/lib/server/client-ip'
import { checkServerRateLimit, getRetryAfterSeconds } from '@/lib/server/rate-limit'

// 카카오 API
const KAKAO_REST_KEY = process.env.KAKAO_REST_KEY
const ANALYZE_RATE_LIMIT = { max: 20, windowMs: 60 * 1000 }
const ANALYZE_CACHE_TTL_MS = 5 * 60 * 1000

// 분석 반경 (고정)
const ANALYSIS_RADIUS = 500
type SupportedRegion = AnalyzeV2Response['location']['region']
const SUPPORTED_REGION_BOUNDS: Record<SupportedRegion, { latMin: number; latMax: number; lngMin: number; lngMax: number }> = {
  서울: { latMin: 37.41, latMax: 37.72, lngMin: 126.75, lngMax: 127.27 },
  경기: { latMin: 36.85, latMax: 38.35, lngMin: 126.20, lngMax: 127.95 },
  인천: { latMin: 37.30, latMax: 37.65, lngMin: 126.35, lngMax: 126.95 },
  부산: { latMin: 34.95, latMax: 35.35, lngMin: 128.75, lngMax: 129.35 },
}

interface AnalyzeCacheEntry {
  value: AnalyzeV2Response
  expiresAt: number
}

const analyzeCache = new Map<string, AnalyzeCacheEntry>()
const MAX_ANALYZE_CACHE_SIZE = 1000

function sweepAnalyzeCache(now: number) {
  for (const [key, entry] of analyzeCache.entries()) {
    if (entry.expiresAt <= now) {
      analyzeCache.delete(key)
    }
  }
}

function buildAnalyzeCacheKey(
  lat: number,
  lng: number,
  targetCategory: BusinessCategory
): string {
  return `${lat.toFixed(5)}:${lng.toFixed(5)}:${targetCategory}`
}

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request)
  const rateLimit = await checkServerRateLimit(`analyze-v2:${clientIp}`, ANALYZE_RATE_LIMIT)
  const rateLimitHeaders = {
    'X-RateLimit-Limit': String(ANALYZE_RATE_LIMIT.max),
    'X-RateLimit-Remaining': String(rateLimit.remaining),
    'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetAt / 1000)),
  }

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: '분석 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
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
    const body: AnalyzeV2Request = await request.json()
    const { lat, lng, targetCategory } = body

    // 1. 입력 검증
    if (typeof lat !== 'number' || typeof lng !== 'number' || !targetCategory) {
      return NextResponse.json(
        { error: '위도, 경도, 업종을 모두 입력해주세요.' },
        { status: 400, headers: rateLimitHeaders }
      )
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json(
        { error: '좌표 형식이 올바르지 않습니다.' },
        { status: 400, headers: rateLimitHeaders }
      )
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json(
        { error: '좌표 범위를 벗어났습니다.' },
        { status: 400, headers: rateLimitHeaders }
      )
    }

    const supportedRegion = detectSupportedRegionByCoordinates(lat, lng)
    if (!supportedRegion) {
      return NextResponse.json(
        { error: '현재는 서울·경기·인천·부산 지역만 지원합니다.' },
        { status: 422, headers: rateLimitHeaders }
      )
    }

    if (!BUSINESS_CATEGORIES[targetCategory]) {
      return NextResponse.json(
        { error: '유효하지 않은 업종입니다.' },
        { status: 400, headers: rateLimitHeaders }
      )
    }

    const cacheKey = buildAnalyzeCacheKey(lat, lng, targetCategory)
    const now = Date.now()
    if (analyzeCache.size > MAX_ANALYZE_CACHE_SIZE) {
      sweepAnalyzeCache(now)
    }

    const cached = analyzeCache.get(cacheKey)
    if (cached && cached.expiresAt > now) {
      return NextResponse.json(cached.value, {
        headers: {
          ...rateLimitHeaders,
          'X-Analyze-Cache': 'HIT',
        },
      })
    }

    if (cached && cached.expiresAt <= now) {
      analyzeCache.delete(cacheKey)
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

    // 4-1. 500m 반경 필터를 모든 지표에 동일 적용
    const filteredStoreData = filterStoreDataByRadius(gridStoreData, lat, lng)
    const filteredTrafficData = filterTrafficDataByRadius(gridTrafficData, lat, lng)

    // 5. 지표 계산
    // 5-1. 경쟁 지표
    const competition = calculateCompetition(
      filteredStoreData,
      targetCategory
    )

    // 5-2. 유동인구 지표
    const traffic = calculateTraffic(filteredTrafficData)

    // 5-3. 임대료 지표
    const cost = await calculateCost(supabase, addressInfo.region, addressInfo.district)

    // 5-4. 앵커 시설
    const anchors = await calculateAnchors(supabase, lat, lng)

    // 5-5. 상권 유형 판별 (survival 계산에 필요)
    const storeCounts = aggregateStoreCounts(filteredStoreData)
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
      filteredStoreData,
      targetCategory,
      traffic.level,
      cost.level,
      areaType
    )

    // 6. 리스크 점수 계산 (상권 유형 패널티 포함)
    const riskScoreBreakdown = calculateRiskScoreBreakdown(
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
    const riskScore = riskScoreBreakdown.finalScore
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
      categoryKey: targetCategory,
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
        scoreBreakdown: riskScoreBreakdown,
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
        storeDataAge: filteredStoreData[0]?.period || 'N/A',
        trafficDataAge: filteredTrafficData[0]?.h3_id ? '2025-01' : 'N/A',
        coverage: calculateCoverage(filteredStoreData, filteredTrafficData),
      },
      h3Cells,
      centerH3,
    }

    const integrity = createAnalysisIntegrity(response)
    if (integrity) {
      response.integrity = integrity
    }

    analyzeCache.set(cacheKey, {
      value: response,
      expiresAt: now + ANALYZE_CACHE_TTL_MS,
    })

    return NextResponse.json(response, {
      headers: {
        ...rateLimitHeaders,
        'X-Analyze-Cache': 'MISS',
      },
    })
  } catch (error) {
    console.error('v2 analyze error:', error)
    return NextResponse.json(
      { error: '분석 중 오류가 발생했습니다.' },
      { status: 500, headers: rateLimitHeaders }
    )
  }
}

// ===== 헬퍼 함수들 =====

/**
 * 카카오 역지오코딩
 */
function detectSupportedRegionByCoordinates(
  lat: number,
  lng: number
): SupportedRegion | null {
  const isWithin = (region: SupportedRegion) => {
    const bounds = SUPPORTED_REGION_BOUNDS[region]
    return (
      lat >= bounds.latMin &&
      lat <= bounds.latMax &&
      lng >= bounds.lngMin &&
      lng <= bounds.lngMax
    )
  }

  if (isWithin('서울')) return '서울'
  if (isWithin('부산')) return '부산'
  if (isWithin('인천')) return '인천'
  if (isWithin('경기')) return '경기'

  return null
}

function inferRegionByCoordinates(lat: number, lng: number): SupportedRegion {
  return detectSupportedRegionByCoordinates(lat, lng) || '서울'
}

async function getAddressFromKakao(
  lat: number,
  lng: number
): Promise<{ address: string; region: SupportedRegion; district: string }> {
  const fallbackRegion = inferRegionByCoordinates(lat, lng)

  if (!KAKAO_REST_KEY) {
    return { address: '주소 조회 불가', region: fallbackRegion, district: '' }
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
      return { address: '주소 없음', region: fallbackRegion, district: '' }
    }

    const address = doc.road_address?.address_name || doc.address?.address_name || ''
    const region1 = doc.address?.region_1depth_name || ''
    const region2 = doc.address?.region_2depth_name || ''

    let region: SupportedRegion = '서울'
    if (region1.includes('경기')) region = '경기'
    else if (region1.includes('인천')) region = '인천'
    else if (region1.includes('부산')) region = '부산'

    return { address, region, district: region2 }
  } catch (error) {
    console.error('Kakao geocoding error:', error)
    return { address: '주소 조회 실패', region: fallbackRegion, district: '' }
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

function filterStoreDataByRadius(
  gridData: GridStoreData[],
  centerLat: number,
  centerLng: number
): GridStoreData[] {
  return gridData.filter((grid) => {
    const cellDistance = getDistance(centerLat, centerLng, grid.center_lat, grid.center_lng)
    return cellDistance <= ANALYSIS_RADIUS
  })
}

function filterTrafficDataByRadius(
  gridData: GridTrafficData[],
  centerLat: number,
  centerLng: number
): GridTrafficData[] {
  type GridTrafficRowWithCenter = GridTrafficData & {
    center_lat?: number | null
    center_lng?: number | null
  }

  return gridData.filter((grid) => {
    const withCenter = grid as GridTrafficRowWithCenter

    if (typeof withCenter.center_lat === 'number' && typeof withCenter.center_lng === 'number') {
      const distance = getDistance(centerLat, centerLng, withCenter.center_lat, withCenter.center_lng)
      return distance <= ANALYSIS_RADIUS
    }

    try {
      const center = h3ToLatLng(grid.h3_id)
      const distance = getDistance(centerLat, centerLng, center.lat, center.lng)
      return distance <= ANALYSIS_RADIUS
    } catch {
      return false
    }
  })
}

/**
 * 경쟁 지표 계산
 */
function calculateCompetition(
  gridData: GridStoreData[],
  category: BusinessCategory
): CompetitionMetrics {
  let total = 0
  let sameCategory = 0
  let hasCategoryData = false

  for (const grid of gridData) {
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
  gridData: GridTrafficData[]
): TrafficMetrics {
  type GridTrafficRow = GridTrafficData & {
    center_lat?: number | null
    center_lng?: number | null
    traffic_estimated?: number | null
    traffic_morning?: number | null
    traffic_day?: number | null
    traffic_night?: number | null
  }

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
    const g = grid as GridTrafficRow

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

  // 평균 유동인구 지수 계산 (합계가 아닌 평균 사용)
  const avgTraffic = Math.round(totalTraffic / count)

  const avgWeekendRatio = count > 0 ? weekendRatioSum / count : 0.3
  const peakTime = getPeakTime(totalMorning, totalDay, totalNight)
  const level = getTrafficLevel(avgTraffic)

  // 시간대별 패턴 (비율 정규화)
  const totalTimePattern = totalMorning + totalDay + totalNight || 100
  const timePattern = {
    morning: Math.round((totalMorning / totalTimePattern) * 100),
    day: Math.round((totalDay / totalTimePattern) * 100),
    night: Math.round((totalNight / totalTimePattern) * 100),
  }

  return {
    index: avgTraffic,
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
  region: SupportedRegion,
  district: string
): Promise<CostMetrics> {
  if (!district) {
    return {
      avgRent: 20,
      level: 'medium',
    }
  }

  const selectQuery = 'district_name, avg_rent_per_pyeong, rent_level'

  // 1) 구/군 이름 exact match 우선
  const { data: exactMatch, error: exactError } = await supabase
    .from('district_rent')
    .select(selectQuery)
    .eq('district_name', district)
    .limit(1)

  if (exactError) {
    console.error('Cost exact query error:', exactError)
  }

  const exactRow = (exactMatch?.[0] as DistrictRentRow | undefined) ?? null
  if (exactRow) {
    const avgRent = exactRow.avg_rent_per_pyeong ?? 20
    const level = resolveCostLevel(exactRow.rent_level, avgRent)
    return {
      avgRent,
      level,
      districtAvg: exactRow.avg_rent_per_pyeong ?? undefined,
    }
  }

  // 2) 부분일치 후보 조회 후 지역/구군명을 함께 점수화해서 최적 선택
  const { data: candidates, error } = await supabase
    .from('district_rent')
    .select(selectQuery)
    .ilike('district_name', `%${district}%`)
    .limit(20)

  if (error) {
    console.error('Cost fallback query error:', error)
  }

  const best = pickBestRentCandidate(
    (candidates as DistrictRentRow[] | null) ?? [],
    region,
    district
  )

  if (best) {
    const avgRent = best.avg_rent_per_pyeong ?? 20
    const level = resolveCostLevel(best.rent_level, avgRent)
    return {
      avgRent,
      level,
      districtAvg: best.avg_rent_per_pyeong ?? undefined,
    }
  }

  // 3) 기본값 (데이터 없음)
  return {
    avgRent: 20,
    level: 'medium',
  }
}

interface DistrictRentRow {
  district_name: string
  avg_rent_per_pyeong: number | null
  rent_level: string | null
}

function normalizeDistrictName(value: string): string {
  return value
    .replace(/\s+/g, '')
    .replace(/(특별시|광역시|특별자치시|특별자치도|도)$/g, '')
}

function pickBestRentCandidate(
  candidates: DistrictRentRow[],
  region: SupportedRegion,
  district: string
): DistrictRentRow | null {
  if (candidates.length === 0) return null

  const normalizedDistrict = normalizeDistrictName(district)

  const scored = candidates.map((candidate) => {
    const name = candidate.district_name || ''
    const normalizedName = normalizeDistrictName(name)
    let score = 0

    if (normalizedName === normalizedDistrict) score += 100
    if (normalizedName.includes(normalizedDistrict)) score += 50
    if (name.startsWith(`${region} ${district}`)) score += 40
    if (name.includes(region)) score += 30
    if (name.includes(district)) score += 20

    return { candidate, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored[0]?.candidate ?? null
}

function resolveCostLevel(
  rentLevel: string | null,
  avgRent: number
): 'low' | 'medium' | 'high' {
  if (rentLevel === 'low' || rentLevel === 'medium' || rentLevel === 'high') {
    return rentLevel
  }
  return getCostLevel(avgRent)
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

  // 2. 전기 점포 데이터가 있으면 실제 데이터 사용 (폐업 0건 포함)
  if (totalPrev > 0) {
    const closureRate = (totalClosure / totalPrev) * 100
    const openingRate = (totalOpening / totalPrev) * 100
    const netChange = totalOpening - totalClosure
    const risk = getClosureRiskLevel(closureRate)

    // 트렌드 및 직관적 표현 생성
    const { trend, trendLabel, riskLabel, summary } = buildSurvivalLabels(
      closureRate,
      openingRate,
      netChange,
      risk
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
    baseMetrics.risk
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
  risk: 'low' | 'medium' | 'high'
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

  // 3. 한줄 요약 (트렌드 + 이유)
  let summary: string

  if (trend === 'growing') {
    if (risk === 'low') {
      summary = `새 가게가 늘고 있는 상권입니다. 다만 그만큼 경쟁자도 늘어나고 있어요.`
    } else {
      summary = `개업은 활발하지만 경쟁도 치열합니다. 차별화 없이 뛰어들면 힘들 수 있어요.`
    }
  } else if (trend === 'shrinking') {
    if (closureRate > 15) {
      summary = `문 닫는 가게가 많은 상권입니다. 왜 그런지 현장에서 직접 확인해보세요.`
    } else {
      summary = `점포가 줄어드는 추세입니다. 상권이 위축되고 있을 수 있어요.`
    }
  } else {
    // stable
    if (risk === 'low') {
      summary = `점포 수가 안정적으로 유지되고 있어요. 큰 변동 없는 상권입니다.`
    } else {
      summary = `개업과 폐업이 비슷하게 반복되는 상권입니다. 쉽게 들어오고 쉽게 나가는 곳일 수 있어요.`
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
  // 2025.01: 1.2km 이내만 "역세권"으로 인정 (도보 15분)
  const SUBWAY_MAX_DISTANCE = 1200
  const { data: subwayData } = await supabase.rpc('find_nearest_subway', {
    p_lat: lat,
    p_lng: lng,
    p_limit: 1,
  })

  // 1.2km 초과 시 null 처리 (역세권 아님)
  const nearestSubway = subwayData?.[0]
  const subway = nearestSubway && nearestSubway.distance_meters <= SUBWAY_MAX_DISTANCE
    ? {
        name: nearestSubway.station_name,
        line: nearestSubway.line,
        distance: Math.round(nearestSubway.distance_meters),
      }
    : null

  // 2. 카카오 POI API로 앵커 시설 조회
  // 2025.01: 반경 축소 (2km→1.2km, 도보 15분 기준)
  const [starbucks, mart, department] = await Promise.all([
    searchStarbucks(lat, lng, 800),                   // 800m 내 스타벅스 (도보 10분)
    searchMart(lat, lng, 1200),                       // 1.2km 내 대형마트 (도보 15분)
    searchDepartmentStore(lat, lng, 1200),            // 1.2km 내 백화점 (도보 15분)
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

interface KakaoPlaceDocument {
  id?: string
  place_name?: string
  distance?: string
  address_name?: string
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
    const docs = (data.documents || []) as KakaoPlaceDocument[]

    const starbucksList = docs.filter((d) =>
      d.place_name?.includes('스타벅스')
    )

    if (starbucksList.length === 0) return null

    const nearestDistance = Number.parseInt(starbucksList[0].distance ?? '0', 10)
    return {
      distance: Number.isNaN(nearestDistance) ? 0 : nearestDistance,
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
    const docs = (data.documents || []) as KakaoPlaceDocument[]

    // 주요 대형마트만 필터링 (익스프레스, 슈퍼 제외)
    const majorOnly = docs.filter((d) => {
      const name = d.place_name || ''
      const isMajor = majorMarts.some(brand => name.includes(brand))
      const isExpress = /익스프레스|슈퍼|프레시/.test(name)
      return isMajor && !isExpress
    })

    if (majorOnly.length === 0) return null

    const nearest = majorOnly[0]
    const nearestDistance = Number.parseInt(nearest.distance ?? '0', 10)
    return {
      name: nearest.place_name || '대형마트',
      distance: Number.isNaN(nearestDistance) ? 0 : nearestDistance,
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
