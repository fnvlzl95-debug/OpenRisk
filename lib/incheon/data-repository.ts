import fs from 'fs'
import path from 'path'
import { cellToLatLng, gridDisk, latLngToCell } from 'h3-js'
import type { BusinessCategory } from '@/lib/categories'
import { INCHEON_H3_RESOLUTION, INCHEON_RADIUS_METERS } from './constants'
import type {
  CostPressureDataset,
  DistributionStats,
  EducationFamilyH3Cell,
  EducationFamilyH3Dataset,
  IncheonActualSignals,
  MapMaskDataset,
  MaskPolygon,
  RadiusStatsDataset,
  StoreH3Cell,
  StoreH3Dataset,
  TransitH3Cell,
  TransitH3Dataset,
} from './dataset-types'
import type { RiskMapCell, RiskMapCenter } from './risk-map-types'
import { normalizeWeights, riskLevelFromScore, weightedAverageAvailable } from './scoring'
import { calculateMetricQuality, combineQualityConfidence, qualityToConfidence } from './confidence'
import { getCategoryWeights } from '@/lib/categories'
import type { IncheonConfidence, IncheonRiskResult } from './types'

const DATA_ROOT = path.join(process.cwd(), 'data', 'openrisk-incheon')
const PROCESSED_ROOT = path.join(DATA_ROOT, 'processed')

const FILES = {
  stores: path.join(PROCESSED_ROOT, 'h3-store-counts', 'store-counts-h3.json'),
  transit: path.join(PROCESSED_ROOT, 'h3-transit', 'transit-h3.json'),
  educationFamily: path.join(PROCESSED_ROOT, 'h3-education-family', 'education-family-h3.json'),
  radiusStats: path.join(PROCESSED_ROOT, 'radius-stats', 'radius-stats-500m.json'),
  costPressure: path.join(PROCESSED_ROOT, 'cost-pressure', 'cost-pressure.json'),
  mapMask: path.join(PROCESSED_ROOT, 'osm-mask', 'noncommercial-polygons.json'),
  dataHealth: path.join(PROCESSED_ROOT, 'data-health', 'data-health.json'),
} as const

type DataHealthFile = {
  flags?: { subwayDegraded?: boolean; studentDegraded?: boolean }
}

const EMPTY_EDUCATION_DATASET: EducationFamilyH3Dataset = {
  schemaVersion: 1,
  generatedAt: new Date(0).toISOString(),
  h3Resolution: INCHEON_H3_RESOLUTION,
  sourceIds: [],
  dataPeriod: 'missing',
  cells: {},
  educationStats: { p50: 0, p75: 0, p90: 0, p95: 0, max: 0 },
  anchorStats: { p50: 0, p75: 0, p90: 0, p95: 0, max: 0 },
}

type IncheonDatasetBundle = {
  stores: StoreH3Dataset
  transit: TransitH3Dataset
  educationFamily: EducationFamilyH3Dataset
  radiusStats: RadiusStatsDataset
  costPressure: CostPressureDataset | null
  mapMask: MapMaskDataset | null
}

/**
 * 데이터셋 전반의 건전성 요약. 전 셀 합계가 0인 핵심 신호를 감지해
 * 신뢰도/degraded 표기에 사용한다. (Phase 2에서 data-health.json으로 대체/보강)
 */
type DatasetHealth = {
  subwayDegraded: boolean
  studentDegraded: boolean
  hasEducationFamily: boolean
}

function computeDatasetHealth(bundle: IncheonDatasetBundle): DatasetHealth {
  const hasEducationFamily = bundle.educationFamily.sourceIds.length > 0

  // data-health.json이 있으면 빌드 시 계산된 플래그를 우선 사용한다.
  const healthFile = readJsonFile<DataHealthFile>(FILES.dataHealth)
  if (healthFile?.flags) {
    return {
      subwayDegraded: Boolean(healthFile.flags.subwayDegraded),
      studentDegraded: Boolean(healthFile.flags.studentDegraded) && hasEducationFamily,
      hasEducationFamily,
    }
  }

  // 폴백: 로드된 데이터에서 직접 합계로 감지
  let subwayTotal = 0
  for (const cell of Object.values(bundle.transit.cells)) subwayTotal += cell.subwayRidership ?? 0
  let studentTotal = 0
  for (const cell of Object.values(bundle.educationFamily.cells)) studentTotal += cell.studentCount ?? 0
  return {
    subwayDegraded: subwayTotal <= 0,
    studentDegraded: hasEducationFamily && studentTotal <= 0,
    hasEducationFamily,
  }
}

