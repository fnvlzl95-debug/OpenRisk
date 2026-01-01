/**
 * OpenRisk v2.0 리스크 점수 계산 엔진
 * 업종별 가중치를 적용한 종합 리스크 스코어 산출
 */

import { BusinessCategory, getCategoryWeights, getCategoryName } from '../categories'
import {
  RiskLevel,
  AreaType,
  CompetitionMetrics,
  TrafficMetrics,
  CostMetrics,
  SurvivalMetrics,
  AnchorMetrics,
} from './types'

// 정규화 기준값 (서울 평균 기준)
const NORMALIZATION = {
  competition: {
    lowThreshold: 5,     // 5개 이하: 낮음
    highThreshold: 20,   // 20개 이상: 높음
  },
  traffic: {
    lowThreshold: 5000,  // 5천 이하: 낮음
    highThreshold: 30000, // 3만 이상: 높음
  },
  cost: {
    lowThreshold: 80,    // 80만원/평 이하: 낮음
    highThreshold: 200,  // 200만원/평 이상: 높음
  },
  survival: {
    lowThreshold: 5,     // 5% 이하: 낮음
    highThreshold: 15,   // 15% 이상: 높음
  },
}

/**
 * 종합 리스크 점수 계산 (0~100)
 */
export function calculateRiskScore(
  category: BusinessCategory,
  metrics: {
    competition: CompetitionMetrics
    traffic: TrafficMetrics
    cost: CostMetrics
    survival: SurvivalMetrics
    anchors: AnchorMetrics
  }
): number {
  const weights = getCategoryWeights(category)

  // 각 지표를 0~100 스케일로 정규화 (높을수록 위험)
  const scores = {
    competition: normalizeCompetition(metrics.competition.sameCategory),
    cost: normalizeCost(metrics.cost.avgRent),
    survival: normalizeSurvival(metrics.survival.closureRate),
    traffic: normalizeTraffic(metrics.traffic.index),
    anchor: normalizeAnchor(metrics.anchors),
  }

  // 가중 합산
  const totalScore =
    scores.competition * weights.competition +
    scores.cost * weights.cost +
    scores.survival * weights.survival +
    scores.traffic * weights.traffic +
    scores.anchor * weights.anchor

  return Math.round(Math.min(100, Math.max(0, totalScore)))
}

/**
 * 경쟁 밀도 정규화 (동종 업종 수 기준)
 */
function normalizeCompetition(sameCategoryCount: number): number {
  const { lowThreshold, highThreshold } = NORMALIZATION.competition

  if (sameCategoryCount <= lowThreshold) {
    return (sameCategoryCount / lowThreshold) * 30  // 0~30점
  }
  if (sameCategoryCount >= highThreshold) {
    return 100
  }
  // lowThreshold ~ highThreshold: 30~100점
  return 30 + ((sameCategoryCount - lowThreshold) / (highThreshold - lowThreshold)) * 70
}

/**
 * 임대료 정규화 (만원/평 기준)
 */
function normalizeCost(avgRent: number): number {
  const { lowThreshold, highThreshold } = NORMALIZATION.cost

  if (avgRent <= lowThreshold) {
    return (avgRent / lowThreshold) * 30
  }
  if (avgRent >= highThreshold) {
    return 100
  }
  return 30 + ((avgRent - lowThreshold) / (highThreshold - lowThreshold)) * 70
}

/**
 * 폐업률 정규화 (% 기준)
 */
function normalizeSurvival(closureRate: number): number {
  const { lowThreshold, highThreshold } = NORMALIZATION.survival

  if (closureRate <= lowThreshold) {
    return (closureRate / lowThreshold) * 30
  }
  if (closureRate >= highThreshold) {
    return 100
  }
  return 30 + ((closureRate - lowThreshold) / (highThreshold - lowThreshold)) * 70
}

/**
 * 유동인구 정규화 (낮을수록 위험)
 */
function normalizeTraffic(estimated: number): number {
  const { lowThreshold, highThreshold } = NORMALIZATION.traffic

  if (estimated >= highThreshold) {
    return 0  // 유동인구 많으면 리스크 낮음
  }
  if (estimated <= lowThreshold) {
    return 100  // 유동인구 적으면 리스크 높음
  }
  // 역방향: 유동인구 많을수록 점수 낮음
  return 100 - ((estimated - lowThreshold) / (highThreshold - lowThreshold)) * 100
}

