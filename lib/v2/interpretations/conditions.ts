/**
 * 조건 조합 정의
 * 여러 지표의 조합을 키로 만들어 템플릿 매칭에 사용
 */

import type { BusinessCategory } from '../../categories'
import type {
  CompetitionMetrics,
  TrafficMetrics,
  CostMetrics,
  SurvivalMetrics,
  AnchorMetrics,
  AreaType,
} from '../types'

// 지표 레벨 타입
export type MetricLevel = 'low' | 'medium' | 'high'
export type TrafficLevelSimple = 'low' | 'medium' | 'high'

// 조건 조합 셋
export interface ConditionSet {
  competition?: MetricLevel
  traffic?: TrafficLevelSimple
  cost?: MetricLevel
  survival?: MetricLevel
  areaType?: AreaType
  hasSubway?: boolean
  peakTime?: 'morning' | 'day' | 'night'
}

// 동적 변수 (문장에 삽입)
export interface DynamicVars {
  // 기본
  categoryName: string
  sameCategory: number
  totalStores: number
  avgRent: number           // 평당 임대료 (만원/평)
  rentMonthly10: number     // 10평 기준 월 임대료 (만원)
  closureRate: number
  trafficIndex: number

  // 피크 시간
  peakTimeLabel: string  // "아침", "낮", "저녁"

  // 앵커 시설
  subwayName?: string
  subwayDistance?: number
  starbucksCount?: number

  // 상권 유형
  areaTypeLabel: string  // "주거 밀집", "상업 중심" 등

  // 비교
  rentVsAvgPercent?: number  // 구 평균 대비 +/- %

  // 해시용 (일관성 유지)
  h3Id?: string
}

// 템플릿 구조
export interface Template {
  id: string
  conditions: ConditionSet
  phrases: string[]
  tone: 'positive' | 'caution' | 'warning' | 'critical'
  actionHint?: string
}

// 전체 메트릭스 인터페이스
export interface AllMetrics {
  competition: CompetitionMetrics
  traffic: TrafficMetrics
  cost: CostMetrics
  survival: SurvivalMetrics
  anchors: AnchorMetrics
  areaType: AreaType
  category: BusinessCategory
}

// ===== 레벨 판별 함수 =====

export function getCompetitionLevel(sameCategory: number): MetricLevel {
  if (sameCategory <= 5) return 'low'
  if (sameCategory <= 15) return 'medium'
  return 'high'
}

/**
 * 유동인구 레벨 (해석용, 3단계)
 *
 * 2025.01 기준 실측 분포:
 * - 평균: 6, 중앙값: 3
 * - 75%: 6, 90%: 13, 95%: 21, 99%: 44, 최대: 70
 *
 * 해석 카드용 기준:
 * - low: ≤6 (하위 75%) - 유동인구 적음
 * - medium: 7~20 (75~95%) - 보통
 * - high: >20 (상위 5%) - 유동인구 많음
 */
export function getTrafficLevelSimple(index: number): TrafficLevelSimple {
  if (index <= 6) return 'low'     // 하위 75%: 적음
  if (index <= 20) return 'medium' // 75~95%: 보통
  return 'high'                    // 상위 5%: 많음
}

export function getCostLevelSimple(avgRent: number): MetricLevel {
  if (avgRent <= 15) return 'low'
  if (avgRent <= 40) return 'medium'
  return 'high'
}

export function getSurvivalLevel(closureRate: number): MetricLevel {
  if (closureRate < 30) return 'low'
  if (closureRate < 50) return 'medium'
  return 'high'
}

// ===== 컨텍스트 키 생성 =====

export function buildContextKey(metrics: AllMetrics): string {
  const parts: string[] = []

  // 경쟁
  const compLevel = getCompetitionLevel(metrics.competition.sameCategory)
  parts.push(`comp_${compLevel}`)

  // 유동인구
  const trafficLevel = getTrafficLevelSimple(metrics.traffic.index)
  parts.push(`traffic_${trafficLevel}`)

  // 임대료
  const costLevel = getCostLevelSimple(metrics.cost.avgRent)
  parts.push(`cost_${costLevel}`)

  return parts.join('_')
}

// 간소화된 키 (fallback용)
export function simplifyKey(fullKey: string, keepCount: number = 2): string {
  const parts = fullKey.split('_')
  // comp_high_traffic_low_cost_high → comp_high_traffic_low
  return parts.slice(0, keepCount * 2).join('_')
}

// ===== 동적 변수 생성 =====

export function buildDynamicVars(
  metrics: AllMetrics,
  categoryName: string,
  h3Id?: string
): DynamicVars {
  const peakTimeLabels = {
    morning: '아침',
    day: '낮',
    night: '저녁',
  }

  const areaTypeLabels: Record<AreaType, string> = {
    'A_주거': '주거 밀집 지역',
    'B_혼합': '직주 혼합 지역',
    'C_상업': '상업 중심지',
    'D_특수': '특수 상권',
  }

  return {
    categoryName,
    sameCategory: metrics.competition.sameCategory,
    totalStores: metrics.competition.total,
    avgRent: metrics.cost.avgRent,
    rentMonthly10: metrics.cost.avgRent * 10,  // 10평 기준 월 임대료
    closureRate: metrics.survival.closureRate,
    trafficIndex: metrics.traffic.index,
    peakTimeLabel: peakTimeLabels[metrics.traffic.peakTime] || '낮',
    subwayName: metrics.anchors.subway?.name,
    subwayDistance: metrics.anchors.subway?.distance,
    starbucksCount: metrics.anchors.starbucks?.count,
    areaTypeLabel: areaTypeLabels[metrics.areaType],
    h3Id,
  }
}

// ===== 문장 해시 선택 (일관성 유지) =====

export function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

export function selectPhrase(phrases: string[], h3Id?: string): string {
  if (phrases.length === 0) return ''
  if (phrases.length === 1) return phrases[0]

  const index = h3Id
    ? hashString(h3Id) % phrases.length
    : Math.floor(Math.random() * phrases.length)

  return phrases[index]
}

// ===== 변수 치환 =====

export function interpolate(template: string, vars: DynamicVars): string {
  return template.replace(/\$\{(\w+)\}/g, (match, key) => {
    const value = vars[key as keyof DynamicVars]
    if (value === undefined || value === null) return match
    return String(value)
  })
}