let datasetCache: { signature: string; bundle: IncheonDatasetBundle; health: DatasetHealth } | null = null
const h3CenterCache = new Map<string, RiskMapCenter>()
const maskIndexCache = new WeakMap<MapMaskDataset, Map<string, MaskPolygon[]>>()

export class IncheonDatasetNotReadyError extends Error {
  missingDatasets: string[]

  constructor(missingDatasets: string[]) {
    super(`Incheon public datasets are not ready: ${missingDatasets.join(', ')}`)
    this.name = 'IncheonDatasetNotReadyError'
    this.missingDatasets = missingDatasets
  }
}

function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T
}

function fileSignature(filePath: string) {
  if (!fs.existsSync(filePath)) return 'missing'
  const stats = fs.statSync(filePath)
  return `${stats.size}:${stats.mtimeMs}`
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

function round(value: number) {
  return Math.round(clamp(value))
}

function distanceMeters(a: RiskMapCenter, b: RiskMapCenter) {
  const earthRadius = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * earthRadius * Math.asin(Math.sqrt(h))
}

function cellCenter(h3Id: string) {
  const cached = h3CenterCache.get(h3Id)
  if (cached) return cached
  const [lat, lng] = cellToLatLng(h3Id)
  const center = { lat, lng }
  h3CenterCache.set(h3Id, center)
  return center
}

function riskFromDistribution(value: number, stats: DistributionStats | undefined) {
  if (!stats || stats.max <= 0 || value <= 0) return 0
  if (value >= stats.p95) return 88 + clamp(((value - stats.p95) / Math.max(1, stats.max - stats.p95)) * 12)
  if (value >= stats.p90) return 76 + clamp(((value - stats.p90) / Math.max(1, stats.p95 - stats.p90)) * 12)
  if (value >= stats.p75) return 55 + clamp(((value - stats.p75) / Math.max(1, stats.p90 - stats.p75)) * 21)
  if (value >= stats.p50) return 32 + clamp(((value - stats.p50) / Math.max(1, stats.p75 - stats.p50)) * 23)
  return clamp((value / Math.max(1, stats.p50)) * 32)
}

function accessFromDistribution(value: number, stats: DistributionStats | undefined) {
  return riskFromDistribution(value, stats)
}

function maxGeneratedAt(values: Array<string | undefined>) {
  return values.filter(Boolean).sort().at(-1) ?? new Date(0).toISOString()
}

function formatOptionalNumber(value: number | undefined, suffix: string) {
  return value === undefined ? null : `${value.toLocaleString('ko-KR')}${suffix}`
}

function buildDiskCellIds(center: RiskMapCenter, radiusMeters = INCHEON_RADIUS_METERS) {
  const centerCell = latLngToCell(center.lat, center.lng, INCHEON_H3_RESOLUTION)
  const cells = gridDisk(centerCell, 9)
  return cells.filter((h3Id) => {
    return distanceMeters(center, cellCenter(h3Id)) <= radiusMeters + 120
  })
}

function radiusWeight(center: RiskMapCenter, h3Id: string) {
  const distance = distanceMeters(center, cellCenter(h3Id))
  if (distance > INCHEON_RADIUS_METERS + 120) return 0
  return Math.exp(-0.5 * (distance / 360) ** 2)
}

function addWeightedStoreCell(total: StoreH3Cell, cell: StoreH3Cell | undefined, weight: number) {
  if (!cell) return total
  total.totalStores += cell.totalStores * weight
  for (const [category, count] of Object.entries(cell.categoryCounts)) {
    const key = category as BusinessCategory
    total.categoryCounts[key] = (total.categoryCounts[key] ?? 0) + (count ?? 0) * weight
  }
  return total
}

function addWeightedTransitCell(total: TransitH3Cell, cell: TransitH3Cell | undefined, weight: number) {
  if (!cell) return total
  total.busStopCount += cell.busStopCount * weight
  total.busRidership += cell.busRidership * weight
  total.subwayRidership += cell.subwayRidership * weight
  total.accessScore += cell.accessScore * weight
  return total
}

function addWeightedEducationCell(total: EducationFamilyH3Cell, cell: EducationFamilyH3Cell | undefined, weight: number) {
  if (!cell) return total
  total.schoolCount += cell.schoolCount * weight
  total.studentCount += cell.studentCount * weight
  total.childcareCount += cell.childcareCount * weight
  total.childcareCapacity += cell.childcareCapacity * weight
  total.childcareCurrent += cell.childcareCurrent * weight
  total.anchorCount += cell.anchorCount * weight
  total.educationScore += cell.educationScore * weight
  return total
}

function buildEmptyStoreTotal(): StoreH3Cell {
  return { totalStores: 0, categoryCounts: {} }
}

function buildEmptyTransitTotal(): TransitH3Cell {
  return { busStopCount: 0, busRidership: 0, subwayRidership: 0, accessScore: 0 }
}

function buildEmptyEducationTotal(): EducationFamilyH3Cell {
  return {
    schoolCount: 0,
    studentCount: 0,
    childcareCount: 0,
    childcareCapacity: 0,
    childcareCurrent: 0,
    anchorCount: 0,
    educationScore: 0,
  }
}

function aggregateRadius(center: RiskMapCenter, datasets: IncheonDatasetBundle) {
  const radiusCells = buildDiskCellIds(center, INCHEON_RADIUS_METERS)
  const storeTotal = buildEmptyStoreTotal()
  const transitTotal = buildEmptyTransitTotal()
  const educationTotal = buildEmptyEducationTotal()

  for (const h3Id of radiusCells) {
    const weight = radiusWeight(center, h3Id)
    if (weight <= 0) continue
    addWeightedStoreCell(storeTotal, datasets.stores.cells[h3Id], weight)
    addWeightedTransitCell(transitTotal, datasets.transit.cells[h3Id], weight)
    addWeightedEducationCell(educationTotal, datasets.educationFamily.cells[h3Id], weight)
  }

  return { radiusCells, storeTotal, transitTotal, educationTotal }
}

const COST_REGION_ANCHORS: Array<{ name: string; lat: number; lng: number }> = [
  { name: '간석오거리', lat: 37.467, lng: 126.708 },
  { name: '검단사거리완정역', lat: 37.602, lng: 126.657 },
  { name: '계양계산', lat: 37.543, lng: 126.728 },
  { name: '구월', lat: 37.449, lng: 126.702 },
  { name: '부평', lat: 37.490, lng: 126.725 },
  { name: '석남/가정중앙시장', lat: 37.506, lng: 126.675 },
  { name: '신포동', lat: 37.471, lng: 126.625 },
  { name: '인천서구청', lat: 37.545, lng: 126.676 },
  { name: '주안', lat: 37.465, lng: 126.680 },
]

type CostSelection = {
  region: CostPressureDataset['regions'][number] | null
  method: 'actual' | 'unmatched_region'
}

/**
 * 가장 가까운 비용 권역(4.5km 이내)을 고른다.
 * 매칭되는 권역이 없으면 인천 시평균으로 폴백하지 않고 null + unmatched_region을 반환한다.
 * (비용 없음을 임의값으로 메우지 않고 산식 제외 + 신뢰도 하향으로 처리하기 위함)
 */
function selectCostRegion(center: RiskMapCenter, costPressure: CostPressureDataset | null): CostSelection {
  if (!costPressure) return { region: null, method: 'unmatched_region' }
  const nearestAnchor = COST_REGION_ANCHORS.map((anchor) => ({
    anchor,
    distance: distanceMeters(center, { lat: anchor.lat, lng: anchor.lng }),
  })).sort((a, b) => a.distance - b.distance)[0]

  if (!nearestAnchor || nearestAnchor.distance > 4500) return { region: null, method: 'unmatched_region' }
  const region = costPressure.regions.find((item) => item.regionName === nearestAnchor.anchor.name) ?? null
  return region ? { region, method: 'actual' } : { region: null, method: 'unmatched_region' }
}

function isPointInPolygon(point: RiskMapCenter, polygon: Array<[number, number]>) {
  let inside = false
  const x = point.lng
  const y = point.lat

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0]
    const yi = polygon[i][1]
    const xj = polygon[j][0]
    const yj = polygon[j][1]
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi
    if (intersects) inside = !inside
  }

  return inside
}

