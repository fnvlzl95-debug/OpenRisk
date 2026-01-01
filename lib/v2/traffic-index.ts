/**
 * OpenRisk v2.0 - 유동인구 지수 계산 시스템
 *
 * "추정 인원수"가 아닌 "상대 지수(0~100)"로 계산
 * - 지하철 컴포넌트 (0~50점)
 * - 버스 컴포넌트 (0~30점)
 * - POI 보정계수 (0.8~1.5)
 */

import * as h3 from 'h3-js'
import type { SubwayStation, BusStop, TrafficLevel, TrafficMetrics } from './types'
import { TRAFFIC_LEVEL_INFO } from './types'

// ===== 상수 =====
const SUBWAY_MAX_DISTANCE = 1000  // 지하철역 영향 반경 (m)
const BUS_MAX_DISTANCE = 300      // 버스정류장 영향 반경 (m)
const DISTANCE_DECAY_FACTOR = 300 // 거리 감쇄 계수

// 지하철 승하차 정규화 기준 (일 평균)
const SUBWAY_RIDERSHIP_MAX = 200000  // 강남역 수준
const SUBWAY_RIDERSHIP_MIN = 5000    // 소규모역

// 버스 승하차 정규화 기준
const BUS_RIDERSHIP_MAX = 10000
const BUS_RIDERSHIP_MIN = 500

// ===== 타입 =====
interface StationWithDistance extends SubwayStation {
  distance: number
}

interface BusStopWithDistance extends BusStop {
  distance: number
}

interface TrafficIndexResult {
  index: number
  level: TrafficLevel
  components: {
    subway: number
    bus: number
    poiFactor: number
  }
  nearestSubway: {
    station_id: string
    station_name: string
    distance: number
  } | null
  nearestBusStops: Array<{
    stop_id: string
    name: string
    distance: number
  }>
  timePattern: {
    morning: number
    day: number
    night: number
  }
  weekendRatio: number
  peakTime: 'morning' | 'day' | 'night'
}

// ===== 핵심 함수 =====

/**
 * H3 셀에 대한 유동인구 지수 계산
 */
export function calculateTrafficIndex(
  h3Id: string,
  subwayStations: SubwayStation[],
  busStops: BusStop[],
  storeDensity: number
): TrafficIndexResult {
  const [lat, lng] = h3.cellToLatLng(h3Id)

  // 1. 반경 내 지하철역 찾기
  const nearbySubways = findNearbyStations(lat, lng, subwayStations, SUBWAY_MAX_DISTANCE)

  // 2. 반경 내 버스정류장 찾기
  const nearbyBusStops = findNearbyBusStops(lat, lng, busStops, BUS_MAX_DISTANCE)

  // 3. 지하철 컴포넌트 계산 (0~50)
  const subwayComponent = calculateSubwayComponent(nearbySubways)

  // 4. 버스 컴포넌트 계산 (0~30)
  const busComponent = calculateBusComponent(nearbyBusStops)

  // 5. POI 보정계수 계산 (0.8~1.5)
  const poiFactor = calculatePOIFactor(storeDensity)

  // 6. 기본 점수 계산
  const baseScore = (subwayComponent + busComponent) * poiFactor

  // 7. 0~100 정규화
  const trafficIndex = Math.min(100, Math.round(baseScore))

  // 8. 시간대별 패턴 계산
  const timePattern = calculateTimePattern(nearbySubways)

  // 9. 주말/평일 비율 계산
  const weekendRatio = calculateWeekendRatio(nearbySubways)

  // 10. 피크 시간 결정
  const peakTime = determinePeakTime(timePattern)

  return {
    index: trafficIndex,
    level: getTrafficLevel(trafficIndex),
    components: {
      subway: subwayComponent,
      bus: busComponent,
      poiFactor
    },
    nearestSubway: nearbySubways.length > 0 ? {
      station_id: nearbySubways[0].station_id,
      station_name: nearbySubways[0].station_name,
      distance: nearbySubways[0].distance
    } : null,
    nearestBusStops: nearbyBusStops.slice(0, 5).map(stop => ({
      stop_id: stop.stop_id,
      name: stop.stop_name,
      distance: stop.distance
    })),
    timePattern,
    weekendRatio,
    peakTime
  }
}

/**
 * 반경 내 지하철역 찾기 (거리순 정렬)
 */
