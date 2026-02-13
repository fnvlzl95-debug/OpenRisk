/**
 * 리스크 카드 시스템
 *
 * 구조: 레드플래그 → 경고 → 근거 뱃지 → 현장 확인 질문
 *
 * 기존 "→" 문장 스타일에서 카드 UI로 전환
 * Top 3 위험 요소만 우선순위로 표시
 */

import type { BusinessCategory } from '../../categories'
import type { MetricContext } from './types'

// ===== 타입 정의 =====

export type RiskSeverity = 'critical' | 'warning' | 'caution'

export interface EvidenceBadge {
  label: string        // "경쟁 12개", "유동 낮음"
  type: 'metric' | 'data' | 'trend'
}

export interface RiskCard {
  id: string
  flag: string              // 레드플래그 타이틀 (7~12자)
  warning: string           // 경고 한 줄 (30자 이내)
  evidenceBadges: EvidenceBadge[]  // 근거 뱃지 (최대 3개)
  fieldQuestion: string     // 현장 확인 질문
  severity: RiskSeverity
  priority: number          // 우선순위 (낮을수록 중요)
}

export interface RiskCardTemplate {
  id: string
  condition: (ctx: MetricContext) => boolean
  severity: RiskSeverity
  priority: number
  flag: string | ((ctx: MetricContext) => string)
  warning: string | ((ctx: MetricContext) => string)
  badges: ((ctx: MetricContext) => EvidenceBadge[])
  question: string | ((ctx: MetricContext) => string)
}

// ===== 헬퍼 함수 =====

function resolveTemplate(
  value: string | ((ctx: MetricContext) => string),
  ctx: MetricContext
): string {
  return typeof value === 'function' ? value(ctx) : value
}

const COMPETITION_MULTIPLIER_BY_CATEGORY: Record<BusinessCategory, number> = {
  restaurant_korean: 1.2,
  restaurant_western: 1.6,
  restaurant_japanese: 1.5,
  restaurant_chinese: 1.2,
  restaurant_chicken: 1.3,
  restaurant_pizza: 1.3,
  restaurant_fastfood: 1.4,
  cafe: 2.2,
  bakery: 1.6,
  dessert: 1.8,
  bar: 1.4,
  convenience: 1.1,
  mart: 1.0,
  beauty: 0.9,
  nail: 0.8,
  laundry: 0.6,
  pharmacy: 0.5,
  gym: 0.9,
  academy: 0.8,
}

const CATEGORY_KEY_BY_NAME: Record<string, BusinessCategory> = {
  한식: 'restaurant_korean',
  양식: 'restaurant_western',
  일식: 'restaurant_japanese',
  중식: 'restaurant_chinese',
  치킨: 'restaurant_chicken',
  피자: 'restaurant_pizza',
  패스트푸드: 'restaurant_fastfood',
  카페: 'cafe',
  베이커리: 'bakery',
  디저트: 'dessert',
  '술집/바': 'bar',
  편의점: 'convenience',
  슈퍼마켓: 'mart',
  미용실: 'beauty',
  네일샵: 'nail',
  세탁소: 'laundry',
  약국: 'pharmacy',
  헬스장: 'gym',
  학원: 'academy',
}

function resolveCategoryKey(ctx: MetricContext): BusinessCategory | null {
  if (ctx.categoryKey) {
    return ctx.categoryKey
  }

  if (ctx.categoryName && ctx.categoryName in CATEGORY_KEY_BY_NAME) {
    return CATEGORY_KEY_BY_NAME[ctx.categoryName]
  }

  return null
}

function getCompetitionThreshold(base: number, ctx: MetricContext): number {
  const categoryKey = resolveCategoryKey(ctx)
  const multiplier = categoryKey
    ? COMPETITION_MULTIPLIER_BY_CATEGORY[categoryKey]
    : 1

  return Math.max(1, Math.round(base * multiplier))
}

// ===== 경쟁 관련 카드 =====

