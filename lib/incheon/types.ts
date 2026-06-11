import type { BusinessCategory } from '@/lib/categories'
import type { RiskMapCell } from './risk-map-types'

export type IncheonProductMode = 'openrisk-incheon'
export type IncheonDataPolicy = 'public-data-only'

export type IncheonRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH'
export type IncheonMetricLevel = 'low' | 'medium' | 'high' | 'unknown'
export type IncheonConfidence = 'high' | 'medium' | 'low'
export type IncheonEvidenceMethod = 'actual' | 'estimated' | 'heuristic'

/**
 * 모든 지표의 표시 상태를 하나의 판별 유니온으로 관리한다.
 * - available: 정상 산출 (점수 + 설명)
 * - degraded: 일부 원천이 비어 제한적으로만 반영 (예: 지하철 미반영)
 * - unavailable: 산출에 필요한 데이터가 없음 ("정보 부족")
 * - excluded: 해당 업종 산식에서 제외 ("업종 산식 제외")
 */
export type MetricDisplayState =
  | { status: 'available'; score: number; confidence: IncheonConfidence }
  | { status: 'degraded'; score: number | null; reason: string }
  | { status: 'unavailable'; score: null; reason: string }
  | { status: 'excluded'; score: null; reason: string }

export type IncheonGranularity =
  | 'radius_500m'
  | 'admin_dong_reference'
  | 'district_reference'
  | 'regional_reference'

export interface IncheonAnalyzeRequest {
  lat: number
  lng: number
  targetCategory: BusinessCategory
  demoMode?: boolean
}

export interface IncheonDataSource {
  sourceId: string
  name: string
  provider: string
  url: string
  license: string
  costFree: boolean
  updateCycle: string
  dataPeriod: string
  granularity: IncheonGranularity[]
  scoringUse: boolean
  status: 'ready' | 'local-candidate' | 'blocked' | 'planned' | 'manual'
  notes: string
}

export interface IncheonMetricSourceRef {
  sourceId: string
  name: string
  provider: string
}

export interface IncheonMetricFact {
  label: string
  value: number | string
  unit?: string
  caption?: string
}

export interface IncheonMetricCard {
  label: string
  value: number | string | null
  level: IncheonMetricLevel
  granularity: IncheonGranularity[]
  period: string
  confidence: IncheonConfidence
  sources: IncheonMetricSourceRef[]
  summary: string
  cautions: string[]
  evidence: string[]
  facts?: IncheonMetricFact[]
}

export interface IncheonRiskBreakdown {
  competition: number
  /** 휴리스틱 복합 신호. 종합 점수 가중합에는 포함되지 않는다. */
  survival: number
  transit: number
  anchor: number
  cost: number | null
  /** survival은 의도적으로 제외 — 종합 점수에 들어가는 4개 차원만 가중한다. */
  weights: {
    competition: number
    transit: number
    anchor: number
    cost: number | null
  }
}

/** survival(복합 위험 신호) 메타 — 종합 점수와 분리해 별도 카드로만 노출 */
export interface IncheonSurvivalSignal {
  score: number
  label: string
  method: 'heuristic'
  includedInOverallScore: false
}

export interface IncheonRiskResult {
  /** 상권 데이터가 부족(NO_COMMERCIAL_CONTEXT)하면 null */
  score: number | null
  level: IncheonRiskLevel
  scoreBreakdown: IncheonRiskBreakdown
  survival: IncheonSurvivalSignal
  excludedMetrics: string[]
  degradedMetrics: string[]
  confidenceReasons: string[]
  /** 상권 데이터 부족으로 종합 점수를 산출하지 않은 경우 true */
  insufficientData?: boolean
  notice?: string
  sourceIds?: string[]
  confidence?: IncheonConfidence
  method?: IncheonEvidenceMethod
}

export interface IncheonRiskCard {
  rank: number
  title: string
  body: string
  severity: 'critical' | 'warning' | 'caution'
  evidenceBadges: string[]
}

export interface IncheonLifestyleCard {
  title: string
  body: string
  evidence: string[]
  cautions: string[]
  metricKey: keyof IncheonLifeDNA
}

export interface IncheonLifeDNA {
  educationFamily: IncheonMetricCard
  transitAccess: IncheonMetricCard
  categoryDensity: IncheonMetricCard
  costPressure: IncheonMetricCard
}

export interface IncheonDataQuality {
  overall: IncheonConfidence
  store: IncheonMetricCard
  transit: IncheonMetricCard
  education: IncheonMetricCard
  cost: IncheonMetricCard
}

export interface IncheonAnalyzeResponse {
  productMode: IncheonProductMode
  dataPolicy: IncheonDataPolicy
  location: {
    lat: number
    lng: number
    label: string
    radiusMeters: number
    h3Resolution: number
  }
  category: {
    key: BusinessCategory
    name: string
  }
  risk: IncheonRiskResult
  riskMapCells: RiskMapCell[]
  lifeDNA: IncheonLifeDNA
  cards: {
    riskTop3: IncheonRiskCard[]
    lifestyle: IncheonLifestyleCard[]
    fieldChecks: string[]
  }
  dataQuality: IncheonDataQuality
  sources: IncheonDataSource[]
  auxiliary?: {
    note: string
    datasetGeneratedAt?: string
    missingOptionalDatasets?: string[]
  }
}
