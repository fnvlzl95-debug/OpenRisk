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
  TrafficLevel,
  CostMetrics,
  SurvivalMetrics,
  AnchorMetrics,
  InterpretationV2,
} from './types'
import {
  generateContextualExplanations,
  generateSummary as generateContextualSummary,
  generateTopFactors as generateContextualTopFactors,
  buildDynamicVars,
  type AllMetrics,
} from './interpretations'

// 정규화 기준값 (서울 평균 기준)
const NORMALIZATION = {
  competition: {
    lowThreshold: 5,     // 5개 이하: 낮음
    highThreshold: 20,   // 20개 이상: 높음
  },
  traffic: {
    // 유동인구 추정치 (지하철+버스 기반, H3 셀당 0~10 범위)
    // 500m 반경 합계 기준: 0~50+ 범위
    lowThreshold: 10,    // 10 이하: 낮음
    highThreshold: 40,   // 40 이상: 높음
  },
  cost: {
    // DB 데이터 범위: 10~68만원/평 (서울 기준)
    lowThreshold: 15,    // 15만원/평 이하: 낮음 (인천/경기 외곽)
    highThreshold: 40,   // 40만원/평 이상: 높음 (강남/명동급)
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
  let totalScore =
    scores.competition * weights.competition +
    scores.cost * weights.cost +
    scores.survival * weights.survival +
    scores.traffic * weights.traffic +
    scores.anchor * weights.anchor

  // 시간대 패턴 보정 (±10점)
  // 업종별 최적 시간대와 실제 피크타임 매칭 여부
  const timePatternAdjustment = calculateTimePatternAdjustment(category, metrics.traffic)
  totalScore += timePatternAdjustment

  return Math.round(Math.min(100, Math.max(0, totalScore)))
}

/**
 * 시간대 패턴 보정 점수 계산
 * 업종별 최적 시간대와 실제 피크타임이 맞으면 리스크 감소, 안 맞으면 증가
 * 반환값: -10 ~ +10 (음수 = 리스크 감소, 양수 = 리스크 증가)
 */
function calculateTimePatternAdjustment(
  category: BusinessCategory,
  traffic: TrafficMetrics
): number {
  // 업종별 최적 시간대 정의
  const optimalPeakTime: Record<string, 'morning' | 'day' | 'night'> = {
    // 점심 장사 업종 (낮이 좋음)
    restaurant_korean: 'day',
    restaurant_chinese: 'day',
    restaurant_fastfood: 'day',
    bakery: 'day',
    pharmacy: 'day',
    laundry: 'day',

    // 저녁/야간 업종 (밤이 좋음)
    restaurant_western: 'night',
    restaurant_japanese: 'night',
    bar: 'night',
    restaurant_chicken: 'night',
    restaurant_pizza: 'night',

    // 출퇴근 업종 (아침이 좋음)
    cafe: 'morning',
    convenience: 'morning',

    // 시간대 무관 (주거 배후 의존)
    beauty: 'day',
    nail: 'day',
    mart: 'day',
    dessert: 'day',
    gym: 'night',
    academy: 'night',
  }

  const optimal = optimalPeakTime[category] || 'day'
  const actual = traffic.peakTime

  // 매칭 여부에 따른 보정
  if (optimal === actual) {
    // 최적 시간대와 일치 → 리스크 감소
    return -5
  }

  // 주말 비중이 너무 높거나 낮으면 추가 보정
  // 술집은 주말 비중 높아야 유리, 점심 업종은 평일 비중 높아야 유리
  const weekendSensitive = ['bar', 'restaurant_western', 'dessert', 'cafe']
  const weekdaySensitive = ['restaurant_korean', 'restaurant_chinese', 'laundry', 'pharmacy']

  if (weekendSensitive.includes(category)) {
    // 주말 비중 높으면 좋음
    if (traffic.weekendRatio < 0.3) {
      return 8 // 주말 비중 너무 낮으면 리스크 증가
    }
    if (traffic.weekendRatio > 0.45) {
      return -3 // 주말 비중 높으면 리스크 감소
    }
  }

  if (weekdaySensitive.includes(category)) {
    // 평일 비중 높으면 좋음
    if (traffic.weekendRatio > 0.5) {
      return 8 // 주말 비중 너무 높으면 리스크 증가
    }
    if (traffic.weekendRatio < 0.3) {
      return -3 // 평일 중심이면 리스크 감소
    }
  }

  // 시간대 불일치 기본 패널티
  return 3
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
  const isHighTraffic = traffic.index > 30  // 유동인구 지수 30 이상 (추정치 기준)
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
 * 유동인구 레벨 판별 (5단계)
 * 추정치 기반 (지하철+버스 데이터, H3 500m 반경 합계)
 */
export function getTrafficLevel(estimated: number): TrafficLevel {
  if (estimated <= 5) return 'very_low'
  if (estimated <= 15) return 'low'
  if (estimated <= 30) return 'medium'
  if (estimated <= 50) return 'high'
  return 'very_high'
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
 * 해석 문구 생성 (v2 확장)
 * 새로운 컨텍스트 조합 시스템 사용
 */
export function generateInterpretation(
  category: BusinessCategory,
  _riskScore: number,  // 현재 사용 안함 (API 호환성 유지)
  _riskLevel: RiskLevel,  // 현재 사용 안함 (API 호환성 유지)
  metrics: {
    competition: CompetitionMetrics
    traffic: TrafficMetrics
    cost: CostMetrics
    survival: SurvivalMetrics
    anchors: AnchorMetrics
  },
  areaType?: AreaType,
  h3Id?: string
): InterpretationV2 {
  const categoryName = getCategoryName(category)
  const currentAreaType = areaType || 'B_혼합'

  // AllMetrics 구조로 변환
  const allMetrics: AllMetrics = {
    competition: metrics.competition,
    traffic: metrics.traffic,
    cost: metrics.cost,
    survival: metrics.survival,
    anchors: metrics.anchors,
    areaType: currentAreaType,
    category,
  }

  // 동적 변수 생성
  const vars = buildDynamicVars(allMetrics, categoryName, h3Id)

  // 새로운 컨텍스트 조합 시스템으로 해석 문장 생성
  const easyExplanations = generateContextualExplanations({
    metrics: allMetrics,
    categoryName,
    categoryKey: category,
    h3Id,
  })

  // 요약문 생성 (컨텍스트 기반)
  const summary = generateContextualSummary(allMetrics, vars)

  // Top Factors 생성 (컨텍스트 기반)
  const topFactors = generateContextualTopFactors(allMetrics, vars)

  // 기존 방식의 risks/opportunities 생성 (상세 목록용)
  const { risks, opportunities } = generateDetailedRisksAndOpportunities(
    categoryName,
    metrics,
    currentAreaType
  )

  // 점수 기여도 계산
  const scoreContribution = calculateScoreContribution(category, metrics)

  return {
    summary,
    risks,
    opportunities,
    easyExplanations,
    topFactors,
    scoreContribution,
  }
}

/**
 * 상세 리스크/기회 목록 생성 (기존 로직 유지)
 */
function generateDetailedRisksAndOpportunities(
  categoryName: string,
  metrics: {
    competition: CompetitionMetrics
    traffic: TrafficMetrics
    cost: CostMetrics
    survival: SurvivalMetrics
    anchors: AnchorMetrics
  },
  areaType: AreaType
): { risks: string[]; opportunities: string[] } {
  const risks: string[] = []
  const opportunities: string[] = []

  // 경쟁 분석
  if (metrics.competition.sameCategory > 15) {
    risks.push(`반경 500m 내 ${categoryName} ${metrics.competition.sameCategory}개 - 경쟁 치열`)
  } else if (metrics.competition.sameCategory <= 3) {
    opportunities.push(`동종 업종 ${metrics.competition.sameCategory}개 - 경쟁 적음`)
  }

  // 유동인구 분석
  if (metrics.traffic.index < 20) {
    risks.push('유동인구 지수 낮음 - 배후 수요 검증 필요')
  } else if (metrics.traffic.index > 60) {
    opportunities.push(`유동인구 지수 ${metrics.traffic.index} - 잠재 고객 풍부`)
  }

  // 임대료 분석
  if (metrics.cost.avgRent > 150) {
    risks.push(`평당 임대료 ${metrics.cost.avgRent}만원 - 비용 부담 큼`)
  } else if (metrics.cost.avgRent < 80) {
    opportunities.push(`평당 임대료 ${metrics.cost.avgRent}만원 - 비용 효율적`)
  }

  // 폐업률 분석
  if (metrics.survival.closureRate > 50) {
    risks.push(`폐업률 ${metrics.survival.closureRate}% - 생존율 낮음`)
  } else if (metrics.survival.closureRate < 30) {
    opportunities.push(`폐업률 ${metrics.survival.closureRate}% - 안정적 상권`)
  }

  // 앵커 분석
  if (metrics.anchors.subway && metrics.anchors.subway.distance <= 200) {
    opportunities.push(`${metrics.anchors.subway.name} ${metrics.anchors.subway.distance}m - 역세권`)
  }
  if (!metrics.anchors.hasAnyAnchor) {
    risks.push('주요 앵커 시설 없음 - 자체 집객력 필요')
  }

  // 야간 유동 분석
  if (metrics.traffic.peakTime === 'night' && metrics.traffic.timePattern.night > 40) {
    opportunities.push('야간 유동인구 강함 - 저녁 영업 유리')
  }

  // 상권 유형별 추가
  if (areaType === 'D_특수') {
    risks.push('특수 상권 - 시즌/이벤트 의존도 높음')
  }

  return { risks, opportunities }
}

/**
1 * 점수 기여도 계산
 */
function calculateScoreContribution(
  category: BusinessCategory,
  metrics: {
    competition: CompetitionMetrics
    traffic: TrafficMetrics
    cost: CostMetrics
    survival: SurvivalMetrics
    anchors: AnchorMetrics
  }
): InterpretationV2['scoreContribution'] {
  const weights = getCategoryWeights(category)

  // 각 지표의 점수 영향 계산
  const competitionScore = normalizeCompetition(metrics.competition.sameCategory)
  const costScore = normalizeCost(metrics.cost.avgRent)
  const survivalScore = normalizeSurvival(metrics.survival.closureRate)
  const trafficScore = normalizeTraffic(metrics.traffic.index)
  const anchorScore = normalizeAnchor(metrics.anchors)

  // 50을 기준으로 positive/negative 판단 (50 이상이면 리스크 증가 = negative)
  const getImpact = (score: number): 'positive' | 'negative' | 'neutral' => {
    if (score < 40) return 'positive'
    if (score > 60) return 'negative'
    return 'neutral'
  }

  // 시간대 패턴은 별도 계산 (주말 비중 높으면 리스크)
  const timePatternScore = metrics.traffic.weekendRatio > 0.5 ? 60 :
                           metrics.traffic.weekendRatio < 0.3 ? 30 : 45
  const timePatternPercent = 10 // 고정 10%

  return {
    competition: {
      percent: Math.round(weights.competition * 100),
      impact: getImpact(competitionScore),
    },
    traffic: {
      percent: Math.round(weights.traffic * 100),
      impact: getImpact(trafficScore),
    },
    cost: {
      percent: Math.round(weights.cost * 100),
      impact: getImpact(costScore),
    },
    survival: {
      percent: Math.round(weights.survival * 100),
      impact: getImpact(survivalScore),
    },
    anchor: {
      percent: Math.round(weights.anchor * 100),
      impact: getImpact(anchorScore),
    },
    timePattern: {
      percent: timePatternPercent,
      impact: getImpact(timePatternScore),
    },
  }
}