const competitionCards: RiskCardTemplate[] = [
  // 경쟁 높음 + 유동 낮음 (최악)
  {
    id: 'comp_high_traffic_low',
    condition: (ctx) =>
      ctx.sameCategory >= getCompetitionThreshold(10, ctx) &&
      ctx.trafficLevel === 'low',
    severity: 'critical',
    priority: 1,
    flag: '파이 쪼개기 구조',
    warning: '동종 업종 과밀, 유입 부족으로 생존 경쟁 치열',
    badges: (ctx) => [
      { label: '경쟁 과밀', type: 'metric' },
      { label: '유동 낮음', type: 'metric' },
    ],
    question: '현장 확인: 왜 이렇게 많이 열었는데 손님이 없는지',
  },
  // 경쟁 높음 + 유동 높음
  {
    id: 'comp_high_traffic_high',
    condition: (ctx) =>
      ctx.sameCategory >= getCompetitionThreshold(10, ctx) &&
      ctx.trafficLevel === 'high',
    severity: 'warning',
    priority: 3,
    flag: '체력전 구조',
    warning: '동종 업종 포화, 차별화 없으면 도태 위험',
    badges: (ctx) => [
      { label: '경쟁 과밀', type: 'metric' },
      { label: '유동 높음', type: 'metric' },
    ],
    question: '현장 확인: 기존 가게에서 손님을 뺏어올 차별점이 있는지',
  },
  // 경쟁 0개 (수요 검증 안 됨)
  {
    id: 'comp_zero',
    condition: (ctx) => ctx.sameCategory === 0,
    severity: 'warning',
    priority: 4,
    flag: '수요 검증 안 됨',
    warning: '동종 업종 전무, 수요 자체가 없을 가능성',
    badges: (ctx) => [
      { label: '동종 없음', type: 'metric' },
    ],
    question: '현장 확인: 왜 아무도 이 업종을 안 했는지',
  },
  // 경쟁 높음 일반
  {
    id: 'comp_high',
    condition: (ctx) => ctx.sameCategory >= getCompetitionThreshold(8, ctx),
    severity: 'warning',
    priority: 5,
    flag: '포화 진입',
    warning: '이미 포화된 시장, 신규 진입 불리',
    badges: (ctx) => [
      { label: '경쟁 과밀', type: 'metric' },
    ],
    question: '현장 확인: 잘 되는 곳과 안 되는 곳의 차이가 뭔지',
  },
]

// ===== 임대료 관련 카드 =====

const costCards: RiskCardTemplate[] = [
  // 임대료 높음 + 경쟁 높음
  {
    id: 'cost_high_comp_high',
    condition: (ctx) =>
      ctx.rentLevel === 'high' &&
      ctx.sameCategory >= getCompetitionThreshold(8, ctx),
    severity: 'critical',
    priority: 2,
    flag: '이중 압박 구조',
    warning: '임대료 부담 + 경쟁 과밀, 수익 구조 불리',
    badges: (ctx) => [
      { label: '임대료 높음', type: 'metric' },
      { label: '경쟁 과밀', type: 'metric' },
    ],
    question: '현장 확인: 하루 얼마를 벌어야 본전인지 직접 계산',
  },
  // 임대료 높음
  {
    id: 'cost_high',
    condition: (ctx) => ctx.rentLevel === 'high',
    severity: 'warning',
    priority: 6,
    flag: '고정비 부담',
    warning: '임대료 수준 높음, 손익분기점 도달 부담',
    badges: (ctx) => [
      { label: '임대료 높음', type: 'metric' },
    ],
    question: '현장 확인: 비수기에도 감당 가능한 임대료인지',
  },
  // 임대료 낮음 + 유동 낮음 (함정)
  {
    id: 'cost_low_trap',
    condition: (ctx) => ctx.rentLevel === 'low' && ctx.trafficLevel === 'low',
    severity: 'caution',
    priority: 8,
    flag: '싼 이유 있음',
    warning: '임대료가 낮은 건 수요가 없어서일 수 있음',
    badges: (ctx) => [
      { label: '임대료 낮음', type: 'metric' },
      { label: '유동 낮음', type: 'metric' },
    ],
    question: '현장 확인: 왜 이 자리가 이렇게 싼지, 이전 세입자는 뭘 했는지',
  },
]