function findNearbyStations(
  lat: number,
  lng: number,
  stations: SubwayStation[],
  maxDistance: number
): StationWithDistance[] {
  return stations
    .map(station => ({
      ...station,
      distance: calculateDistance(lat, lng, station.lat, station.lng)
    }))
    .filter(s => s.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
}

/**
 * 반경 내 버스정류장 찾기 (거리순 정렬)
 */
function findNearbyBusStops(
  lat: number,
  lng: number,
  stops: BusStop[],
  maxDistance: number
): BusStopWithDistance[] {
  return stops
    .map(stop => ({
      ...stop,
      distance: calculateDistance(lat, lng, stop.lat, stop.lng)
    }))
    .filter(s => s.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
}

/**
 * 지하철 컴포넌트 계산 (0~50점)
 */
function calculateSubwayComponent(stations: StationWithDistance[]): number {
  if (stations.length === 0) return 0

  let totalScore = 0

  for (const station of stations) {
    // 역별 기본 점수 (일 승하차 기준 정규화)
    const stationScore = normalizeSubwayRidership(station.daily_total || 0)

    // 거리 감쇄
    const distanceDecay = calculateDistanceDecay(station.distance)

    // 출구 분산 (MVP: 1/n)
    const exitDistribution = 1 / (station.exit_count || 4)

    totalScore += stationScore * distanceDecay * exitDistribution
  }

  // 상한 50점
  return Math.min(50, totalScore)
}

/**
 * 버스 컴포넌트 계산 (0~30점)
 */
function calculateBusComponent(stops: BusStopWithDistance[]): number {
  if (stops.length === 0) return 0

  let totalScore = 0

  for (const stop of stops) {
    // 정류장별 기본 점수
    const stopScore = normalizeBusRidership(stop.daily_total || 0)

    // 거리 감쇄 (더 짧은 반경)
    const distanceDecay = Math.exp(-stop.distance / 150)

    totalScore += stopScore * distanceDecay
  }

  // 상한 30점
  return Math.min(30, totalScore)
}

/**
 * 지하철 승하차 정규화 (0~50점)
 */
function normalizeSubwayRidership(dailyTotal: number): number {
  if (dailyTotal <= SUBWAY_RIDERSHIP_MIN) return 5
  if (dailyTotal >= SUBWAY_RIDERSHIP_MAX) return 50

  // 로그 스케일 정규화
  const logMin = Math.log(SUBWAY_RIDERSHIP_MIN)
  const logMax = Math.log(SUBWAY_RIDERSHIP_MAX)
  const logValue = Math.log(dailyTotal)

  return 5 + (logValue - logMin) / (logMax - logMin) * 45
}

/**
 * 버스 승하차 정규화 (0~10점)
 */
function normalizeBusRidership(dailyTotal: number): number {
  if (dailyTotal <= BUS_RIDERSHIP_MIN) return 1
  if (dailyTotal >= BUS_RIDERSHIP_MAX) return 10

  // 선형 정규화
  return 1 + (dailyTotal - BUS_RIDERSHIP_MIN) / (BUS_RIDERSHIP_MAX - BUS_RIDERSHIP_MIN) * 9
}

/**
 * 거리 감쇄 함수 (지수 감쇄)
 * 200m 이내: 90~100%
 * 200~500m: 30~70%
 * 500m~1km: 10~30%
 */
function calculateDistanceDecay(distance: number): number {
  const decay = Math.exp(-distance / DISTANCE_DECAY_FACTOR)
  return Math.max(0.1, decay)
}

/**
 * 상업밀도 보정계수 (0.8~1.5)
 */
export function calculatePOIFactor(storeDensity: number): number {
  if (storeDensity <= 5) return 0.8   // 주거지역
  if (storeDensity <= 20) return 0.9
  if (storeDensity <= 50) return 1.0  // 혼합
  if (storeDensity <= 100) return 1.2
  return 1.5                          // 상업지역
}

// 역 유형별 추정 시간대 패턴 (서울 데이터 기반)
// 출퇴근형: 아침/저녁 피크 (주거지역, 베드타운)
// 상업형: 낮시간 피크 (명동, 홍대 등)
// 혼합형: 비교적 고른 분포
const ESTIMATED_TIME_PATTERNS = {
  commute: { morning: 38, day: 28, night: 34 },  // 출퇴근형 (주거지역)
  commercial: { morning: 25, day: 42, night: 33 }, // 상업형 (핵심상권)
  mixed: { morning: 30, day: 36, night: 34 },     // 혼합형 (기본)
}

/**
 * 시간대별 패턴 계산
 */
function calculateTimePattern(
  stations: StationWithDistance[]
): { morning: number; day: number; night: number } {
  // 기본값: 혼합형 패턴
  const DEFAULT_PATTERN = ESTIMATED_TIME_PATTERNS.mixed

  if (stations.length === 0) {
    return DEFAULT_PATTERN
  }

  // 가장 가까운 역의 시간대별 데이터 사용
  const nearestStation = stations[0]
  const hourlyData = nearestStation.hourly_data

  // hourly_data가 있으면 실제 데이터 사용
  if (hourlyData && Object.keys(hourlyData).length > 0) {
    const morning = sumHours(hourlyData, 6, 11)
    const day = sumHours(hourlyData, 11, 17)
    const night = sumHours(hourlyData, 17, 23)
    const total = morning + day + night

    if (total > 0) {
      return {
        morning: Math.round(morning / total * 100),
        day: Math.round(day / total * 100),
        night: Math.round(night / total * 100)
      }
    }
  }

  // hourly_data가 없는 경우: 일평균 승객수 기반으로 역 유형 추정
  const dailyTotal = nearestStation.daily_total || 0

  // 일 승객수가 매우 높은 역 → 상업형 추정 (핵심상권)
  if (dailyTotal >= 100000) {
    return ESTIMATED_TIME_PATTERNS.commercial
  }

  // 일 승객수가 낮은 역 → 출퇴근형 추정 (주거지역)
  if (dailyTotal <= 30000) {
    return ESTIMATED_TIME_PATTERNS.commute
  }

  // 중간 규모 → 혼합형
  return ESTIMATED_TIME_PATTERNS.mixed
}

/**
 * 시간 범위 합산
 */
function sumHours(hourlyData: Record<string, number>, start: number, end: number): number {
  let sum = 0
  for (let h = start; h < end; h++) {
    const key = h.toString().padStart(2, '0')
    sum += hourlyData[key] || 0
  }
  return sum
}

/**
 * 주말/평일 비율 계산
 */
function calculateWeekendRatio(stations: StationWithDistance[]): number {
  if (stations.length === 0) return 1.0

  const nearestStation = stations[0]

  if (!nearestStation.weekend_total || !nearestStation.weekday_total) {
    return 1.0
  }

  return Number((nearestStation.weekend_total / nearestStation.weekday_total).toFixed(2))
}

/**
 * 피크 시간 결정
 */
function determinePeakTime(
  timePattern: { morning: number; day: number; night: number }
): 'morning' | 'day' | 'night' {
  const { morning, day, night } = timePattern

  if (morning >= day && morning >= night) return 'morning'
  if (night >= day && night >= morning) return 'night'
  return 'day'
}

/**
 * 지수 레벨 분류
 */
export function getTrafficLevel(index: number): TrafficLevel {
  if (index >= 80) return 'very_high'
  if (index >= 60) return 'high'
  if (index >= 40) return 'medium'
  if (index >= 20) return 'low'
  return 'very_low'
}

/**
 * Haversine 거리 계산 (m)
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000 // 지구 반지름 (m)
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg: number): number {
  return deg * Math.PI / 180
}

/**
 * TrafficIndexResult를 TrafficMetrics로 변환
 */
export function toTrafficMetrics(
  result: TrafficIndexResult,
  districtAvg?: number
): TrafficMetrics {
  let comparison: string | undefined

  if (districtAvg !== undefined) {
    const diff = result.index - districtAvg
    if (diff > 10) {
      comparison = `지역 평균(${districtAvg}) 대비 높은 편`
    } else if (diff < -10) {
      comparison = `지역 평균(${districtAvg}) 대비 낮은 편`
    } else {
      comparison = `지역 평균(${districtAvg}) 수준`
    }
  }

  return {
    index: result.index,
    level: result.level,
    levelLabel: TRAFFIC_LEVEL_INFO[result.level].name,
    peakTime: result.peakTime,
    weekendRatio: result.weekendRatio,
    timePattern: result.timePattern,
    comparison,
    components: result.components
  }
}
