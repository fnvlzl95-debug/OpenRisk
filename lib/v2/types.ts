/**
 * OpenRisk v2.0 타입 정의
 * 포인트 기반 리스크 분석
 */

import { BusinessCategory } from '../categories'

// ===== 리스크 레벨 =====
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH'

export const RISK_LEVEL_INFO: Record<RiskLevel, { name: string; color: string; description: string }> = {
  LOW: { name: '낮음', color: 'green', description: '창업 리스크가 낮은 지역' },
  MEDIUM: { name: '보통', color: 'yellow', description: '일반적인 수준의 리스크' },
  HIGH: { name: '높음', color: 'orange', description: '신중한 검토 필요' },
  VERY_HIGH: { name: '매우 높음', color: 'red', description: '창업 권장하지 않음' },
}

// ===== 상권 유형 =====
export type AreaType = 'A_주거' | 'B_혼합' | 'C_상업' | 'D_특수'

export const AREA_TYPE_INFO: Record<AreaType, { name: string; description: string }> = {
  'A_주거': { name: '주거형', description: '주거 밀집 지역, 생활 밀착형 소비' },
  'B_혼합': { name: '혼합형', description: '직주 혼합, 시간대별 고객층 상이' },
  'C_상업': { name: '상업형', description: '상업 중심, 유동인구↑ 경쟁↑ 비용↑' },
  'D_특수': { name: '특수형', description: '관광/이벤트 특화, 시즌 의존' },
}

// ===== 분석 요청 =====
export interface AnalyzeV2Request {
  lat: number
  lng: number
  targetCategory: BusinessCategory
}

// ===== 분석 응답 =====
export interface AnalyzeV2Response {
  location: {
    lat: number
    lng: number
    address: string
    region: '서울' | '경기' | '인천'
    district: string
  }

  analysis: {
    riskScore: number        // 0~100
    riskLevel: RiskLevel
    areaType: AreaType
    targetCategory: BusinessCategory
    categoryName: string
  }

  metrics: {
    competition: CompetitionMetrics
    traffic: TrafficMetrics
    cost: CostMetrics
    survival: SurvivalMetrics
  }

  anchors: AnchorMetrics

  interpretation: {
    summary: string
    risks: string[]
    opportunities: string[]
  }

  dataQuality: {
    storeDataAge: string
    trafficDataAge: string
    coverage: 'high' | 'medium' | 'low'
  }

  // 지도 표시용
  h3Cells: string[]
  centerH3: string
}

// ===== 세부 지표 =====
export interface CompetitionMetrics {
  total: number              // 반경 내 전체 점포
  sameCategory: number       // 동종 업종
  density: number            // 경쟁 밀도 (0~1)
  densityLevel: 'low' | 'medium' | 'high'
  nearestCompetitor?: {
    name: string
    distance: number
  }
}

export type TrafficLevel = 'very_low' | 'low' | 'medium' | 'high' | 'very_high'

export const TRAFFIC_LEVEL_INFO: Record<TrafficLevel, { name: string; description: string }> = {
  very_low: { name: '매우 낮음', description: '주거 밀집 지역' },
  low: { name: '낮음', description: '주거-상업 혼합' },
  medium: { name: '보통', description: '일반 상업지역' },
  high: { name: '높음', description: '주요 역세권' },
  very_high: { name: '매우 높음', description: '핵심 상권' },
}

export interface TrafficMetrics {
  index: number              // 유동인구 지수 (0~100)
  level: TrafficLevel
  levelLabel: string         // '매우 높음', '높음' 등
  peakTime: 'morning' | 'day' | 'night'
  weekendRatio: number       // 주말/평일 비율 (1.0 = 동일)
  timePattern: {
    morning: number          // 06-11시 비중 (%)
    day: number              // 11-17시 비중 (%)
    night: number            // 17-23시 비중 (%)
  }
  comparison?: string        // "강남구 평균 대비 높은 편"
  // 디버그용 (optional)
  components?: {
    subway: number
    bus: number
    poiFactor: number
  }
}

export interface CostMetrics {
  avgRent: number            // 평균 임대료 (만원/평)
  level: 'low' | 'medium' | 'high'
  districtAvg?: number       // 해당 구 평균
}

export interface SurvivalMetrics {
  closureRate: number        // 폐업률 (%)
  openingRate: number        // 개업률 (%)
  netChange: number          // 순증감
  risk: 'low' | 'medium' | 'high'
}

export interface AnchorMetrics {
  subway: { name: string; line: string; distance: number } | null
  starbucks: { distance: number; count: number } | null  // 반경 내 스타벅스 수
  mart: { name: string; distance: number } | null        // 대형마트 (이마트/홈플러스/코스트코)
  department: { name: string; distance: number } | null  // 백화점
  hasAnyAnchor: boolean
}

// ===== H3 그리드 집계 데이터 =====
export interface GridStoreData {
  h3_id: string
  center_lat: number
  center_lng: number
  region: string
  district: string | null
  store_counts: Record<string, number>
  total_count: number
  prev_period_count: number | null
  closure_count: number
  opening_count: number
  period: string
}

export interface GridTrafficData {
  h3_id: string
  // 교통시설 연결 정보
  nearest_subway_id: string | null
  nearest_subway_name: string | null
  subway_distance: number | null
  nearest_bus_stops: Array<{ stop_id: string; name: string; distance: number }> | null
  // 지수 구성 요소
  subway_component: number | null
  bus_component: number | null
  poi_factor: number | null
  // 최종 지수
  traffic_index: number
  traffic_level: TrafficLevel | null
  // 시간대별 패턴
  time_morning: number | null
  time_day: number | null
  time_night: number | null
  weekend_ratio: number | null
  peak_time: 'morning' | 'day' | 'night' | null
  period: string
}

// ===== 지하철역 데이터 =====
export interface SubwayStation {
  station_id: string
  station_name: string
  line: string
  region: string
  lat: number
  lng: number
  exit_count: number
  exits: Array<{ exit_id: string; lat: number; lng: number }> | null
  daily_total: number | null
  weekday_total: number | null
  weekend_total: number | null
  hourly_data: Record<string, number> | null
  normalized_score: number | null
  period: string | null
}

// ===== 버스정류장 데이터 =====
export interface BusStop {
  stop_id: string
  stop_name: string
  region: string
  lat: number
  lng: number
  daily_total: number | null
  route_count: number | null
  normalized_score: number | null
  period: string | null
}