function maskBucket(lat: number, lng: number) {
  return `${Math.floor(lat * 100)}:${Math.floor(lng * 100)}`
}

function buildMaskIndex(mask: MapMaskDataset) {
  const cached = maskIndexCache.get(mask)
  if (cached) return cached

  const buckets = new Map<string, MaskPolygon[]>()
  for (const polygon of mask.polygons) {
    const [minLng, minLat, maxLng, maxLat] = polygon.bbox
    const minLatBucket = Math.floor(minLat * 100)
    const maxLatBucket = Math.floor(maxLat * 100)
    const minLngBucket = Math.floor(minLng * 100)
    const maxLngBucket = Math.floor(maxLng * 100)

    for (let latBucket = minLatBucket; latBucket <= maxLatBucket; latBucket += 1) {
      for (let lngBucket = minLngBucket; lngBucket <= maxLngBucket; lngBucket += 1) {
        const key = `${latBucket}:${lngBucket}`
        const bucket = buckets.get(key)
        if (bucket) {
          bucket.push(polygon)
        } else {
          buckets.set(key, [polygon])
        }
      }
    }
  }

  maskIndexCache.set(mask, buckets)
  return buckets
}

function isMasked(point: RiskMapCenter, mask: MapMaskDataset | null) {
  if (!mask) return false
  const candidates = buildMaskIndex(mask).get(maskBucket(point.lat, point.lng)) ?? []
  return candidates.some((polygon) => {
    const [minLng, minLat, maxLng, maxLat] = polygon.bbox
    if (point.lng < minLng || point.lng > maxLng || point.lat < minLat || point.lat > maxLat) return false
    return isPointInPolygon(point, polygon.coordinates)
  })
}

