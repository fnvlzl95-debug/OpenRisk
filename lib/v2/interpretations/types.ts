/**
 * 해석 문장 시스템 타입 정의
 *
 * 핵심 원칙: [관측] → [구조 해석] → [실패 메커니즘]
 * - "기회/전략" 금지, "취약점/리스크" 중심
 * - 고정비/공백/변동성 키워드 사용
 */

import type { BusinessCategory } from '../../categories'

export type MetricType =
  | 'competition'      // 경쟁 밀도
  | 'traffic'          // 유동인구
  | 'cost'             // 임대료
  | 'survival'         // 생존/폐업률
  | 'timePattern'      // 시간대 패턴
  | 'areaType'         // 상권 유형
  | 'anchor'           // 앵커 시설

export type RiskLevel = 'low' | 'medium' | 'high'

export type ToneLevel = 1 | 2 | 3
// Level 1: 기본 경고 ("~일 수 있음")
// Level 2: 강한 경고 ("~일 수 있음" + 고정비/공백/변동성)
// Level 3: 레드 플래그 ("구조상 ~이 반복될 수 있음")

export interface MetricContext {
  // 경쟁
  sameCategory: number
  totalStores: number
  densityLevel: RiskLevel

  // 유동인구
  trafficLevel: RiskLevel
  trafficIndex: number
  isEstimated: boolean

  // 임대료
  rentLevel: RiskLevel
  avgRent: number
  vsDistrictPercent?: number

  // 생존
  closureRate: number
  openingRate: number
  netChange: number
  survivalRisk: RiskLevel

  // 시간대
  peakTime: 'morning' | 'day' | 'night'
  timePattern: { morning: number; day: number; night: number }
  weekendRatio: number

  // 상권
  areaType: string

  // 앵커
  subwayDistance?: number
  subwayName?: string
  hasNearbyAnchor: boolean

  // 메타
  categoryKey?: BusinessCategory
  categoryName: string
  h3Id?: string
}

export interface InterpretationResult {
  metric: MetricType
  observation: string      // 관측 (지표/수치)
  interpretation: string   // 구조 해석
  riskMechanism: string    // 실패 메커니즘
  combined: string         // 합쳐진 한 문장
  toneLevel: ToneLevel
}

export interface Template {
  id: string
  metric: MetricType
  condition: (ctx: MetricContext) => boolean
  toneLevel: ToneLevel
  observation: string | ((ctx: MetricContext) => string)
  interpretation: string | ((ctx: MetricContext) => string)
  riskMechanism: string | ((ctx: MetricContext) => string)
}