// ===== 생존율 관련 카드 =====

const survivalCards: RiskCardTemplate[] = [
  // 폐업률 높음 + 순감소
  {
    id: 'survival_critical',
    condition: (ctx) => ctx.survivalRisk === 'high' && ctx.netChange < 0,
    severity: 'critical',
    priority: 1,
    flag: '상권 축소 중',
    warning: '폐업률 높음, 점포 수 감소 추세',
    badges: (ctx) => [
      { label: '폐업률 높음', type: 'metric' },
      { label: '순감소', type: 'trend' },
    ],
    question: '현장 확인: 최근 1년간 몇 개가 문 닫았고 왜 닫았는지',
  },
  // 폐업률 높음
  {
    id: 'survival_high',
    condition: (ctx) => ctx.survivalRisk === 'high',
    severity: 'warning',
    priority: 4,
    flag: '생존율 낮음',
    warning: '이 지역 폐업률 평균 이상, 생존 경쟁 치열',
    badges: (ctx) => [
      { label: '폐업률 높음', type: 'metric' },
    ],
    question: '현장 확인: 오래 버틴 가게는 뭐가 다른지',
  },
]

// ===== 유동인구 관련 카드 =====

const trafficCards: RiskCardTemplate[] = [
  // 유동 낮음 + 앵커 없음
  {
    id: 'traffic_low_no_anchor',
    condition: (ctx) => ctx.trafficLevel === 'low' && !ctx.hasNearbyAnchor,
    severity: 'critical',
    priority: 2,
    flag: '유입 동선 없음',
    warning: '유동도 적고 역/마트 등 앵커 시설도 없음',
    badges: (ctx) => [
      { label: '유동 낮음', type: 'metric' },
      { label: '앵커 없음', type: 'metric' },
    ],
    question: '현장 확인: 손님이 일부러 찾아올 이유가 있는지',
  },
  // 유동 낮음
  {
    id: 'traffic_low',
    condition: (ctx) => ctx.trafficLevel === 'low',
    severity: 'warning',
    priority: 5,
    flag: '유입 부족',
    warning: '지나다니는 사람이 적어 워킹 유입 기대 어려움',
    badges: (ctx) => [
      { label: '유동 낮음', type: 'metric' },
    ],
    question: '현장 확인: 배달 없이 홀 매출만으로 버틸 수 있는지',
  },
  // 시간대 편중 (저녁)
  {
    id: 'traffic_night_heavy',
    condition: (ctx) => ctx.timePattern.night >= 45,
    severity: 'caution',
    priority: 7,
    flag: '저녁 편중',
    warning: '저녁 시간대 유동 집중, 낮 시간대 공백 발생',
    badges: (ctx) => [
      { label: '저녁 집중', type: 'metric' },
      { label: '낮 공백', type: 'metric' },
    ],
    question: '현장 확인: 낮 시간대 매출 공백을 어떻게 채울지',
  },
]

// ===== 앵커 관련 카드 =====

const anchorCards: RiskCardTemplate[] = [
  // 역 멀음
  {
    id: 'anchor_subway_far',
    condition: (ctx) => ctx.subwayDistance !== undefined && ctx.subwayDistance > 500,
    severity: 'warning',
    priority: 6,
    flag: '역세권 아님',
    warning: '역에서 멀어 유입 기대 어려움',
    badges: (ctx) => [
      { label: '역 멀음', type: 'metric' },
    ],
    question: '현장 확인: 역에서 여기까지 걸어올 만한 매력이 있는지',
  },
  // 앵커 없음
  {
    id: 'anchor_none',
    condition: (ctx) => !ctx.hasNearbyAnchor,
    severity: 'caution',
    priority: 8,
    flag: '집객 시설 없음',
    warning: '역, 대형마트 등 유입 시설이 주변에 없음',
    badges: (ctx) => [
      { label: '앵커 없음', type: 'metric' },
    ],
    question: '현장 확인: 자체 집객력(브랜드/마케팅)을 어떻게 만들지',
  },
]