/**
 * 앵커 시설 정규화 (없을수록 위험)
 */
function normalizeAnchor(anchors: AnchorMetrics): number {
  if (!anchors.hasAnyAnchor) {
    return 80  // 앵커 없음 = 높은 리스크
  }

  let score = 0

  // 지하철 거리에 따른 점수 (가장 중요)
  if (anchors.subway) {
    if (anchors.subway.distance <= 100) score += 0
    else if (anchors.subway.distance <= 300) score += 10
    else if (anchors.subway.distance <= 500) score += 20
    else score += 40
  } else {
    score += 40
  }

  // 스타벅스: 상권 활성화 지표 (가까울수록 + 많을수록 좋음)
  if (anchors.starbucks) {
    if (anchors.starbucks.count >= 3) score += 0  // 스타벅스 3개 이상: 핵심 상권
    else if (anchors.starbucks.count >= 1) score += 5  // 스타벅스 있음
    else score += 10
  } else {
    score += 15  // 스타벅스 없음
  }

  // 대형마트: 생활권 지표
  if (!anchors.mart) score += 10

  // 백화점: 프리미엄 상권 지표
  if (!anchors.department) score += 5

  return Math.min(80, score)
}

/**
 * 리스크 레벨 분류
 */
export function getRiskLevel(score: number): RiskLevel {
  if (score < 30) return 'LOW'
  if (score < 50) return 'MEDIUM'
  if (score < 70) return 'HIGH'
  return 'VERY_HIGH'
}

/**
 * 상권 성격 분류 (점포 분포 기반)
 *
 * A_주거: 주거 밀집 지역 (점포 밀도 낮음, 생활서비스 위주)
 * B_혼합: 직주 혼합 지역 (주거+상업 균형)
 * C_상업: 상업 중심 지역 (음식점/카페 집중, 유동인구 높음)
 * D_특수: 특수 상권 (주말/관광 특화, 대학가, 역세권 핫플)
 */
export function determineAreaType(
  metrics: {
    competition: CompetitionMetrics
    traffic: TrafficMetrics
    anchors: AnchorMetrics
  },
  storeCounts: Record<string, number>
): AreaType {
  const { traffic, competition, anchors } = metrics
  const totalStores = competition.total || 1

  // 1. 업종별 비율 계산
  // 상업형 점포: 음식점, 카페, 술집
  const commercialCount =
    (storeCounts.restaurant_korean || 0) +
    (storeCounts.restaurant_western || 0) +
    (storeCounts.restaurant_japanese || 0) +
    (storeCounts.restaurant_chinese || 0) +
    (storeCounts.restaurant_chicken || 0) +
    (storeCounts.restaurant_pizza || 0) +
    (storeCounts.restaurant_fastfood || 0) +
    (storeCounts.cafe || 0) +
    (storeCounts.bakery || 0) +
    (storeCounts.dessert || 0) +
    (storeCounts.bar || 0)

  // 주거형 점포: 편의점, 세탁소, 약국, 슈퍼
  const residentialCount =
    (storeCounts.convenience || 0) +
    (storeCounts.laundry || 0) +
    (storeCounts.pharmacy || 0) +
    (storeCounts.mart || 0) +
    (storeCounts.beauty || 0)

  const commercialRatio = commercialCount / totalStores
  const residentialRatio = residentialCount / totalStores

  // 2. 특수 상권 판별 (우선 체크)
  // 주말 비율 높음 (유흥가, 관광지) 또는 역세권+상업밀집
  if (traffic.weekendRatio > 0.5) {
    return 'D_특수'
  }

  // 지하철역 근접 + 카페/음식점 밀집 = 역세권 핫플
  if (anchors.subway && anchors.subway.distance < 300 && commercialRatio > 0.7) {
    return 'D_특수'
  }

  // 3. 상업 지역 판별
  // 유동인구 높음 + 상업 점포 비율 60% 이상
  const isHighTraffic = traffic.index > 50  // 유동인구 지수 50 이상
  if (isHighTraffic && commercialRatio > 0.6) {
    return 'C_상업'
  }

  // 4. 주거 지역 판별
  // 점포 밀도 낮음 또는 주거형 점포 비율 높음
  if (totalStores < 20 || residentialRatio > 0.4) {
    return 'A_주거'
  }

  // 5. 나머지는 혼합형
  return 'B_혼합'
}

