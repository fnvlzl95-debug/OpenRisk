import type { BusinessCategory } from '@/lib/categories'
import type { RiskMapCell } from './risk-map-types'

export type IncheonProductMode = 'openrisk-incheon'
export type IncheonDataPolicy = 'public-data-only'

export type IncheonRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH'
export type IncheonMetricLevel = 'low' | 'medium' | 'high' | 'unknown'
export type IncheonConfidence = 'high' | 'medium' | 'low'
export type IncheonEvidenceMethod = 'actual' | 'estimated'

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
  transit: number
  survival: number
  anchor: number
  cost: number | null
  weights: {
    competition: number
    transit: number
    survival: number
    anchor: number
    cost: number | null
  }
}

export interface IncheonRiskResult {
  score: number
  level: IncheonRiskLevel
  scoreBreakdown: IncheonRiskBreakdown
  excludedMetrics: string[]
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