export function getIncheonDatasetStatus() {
  const available = Object.entries(FILES)
    .filter(([, filePath]) => fs.existsSync(filePath))
    .map(([key]) => key)
  const required = ['stores', 'transit', 'radiusStats']
  const missingRequired = required.filter((key) => !available.includes(key))
  const missingOptional = ['educationFamily', 'costPressure', 'mapMask'].filter((key) => !available.includes(key))

  return {
    ready: missingRequired.length === 0,
    files: FILES,
    available,
    missingRequired,
    missingOptional,
  }
}

export function requireIncheonDatasets() {
  const status = getIncheonDatasetStatus()
  if (!status.ready) {
    throw new IncheonDatasetNotReadyError(status.missingRequired)
  }

  const signature = Object.values(FILES).map(fileSignature).join('|')
  if (datasetCache?.signature === signature) {
    return datasetCache.bundle
  }

  const bundle: IncheonDatasetBundle = {
    stores: readJsonFile<StoreH3Dataset>(FILES.stores) as StoreH3Dataset,
    transit: readJsonFile<TransitH3Dataset>(FILES.transit) as TransitH3Dataset,
    educationFamily: readJsonFile<EducationFamilyH3Dataset>(FILES.educationFamily) ?? EMPTY_EDUCATION_DATASET,
    radiusStats: readJsonFile<RadiusStatsDataset>(FILES.radiusStats) as RadiusStatsDataset,
    costPressure: readJsonFile<CostPressureDataset>(FILES.costPressure),
    mapMask: readJsonFile<MapMaskDataset>(FILES.mapMask),
  }

  datasetCache = { signature, bundle, health: computeDatasetHealth(bundle) }
  return bundle
}

