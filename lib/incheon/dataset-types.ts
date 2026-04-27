import type { BusinessCategory } from '@/lib/categories'
import type { IncheonConfidence, IncheonEvidenceMethod, IncheonMetricFact } from './types'

export type DatasetGranularity = 'h3_10' | 'admin_dong' | 'district' | 'regional'

export interface DatasetMeta {
  schemaVersion: 1
  generatedAt: string
  h3Resolution?: number
  sourceIds: string[]
  dataPeriod?: string
}

export interface DistributionStats {
  p50: number
  p75: number
  p90: number
  p95: number
  max: number
}

export interface StoreH3Cell {
  totalStores: number
  categoryCounts: Partial<Record<BusinessCategory, number>>
}

export interface StoreH3Dataset extends DatasetMeta {
  h3Resolution: number
  cells: Record<string, StoreH3Cell>
  categoryStats: Partial<Record<BusinessCategory, DistributionStats>>
  totalStats: DistributionStats
}

export interface RadiusStatsDataset extends DatasetMeta {
  h3Resolution: number
  radiusMeters: number
  method: 'distance_decay_radius'
  centerCellCount: number
  storeCategoryStats: Partial<Record<BusinessCategory, DistributionStats>>
  totalStoreStats: DistributionStats
  transitAccessStats: DistributionStats
  educationStats: DistributionStats
  anchorStats: DistributionStats
}

export interface TransitH3Cell {
  busStopCount: number
  busRidership: number
  subwayRidership: number
  accessScore: number
}

export interface TransitH3Dataset extends DatasetMeta {
  h3Resolution: number
  cells: Record<string, TransitH3Cell>
  accessStats: DistributionStats
}

export interface EducationFamilyH3Cell {
  schoolCount: number
  studentCount: number
  childcareCount: number
  childcareCapacity: number
  childcareCurrent: number
  anchorCount: number
  educationScore: number
}

export interface EducationFamilyH3Dataset extends DatasetMeta {
  h3Resolution: number
  cells: Record<string, EducationFamilyH3Cell>
  educationStats: DistributionStats
  anchorStats: DistributionStats
}

export interface CostPressureRegion {
  regionName: string
  rentPerSquareMeter?: number
  vacancyRate?: number
  rentPeriod?: string
  vacancyPeriod?: string
  costScore: number
  confidence: IncheonConfidence
}

export interface CostPressureDataset extends DatasetMeta {
  unit?: {
    rentPerSquareMeter?: string
    vacancyRate?: string
  }
  regions: CostPressureRegion[]
}

export interface MaskPolygon {
  id: string
  source: 'osm'
  tags: Record<string, string>
  bbox: [number, number, number, number]
  coordinates: Array<[number, number]>
}

export interface MapMaskDataset extends DatasetMeta {
  sourceIds: ['osm-noncommercial-mask']
  polygons: MaskPolygon[]
}

export interface IncheonMetricEvidence {
  score: number | null
  confidence: IncheonConfidence
  method: IncheonEvidenceMethod
  sourceIds: string[]
  evidence: string[]
  facts?: IncheonMetricFact[]
}

export interface IncheonActualSignals {
  sameCategoryCount: number
  totalStores: number
  competitionRisk: number
  transitAccessScore: number
  transitRisk: number
  educationFamilyScore: number
  anchorAccessScore: number
  anchorRisk: number
  survivalRisk: number
  costScore: number | null
  costPeriod: string | null
  missingOptionalDatasets: string[]
  sourceIds: string[]
  generatedAt: string
  confidence: IncheonConfidence
  method: IncheonEvidenceMethod
  evidence: {
    competition: IncheonMetricEvidence
    transit: IncheonMetricEvidence
    educationFamily: IncheonMetricEvidence
    anchor: IncheonMetricEvidence
    survival: IncheonMetricEvidence
    cost: IncheonMetricEvidence
  }
}