/**
 * 경쟁 밀도 레벨 판별
 */
export function getCompetitionLevel(sameCategoryCount: number): 'low' | 'medium' | 'high' {
  if (sameCategoryCount <= 5) return 'low'
  if (sameCategoryCount <= 15) return 'medium'
  return 'high'
}

/**
 * 유동인구 레벨 판별
 */
export function getTrafficLevel(estimated: number): 'low' | 'medium' | 'high' {
  if (estimated <= 5000) return 'low'
  if (estimated <= 20000) return 'medium'
  return 'high'
}

/**
 * 임대료 레벨 판별
 */
export function getCostLevel(avgRent: number): 'low' | 'medium' | 'high' {
  if (avgRent <= 80) return 'low'
  if (avgRent <= 150) return 'medium'
  return 'high'
}

/**
 * 폐업 리스크 레벨 판별
 */
export function getSurvivalRisk(closureRate: number): 'low' | 'medium' | 'high' {
  if (closureRate <= 5) return 'low'
  if (closureRate <= 10) return 'medium'
  return 'high'
}

/**
 * 피크 시간대 판별
 */
export function getPeakTime(
  morning: number,
  day: number,
  night: number
): 'morning' | 'day' | 'night' {
  const max = Math.max(morning, day, night)
  if (morning === max) return 'morning'
  if (day === max) return 'day'
  return 'night'
}

/**
 * 해석 문구 생성
 */
export function generateInterpretation(
  category: BusinessCategory,
  riskScore: number,
  riskLevel: RiskLevel,
  metrics: {
    competition: CompetitionMetrics
    traffic: TrafficMetrics
    cost: CostMetrics
    survival: SurvivalMetrics
    anchors: AnchorMetrics
  }
): { summary: string; risks: string[]; opportunities: string[] } {
  const categoryName = getCategoryName(category)
  const risks: string[] = []
  const opportunities: string[] = []

  // 경쟁 분석
  if (metrics.competition.sameCategory > 15) {
    risks.push(`반경 500m 내 ${categoryName} ${metrics.competition.sameCategory}개 - 경쟁 치열`)
  } else if (metrics.competition.sameCategory <= 3) {
    opportunities.push(`동종 업종 ${metrics.competition.sameCategory}개 - 경쟁 적음`)
  }

  // 유동인구 분석
  if (metrics.traffic.index < 5000) {
    risks.push('유동인구 5천 미만 - 배후 수요 검증 필요')
  } else if (metrics.traffic.index > 30000) {
    opportunities.push(`유동인구 ${(metrics.traffic.index / 10000).toFixed(1)}만 - 잠재 고객 풍부`)
  }

  // 임대료 분석
  if (metrics.cost.avgRent > 150) {
    risks.push(`평당 임대료 ${metrics.cost.avgRent}만원 - 비용 부담 큼`)
  } else if (metrics.cost.avgRent < 80) {
    opportunities.push(`평당 임대료 ${metrics.cost.avgRent}만원 - 비용 효율적`)
  }

  // 폐업률 분석
  if (metrics.survival.closureRate > 10) {
    risks.push(`연간 폐업률 ${metrics.survival.closureRate}% - 생존율 낮음`)
  }

  // 앵커 분석
  if (metrics.anchors.subway && metrics.anchors.subway.distance <= 200) {
    opportunities.push(`${metrics.anchors.subway.name} ${metrics.anchors.subway.distance}m - 역세권`)
  }
  if (!metrics.anchors.subway) {
    risks.push('지하철역 없음 - 접근성 열위')
  }

  // 요약문
  let summary = ''
  if (riskLevel === 'LOW') {
    summary = `이 위치는 ${categoryName} 창업에 유리한 조건을 갖추고 있습니다.`
  } else if (riskLevel === 'MEDIUM') {
    summary = `${categoryName} 창업 시 몇 가지 확인이 필요한 지역입니다.`
  } else if (riskLevel === 'HIGH') {
    summary = `${categoryName} 창업 리스크가 높은 지역입니다. 신중한 검토를 권장합니다.`
  } else {
    summary = `${categoryName} 창업이 권장되지 않는 지역입니다.`
  }

  return { summary, risks, opportunities }
}