// ===== 상권 유형 카드 =====

const areaTypeCards: RiskCardTemplate[] = [
  // 특수 상권 (주말/시즌 의존)
  {
    id: 'area_special',
    condition: (ctx) => ctx.areaType === 'D_특수',
    severity: 'warning',
    priority: 7,
    flag: '시즌 의존 상권',
    warning: '주말/시즌 집중 상권, 평일 매출 공백 발생',
    badges: (ctx) => [
      { label: '주말 집중', type: 'metric' },
      { label: '특수상권', type: 'data' },
    ],
    question: '현장 확인: 비수기 3개월을 버틸 현금이 있는지',
  },
]

// ===== 조합 카드 (최악 시나리오) =====

const combinationCards: RiskCardTemplate[] = [
  // 최악: 경쟁 높음 + 임대료 높음 + 유동 낮음
  {
    id: 'worst_triple',
    condition: (ctx) =>
      ctx.sameCategory >= getCompetitionThreshold(8, ctx) &&
      ctx.rentLevel === 'high' &&
      ctx.trafficLevel === 'low',
    severity: 'critical',
    priority: 0,  // 최고 우선순위
    flag: '3중 리스크',
    warning: '경쟁↑ 임대료↑ 유동↓, 손익 구조 성립 어려움',
    badges: (ctx) => [
      { label: '경쟁 과밀', type: 'metric' },
      { label: '임대료 높음', type: 'metric' },
      { label: '유동 낮음', type: 'metric' },
    ],
    question: '현장 확인: 다른 입지와 비교했을 때 여기여야 하는 이유가 있는지',
  },
]

// ===== 전체 카드 템플릿 =====

export const allCardTemplates: RiskCardTemplate[] = [
  ...combinationCards,
  ...competitionCards,
  ...costCards,
  ...survivalCards,
  ...trafficCards,
  ...anchorCards,
  ...areaTypeCards,
]

// ===== 카드 생성 함수 =====

/**
 * 조건에 맞는 리스크 카드 생성
 */
export function generateRiskCards(ctx: MetricContext): RiskCard[] {
  const cards: RiskCard[] = []

  for (const template of allCardTemplates) {
    if (template.condition(ctx)) {
      cards.push({
        id: template.id,
        flag: resolveTemplate(template.flag, ctx),
        warning: resolveTemplate(template.warning, ctx),
        evidenceBadges: template.badges(ctx),
        fieldQuestion: resolveTemplate(template.question, ctx),
        severity: template.severity,
        priority: template.priority,
      })
    }
  }

  // 우선순위 정렬 (낮은 숫자가 먼저)
  cards.sort((a, b) => a.priority - b.priority)

  return cards
}

/**
 * Top N 리스크 카드 반환
 */
export function getTopRiskCards(ctx: MetricContext, count: number = 3): RiskCard[] {
  const allCards = generateRiskCards(ctx)

  // 중복 제거 (같은 severity 내에서 유사한 카드 제거)
  const seen = new Set<string>()
  const unique: RiskCard[] = []

  for (const card of allCards) {
    // flag 기준 중복 제거
    if (!seen.has(card.flag)) {
      seen.add(card.flag)
      unique.push(card)
    }
  }

  return unique.slice(0, count)
}

/**
 * 카드 severity별 카운트
 */
export function getRiskCardStats(cards: RiskCard[]): {
  critical: number
  warning: number
  caution: number
  total: number
} {
  return {
    critical: cards.filter(c => c.severity === 'critical').length,
    warning: cards.filter(c => c.severity === 'warning').length,
    caution: cards.filter(c => c.severity === 'caution').length,
    total: cards.length,
  }
}
