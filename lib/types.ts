// 상권 영역
export interface TradeArea {
  id: string
  name: string
  district: string
  center_lat: number
  center_lng: number
  polygon: unknown // PostGIS geometry
  source: string | null
  updated_at: string
}

// 상권 지표
export interface AreaMetrics {
  id: number
  area_id: string
  period: string
  resident_index: number | null
  worker_index: number | null
  traffic_index: number | null
  daypart_variance: number | null
  weekend_ratio: number | null
  competition_density: number | null
  open_close_churn: number | null
  cost_proxy: number | null
}

// UX 문장 템플릿
export interface CopyTemplate {
  id: number
  key: string
  scope: 'lv3_5' | 'lv4'
  grade: 'A' | 'B' | 'C' | 'D' | null
  type: 'core' | 'action' | 'risk'
  text: string
  is_active: boolean
}

// 등급 룰셋
export interface GradeRule {
  id: number
  version: string
  grade: 'A' | 'B' | 'C' | 'D'
  weights: Record<string, number>
  is_active: boolean
}

// 등급 정의
export type Grade = 'A' | 'B' | 'C' | 'D'

export interface GradeInfo {
  grade: Grade
  name: string
  description: string  // 간단한 설명
}

export const GRADE_INFO: Record<Grade, GradeInfo> = {
  A: {
    grade: 'A',
    name: 'A_주거',
    description: '주거 밀집 상권, 생활 밀착형 소비'
  },
  B: {
    grade: 'B',
    name: 'B_혼합',
    description: '직주 혼합 상권, 시간대별 고객층 상이'
  },
  C: {
    grade: 'C',
    name: 'C_상업',
    description: '상업 중심 상권, 유동인구↑ 경쟁↑ 비용↑'
  },
  D: {
    grade: 'D',
    name: 'D_특수',
    description: '관광/이벤트 특화 상권, 시즌 의존'
  }
}

// 앵커 시설 정보
export interface Anchors {
  subway: boolean
  university: boolean
  hospital: boolean
}

// 상권 변화 지표 (LL/LH/HL/HH)
export type ChangeIndicator = 'LL' | 'LH' | 'HL' | 'HH' | null

export const CHANGE_INDICATOR_INFO: Record<string, { name: string; description: string }> = {
  LL: { name: '정체', description: '신규↓ 폐업↓ - 변화 적은 상권' },
  LH: { name: '활성', description: '신규↓ 폐업↑ - 신규 업체에 기회' },
  HL: { name: '포화', description: '신규↑ 폐업↓ - 기존 업체 우위, 진입 장벽' },
  HH: { name: '격변', description: '신규↑ 폐업↑ - 변동성 높음' }
}

// 마케팅 탄성
export type MarketingElasticity = 'HIGH' | 'MEDIUM' | 'LOW'

export const MARKETING_ELASTICITY_INFO: Record<MarketingElasticity, { name: string; description: string }> = {
  HIGH: { name: '높음', description: '블로그/SNS 마케팅 효과 큼, 변동성도 큼' },
  MEDIUM: { name: '중간', description: '적절한 마케팅과 품질 균형 필요' },
  LOW: { name: '낮음', description: '광고보다 단골/입지가 중요' }
}

// 원본 지표 데이터
export interface RawMetrics {
  period: string
  traffic_total: number
  traffic_weekday: number
  traffic_weekend: number
  resident_index: number
  worker_index: number
}

// 데이터 품질 (커버리지)
export type DataCoverage = 'high' | 'medium' | 'low'

export interface DataQuality {
  availableMetrics: number
  totalMetrics: number
  coverage: DataCoverage
}

export const DATA_COVERAGE_INFO: Record<DataCoverage, { label: string; description: string }> = {
  high: { label: '충분', description: '8개 지표 중 6개 이상 확보' },
  medium: { label: '보통', description: '8개 지표 중 4~5개 확보' },
  low: { label: '제한적', description: '8개 지표 중 3개 이하 확보' }
}

// GeoJSON 폴리곤 타입
export interface GeoJSONPolygon {
  type: 'Polygon'
  coordinates: number[][][]
}

// 위치 상태 (경계 처리)
export type LocationStatusType = 'IN' | 'NEAR' | 'OUTSIDE'

export interface LocationStatus {
  status: LocationStatusType
  distance: number | null  // 폴리곤 경계로부터 거리 (미터), IN일 경우 null
  confidenceNote: string   // 사용자에게 표시할 안내 문구
}

export const LOCATION_STATUS_INFO: Record<LocationStatusType, { label: string; description: string }> = {
  IN: { label: '상권 내', description: '검색 위치가 상권 영역 안에 있습니다' },
  NEAR: { label: '인근', description: '상권 영역 밖이지만 500m 이내입니다 (참고용)' },
  OUTSIDE: { label: '영역 외', description: '상권에서 500m 이상 떨어져 있습니다 (정확도 낮음)' }
}

// 분석 결과
export interface AnalysisResult {
  searchQuery: string  // 사용자가 입력한 검색어
  area: {
    id: string
    name: string
    district: string
    center: { lat: number; lng: number }
    polygon?: GeoJSONPolygon | null
  }
  searchedLocation: { lat: number; lng: number } | null  // 사용자가 검색한 실제 위치
  locationStatus: LocationStatus  // 위치 상태 (IN/NEAR/OUTSIDE)
  rawMetrics: RawMetrics
  dataQuality: DataQuality
  analysis: {
    grade: Grade
    gradeName: string
    description: string
    reasons: { key: string; value: number; label: string }[]
    // Phase 2-C 추가
    anchors: Anchors
    changeIndicator: ChangeIndicator
    marketingElasticity: MarketingElasticity
  }
  interpretation: {
    coreCopy: string[]
    actions: string[]
    risks: string[]
  }
}