function getDatasetHealth(): DatasetHealth {
  return datasetCache?.health ?? { subwayDegraded: false, studentDegraded: false, hasEducationFamily: false }
}

/**
 * 종합 점수 단일 산식. 헤드라인과 모든 지도 셀이 이 함수를 호출해 일관성을 보장한다.
 * survival은 제외하고 경쟁/교통/앵커/비용만 업종 가중치로 가용 재정규화한다.
 */
function scoreFromMetrics(
  metrics: { competition: number; transit: number; anchor: number; cost: number | null },
  category: BusinessCategory
): { score: number | null; weights: { competition: number; transit: number; anchor: number; cost: number | null } } {
  const sw = getCategoryWeights(category)
  const rawWeights = {
    competition: sw.competition,
    transit: sw.traffic,
    anchor: sw.anchor,
    cost: metrics.cost === null ? null : sw.cost,
  }
  const raw = weightedAverageAvailable(
    { competition: metrics.competition, transit: metrics.transit, anchor: metrics.anchor, cost: metrics.cost },
    rawWeights
  )
  return {
    score: raw === null ? null : round(raw),
    weights: normalizeWeights(rawWeights),
  }
}

/** 상권 근거 수준. none/low이면 "데이터 없음"을 "위험 낮음"으로 오해석하지 않도록 점수를 만들지 않는다. */
function commercialEvidenceLevel(
  storeTotal: StoreH3Cell,
  transitTotal: TransitH3Cell,
  educationTotal: EducationFamilyH3Cell,
  sameCategoryWeighted: number
): 'none' | 'low' | 'medium' | 'high' {
  const evidence =
    storeTotal.totalStores +
    sameCategoryWeighted * 2 +
    transitTotal.busStopCount +
    Math.log1p(Math.max(0, transitTotal.busRidership)) +
    (transitTotal.subwayRidership > 0 ? Math.log1p(transitTotal.subwayRidership) : 0) +
    educationTotal.schoolCount +
    educationTotal.childcareCount
  if (evidence <= 0) return 'none'
  if (evidence < 5) return 'low'
  if (evidence < 20) return 'medium'
  return 'high'
}

export function calculateActualIncheonRisk(params: {
  lat: number
  lng: number
  category: BusinessCategory
}): { risk: IncheonRiskResult; signals: IncheonActualSignals; riskMapCells: RiskMapCell[] } {
  const center = { lat: params.lat, lng: params.lng }
  const datasets = requireIncheonDatasets()
  const health = getDatasetHealth()
  const { radiusCells, storeTotal, transitTotal, educationTotal } = aggregateRadius(center, datasets)

  const sameCategoryWeighted = storeTotal.categoryCounts[params.category] ?? 0
  const sameCategoryCount = Math.round(sameCategoryWeighted)
  const totalStores = Math.round(storeTotal.totalStores)
  const competitionRisk = round(
    riskFromDistribution(sameCategoryWeighted, datasets.radiusStats.storeCategoryStats[params.category])
  )
  const transitAccessScore = round(accessFromDistribution(transitTotal.accessScore, datasets.radiusStats.transitAccessStats))
  const transitRisk = round(100 - transitAccessScore)
  const educationFamilyScore = round(accessFromDistribution(educationTotal.educationScore, datasets.radiusStats.educationStats))
  const hasEducationFamily = datasets.educationFamily.sourceIds.length > 0
  const anchorSignal = educationTotal.anchorCount + transitTotal.busStopCount
  const anchorAccessScore = hasEducationFamily
    ? round(accessFromDistribution(anchorSignal, datasets.radiusStats.anchorStats))
    : transitAccessScore
  const anchorRisk = round(100 - anchorAccessScore)

  const costSel = selectCostRegion(center, datasets.costPressure)
  const costScore = costSel.region?.costScore ?? null
  const costPeriod = costSel.region?.rentPeriod ?? costSel.region?.vacancyPeriod ?? null
  const costMethod: IncheonActualSignals['costMethod'] =
    costScore === null ? (datasets.costPressure ? 'unmatched_region' : 'estimated') : 'actual'
  const costRegionName = costSel.region?.regionName ?? null
  const costGranularity: IncheonActualSignals['costGranularity'] = costScore === null ? null : 'regional_reference'

  // survival(복합 위험 신호): 가용 지표만 재정규화 — 비용 없을 때 50 임의 주입 제거. 종합 점수에는 미포함.
  const survivalRaw = weightedAverageAvailable(
    { competition: competitionRisk, transit: transitRisk, cost: costScore, anchor: anchorRisk },
    { competition: 0.45, transit: 0.25, cost: 0.2, anchor: 0.1 }
  )
  const survivalRisk = survivalRaw === null ? 0 : round(survivalRaw)

  // 종합 점수: 단일 산식(헤드라인 = 지도 셀 동일), survival 제외, 가용 재정규화.
  const overall = scoreFromMetrics(
    { competition: competitionRisk, transit: transitRisk, anchor: anchorRisk, cost: costScore },
    params.category
  )

  // 상권 근거 게이트: 데이터가 거의 없는 곳은 종합 점수를 산출하지 않는다.
  const evidenceLevel = commercialEvidenceLevel(storeTotal, transitTotal, educationTotal, sameCategoryWeighted)
  const insufficientData = evidenceLevel === 'none' || evidenceLevel === 'low'
  const score = insufficientData ? null : overall.score

  // 신뢰도: 데이터 품질 기반 + min-cap (데이터셋 존재 여부가 아니라 품질로 산정)
  // 핵심 원천이 통째로 빈(degraded) 지표는 품질을 medium 이하(<=0.45)로 캡해 평균에 묻히지 않게 한다.
  const DEGRADED_CAP = 0.45
  const costAvailable = costScore !== null
  const competitionQuality = calculateMetricQuality({ available: true, nonZero: totalStores > 0, freshnessScore: 0.9, granularityScore: 1, sourceScore: 1 })
  const transitQualityBase = calculateMetricQuality({ available: true, nonZero: transitTotal.accessScore > 0, freshnessScore: 0.9, granularityScore: 1, sourceScore: 1 })
  const transitQuality = health.subwayDegraded ? Math.min(transitQualityBase, DEGRADED_CAP) : transitQualityBase
  const anchorQualityBase = calculateMetricQuality({ available: hasEducationFamily, nonZero: anchorSignal > 0, freshnessScore: 0.9, granularityScore: 1, sourceScore: 1 })
  const anchorQuality = health.studentDegraded ? Math.min(anchorQualityBase, DEGRADED_CAP) : anchorQualityBase
  const educationQuality = health.studentDegraded ? DEGRADED_CAP : anchorQualityBase
  const costQuality = calculateMetricQuality({ available: costAvailable, nonZero: costAvailable, freshnessScore: 0.8, granularityScore: 0.5, sourceScore: 1 })
  const qualityInputs = [competitionQuality, transitQuality, anchorQuality]
  if (costAvailable) qualityInputs.push(costQuality)
  const confidence: IncheonConfidence = insufficientData ? 'low' : combineQualityConfidence(qualityInputs)

  const degradedMetrics: string[] = []
  const confidenceReasons: string[] = []
  if (insufficientData) confidenceReasons.push('해당 반경 내 상권 데이터가 부족해 종합 위험 점수를 산출하지 않았습니다.')
  if (health.subwayDegraded) {
    degradedMetrics.push('transit')
    confidenceReasons.push('지하철 승하차 데이터가 현재 점수에 반영되지 않아 교통 접근성은 버스 기준으로만 산출했습니다.')
  }
  if (health.studentDegraded) {
    degradedMetrics.push('anchor')
    confidenceReasons.push('학생수 데이터가 현재 점수에 반영되지 않았습니다.')
  }
  if (!costAvailable) confidenceReasons.push('이 위치에 대응되는 비용 권역이 없어 비용 지표는 산식에서 제외했습니다.')
  else confidenceReasons.push('비용 데이터는 권역(구·역세권) 단위 기준입니다.')

  const sourceIds = Array.from(
    new Set([
      ...datasets.stores.sourceIds,
      ...datasets.transit.sourceIds,
      ...datasets.educationFamily.sourceIds,
      ...(datasets.costPressure?.sourceIds ?? []),
    ])
  )
  const generatedAt = maxGeneratedAt([
    datasets.stores.generatedAt,
    datasets.transit.generatedAt,
    datasets.educationFamily.generatedAt,
    datasets.radiusStats.generatedAt,
    datasets.costPressure?.generatedAt,
  ])
  const missingOptionalDatasets = [
    ...(hasEducationFamily ? [] : ['educationFamily']),
    ...(datasets.costPressure ? [] : ['costPressure']),
    ...(datasets.mapMask ? [] : ['mapMask']),
  ]

  const riskMapCells = radiusCells.map((h3Id) => {
    const point = cellCenter(h3Id)
    if (isMasked(point, datasets.mapMask)) {
      return {
        h3Id,
        score: null,
        status: 'masked',
        sourceIds: ['osm-noncommercial-mask'],
        confidence: 'medium',
        method: 'actual',
        reason: '공원, 바다 등 상권이 형성되지 않는 구역',
      } satisfies RiskMapCell
    }

    const cellSignals = aggregateRadius(point, datasets)
    const cellSameCategory = cellSignals.storeTotal.categoryCounts[params.category] ?? 0
    const cellAnchorSignal = cellSignals.educationTotal.anchorCount + cellSignals.transitTotal.busStopCount
    const hasCellSignal =
      cellSignals.storeTotal.totalStores > 0 ||
      cellSignals.transitTotal.accessScore > 0 ||
      cellSignals.educationTotal.educationScore > 0

    if (!hasCellSignal) {
      return {
        h3Id,
        score: null,
        status: 'no_data',
        sourceIds,
        confidence: 'low',
        method: 'actual',
        reason: '수집된 상권 데이터가 부족한 구역',
      } satisfies RiskMapCell
    }

    const cellCompetition = round(
      riskFromDistribution(cellSameCategory, datasets.radiusStats.storeCategoryStats[params.category])
    )
    const cellTransitRisk = round(100 - accessFromDistribution(cellSignals.transitTotal.accessScore, datasets.radiusStats.transitAccessStats))
    const cellAnchorRisk = round(100 - accessFromDistribution(cellAnchorSignal, datasets.radiusStats.anchorStats))
    // 헤드라인과 동일한 단일 산식 사용(비용은 권역 공유). 셀별 점수와 종합 점수가 일관.
    const cellScore =
      scoreFromMetrics(
        { competition: cellCompetition, transit: cellTransitRisk, anchor: cellAnchorRisk, cost: costScore },
        params.category
      ).score ?? round(cellCompetition * 0.6 + cellTransitRisk * 0.25 + cellAnchorRisk * 0.15)
    return {
      h3Id,
      score: cellScore,
      status: 'data',
      sourceIds,
      confidence: 'medium',
      method: 'actual',
    } satisfies RiskMapCell
  })

  return {
    risk: {
      score,
      level: score === null ? 'LOW' : riskLevelFromScore(score),
      scoreBreakdown: {
        competition: competitionRisk,
        survival: survivalRisk,
        transit: transitRisk,
        anchor: anchorRisk,
        cost: costScore === null ? null : round(costScore),
        weights: overall.weights,
      },
      survival: {
        score: survivalRisk,
        label: '복합 위험 신호',
        method: 'heuristic',
        includedInOverallScore: false,
      },
      excludedMetrics: costScore === null ? ['cost'] : [],
      degradedMetrics,
      confidenceReasons,
      insufficientData,
      notice: insufficientData
        ? '해당 위치 주변에는 점포·교통·생활권 데이터가 부족해 종합 점수를 제공하지 않습니다. 지도와 원자료만 참고해 주세요.'
        : undefined,
      sourceIds,
      confidence,
      method: 'estimated',
    },
    signals: {
      sameCategoryCount,
      totalStores,
      competitionRisk,
      transitAccessScore,
      transitRisk,
      educationFamilyScore,
      anchorAccessScore,
      anchorRisk,
      survivalRisk,
      costScore,
      costPeriod,
      costMethod,
      costRegionName,
      costGranularity,
      evidenceLevel,
      degradedMetrics,
      confidenceReasons,
      missingOptionalDatasets,
      sourceIds,
      generatedAt,
      confidence,
      method: 'estimated',
      evidence: {
        competition: {
          score: competitionRisk,
          confidence: qualityToConfidence(competitionQuality),
          method: 'actual',
          sourceIds: datasets.stores.sourceIds,
          evidence: [`반경 500m 비슷한 매장 약 ${sameCategoryCount}곳`, `반경 500m 전체 점포 약 ${totalStores}곳`],
        },
        transit: {
          score: transitRisk,
          confidence: qualityToConfidence(transitQuality),
          method: 'actual',
          sourceIds: datasets.transit.sourceIds,
          evidence: [
            `반경 500m 정류장 약 ${Math.round(transitTotal.busStopCount)}곳`,
            `버스 승하차 ${Math.round(transitTotal.busRidership).toLocaleString('ko-KR')}건`,
          ],
        },
        educationFamily: {
          score: educationFamilyScore,
          confidence: qualityToConfidence(educationQuality),
          method: 'actual',
          sourceIds: datasets.educationFamily.sourceIds,
          evidence: hasEducationFamily
            ? [
                `학교 ${educationTotal.schoolCount}곳`,
                `어린이집 ${educationTotal.childcareCount}곳`,
                ...(health.studentDegraded
                  ? ['학생수 데이터는 현재 미반영']
                  : [`학생수 ${Math.round(educationTotal.studentCount).toLocaleString('ko-KR')}명`]),
              ]
            : ['학교 위치/어린이집 위치 데이터가 아직 부족합니다.'],
          facts: hasEducationFamily
            ? [
                {
                  label: '학교',
                  value: Math.round(educationTotal.schoolCount),
                  unit: '곳',
                  caption: '초·중·고 위치 기준',
                },
                {
                  label: '어린이집',
                  value: Math.round(educationTotal.childcareCount),
                  unit: '곳',
                  caption: '어린이집 기본정보 기준',
                },
                {
                  label: '학생수',
                  value: Math.round(educationTotal.studentCount),
                  unit: '명',
                  caption: '학교현황 조인 가능 항목',
                },
                {
                  label: '보육 현원',
                  value: Math.round(educationTotal.childcareCurrent),
                  unit: '명',
                  caption: '정원 대비 참고',
                },
              ]
            : [],
        },
        anchor: {
          score: anchorRisk,
          confidence: qualityToConfidence(anchorQuality),
          method: 'actual',
          sourceIds: [...datasets.educationFamily.sourceIds, ...datasets.transit.sourceIds],
          evidence: hasEducationFamily
            ? [`교육·보육·교통 앵커 약 ${Math.round(anchorSignal)}개`]
            : ['교육·보육 앵커 미확보: 교통 접근성을 보조 앵커로 사용'],
        },
        survival: {
          score: survivalRisk,
          confidence: 'medium',
          method: 'heuristic',
          sourceIds,
          evidence: ['경쟁·고객 접근성·비용·주요 시설 접근성을 조합한 복합 신호(종합 점수 미포함)'],
        },
        cost: {
          score: costScore,
          confidence: costAvailable ? qualityToConfidence(costQuality) : 'low',
          method: costScore === null ? 'estimated' : 'actual',
          sourceIds: datasets.costPressure?.sourceIds ?? [],
          evidence: costScore === null
            ? costMethod === 'unmatched_region'
              ? ['이 위치에 대응되는 비용 권역이 없어 산식에서 제외']
              : ['임대료·공실률 원천 데이터 없음']
            : [
                `${costSel.region?.regionName ?? '인천'} 권역 비용 참고`,
                ...[
                  formatOptionalNumber(costSel.region?.rentPerSquareMeter, '천원/㎡ 임대료'),
                  formatOptionalNumber(costSel.region?.vacancyRate, '% 공실률'),
                ].filter((value): value is string => Boolean(value)),
              ],
        },
      },
    },
    riskMapCells,
  }
}
