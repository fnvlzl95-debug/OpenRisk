/**
 * OpenRisk v2.0 - 폐업 위험도 계산 시스템
 *
 * 실제 폐업률 데이터가 없는 경우 상권 특성을 기반으로 추정
 * - 경쟁 밀도: 높을수록 위험
 * - 임대료: 높을수록 위험
 * - 유동인구: 낮을수록 위험
 * - 상권 유형별 기본 위험도 적용
 *
 * 향후 시계열 데이터 확보 시 실제 폐업률로 대체 예정
 */

import type { BusinessCategory } from '../categories'
import type { SurvivalMetrics, TrafficLevel, AreaType } from './types'

// ===== 상수 =====

// 업종별 기본 생존율 (1년 기준, 통계청 데이터 기반)
// 출처: 소상공인시장진흥공단 창업/폐업 통계 (2023)
const CATEGORY_SURVIVAL_RATES: Record<BusinessCategory, number> = {
  // 음식점 (평균 생존율 낮음)
  restaurant_korean: 55,    // 한식: 55%
  restaurant_western: 52,   // 양식: 52%
  restaurant_japanese: 58,  // 일식: 58%
  restaurant_chinese: 60,   // 중식: 60%
  restaurant_chicken: 48,   // 치킨: 48% (경쟁 치열)
  restaurant_pizza: 50,     // 피자: 50%
  restaurant_fastfood: 62,  // 패스트푸드: 62% (프랜차이즈 지원)

  // 카페/베이커리 (포화 시장)
  cafe: 45,                 // 카페: 45% (매우 경쟁 치열)
  bakery: 55,               // 베이커리: 55%
  dessert: 50,              // 디저트: 50%

  // 주점
  bar: 52,                  // 술집/바: 52%

  // 소매 (상대적 안정)
  convenience: 72,          // 편의점: 72% (본사 지원)
  mart: 65,                 // 슈퍼마켓: 65%

  // 서비스 (지역 밀착형)
  beauty: 60,               // 미용실: 60%
  nail: 55,                 // 네일샵: 55%
  laundry: 70,              // 세탁소: 70% (안정적)
  pharmacy: 85,             // 약국: 85% (규제 보호)

  // 기타
  gym: 55,                  // 헬스장: 55%
  academy: 62,              // 학원: 62%
}

// 상권 유형별 위험 가중치
const AREA_TYPE_RISK_MULTIPLIER: Record<AreaType, number> = {
  'A_주거': 0.9,    // 안정적인 주거 수요
  'B_혼합': 1.0,    // 기준
  'C_상업': 1.2,    // 높은 경쟁, 높은 비용
  'D_특수': 1.3,    // 시즌 의존, 불안정
}

// 유동인구 수준별 위험 조정
const TRAFFIC_RISK_ADJUSTMENT: Record<TrafficLevel, number> = {
  very_high: -10,  // 유동인구 많으면 위험 감소
  high: -5,
  medium: 0,
  low: 5,
  very_low: 10,    // 유동인구 적으면 위험 증가
}

// 임대료 수준별 위험 조정
const RENT_RISK_ADJUSTMENT: Record<'low' | 'medium' | 'high', number> = {
  low: -5,         // 임대료 낮으면 부담 적음
  medium: 0,
  high: 10,        // 임대료 높으면 압박 심함
}

// ===== 주요 함수 =====

interface ClosureRiskInput {
  category: BusinessCategory
  competitionDensity: number  // 0~1 (경쟁 밀도)
  trafficLevel: TrafficLevel
  rentLevel: 'low' | 'medium' | 'high'
  areaType: AreaType
  // 실제 데이터 (있으면 사용)
  actualClosureCount?: number
  actualPrevCount?: number
}

/**
 * 폐업 위험도 계산
 *
 * @returns SurvivalMetrics (폐업률, 개업률, 순증감, 위험 등급)
 */
export function calculateClosureRisk(input: ClosureRiskInput): SurvivalMetrics {
  const {
    category,
    competitionDensity,
    trafficLevel,
    rentLevel,
    areaType,
    actualClosureCount,
    actualPrevCount,
  } = input

  // 1. 실제 폐업 데이터가 있으면 사용
  if (actualClosureCount !== undefined && actualPrevCount && actualPrevCount > 0) {
    const actualClosureRate = (actualClosureCount / actualPrevCount) * 100
    return {
      closureRate: Math.round(actualClosureRate * 10) / 10,
      openingRate: 0,  // 데이터 없음
      netChange: -actualClosureCount,
      risk: getClosureRiskLevel(actualClosureRate),
    }
  }

  // 2. 추정 폐업률 계산

  // 2-1. 업종별 기본 폐업률 (100 - 생존율)
  const baseSurvivalRate = CATEGORY_SURVIVAL_RATES[category] || 55
  let baseClosureRate = 100 - baseSurvivalRate

  // 2-2. 경쟁 밀도 조정 (밀도 0.5 이상이면 위험 증가)
  const competitionAdjustment = competitionDensity > 0.5
    ? (competitionDensity - 0.5) * 40  // 최대 +20%
    : competitionDensity < 0.2
      ? -5  // 경쟁 적으면 약간 감소
      : 0

  // 2-3. 유동인구 조정
  const trafficAdjustment = TRAFFIC_RISK_ADJUSTMENT[trafficLevel] || 0

  // 2-4. 임대료 조정
  const rentAdjustment = RENT_RISK_ADJUSTMENT[rentLevel] || 0

  // 2-5. 상권 유형 가중치
  const areaMultiplier = AREA_TYPE_RISK_MULTIPLIER[areaType] || 1.0

  // 3. 최종 폐업률 계산
  let estimatedClosureRate = baseClosureRate + competitionAdjustment + trafficAdjustment + rentAdjustment
  estimatedClosureRate = estimatedClosureRate * areaMultiplier

  // 범위 제한 (5% ~ 80%)
  estimatedClosureRate = Math.max(5, Math.min(80, estimatedClosureRate))
  estimatedClosureRate = Math.round(estimatedClosureRate * 10) / 10

  // 4. 개업률 추정 (업종별 평균 기반)
  const estimatedOpeningRate = estimateOpeningRate(category, areaType)

  // 5. 순증감 추정
  const netChange = estimatedOpeningRate - estimatedClosureRate

  return {
    closureRate: estimatedClosureRate,
    openingRate: estimatedOpeningRate,
    netChange: Math.round(netChange * 10) / 10,
    risk: getClosureRiskLevel(estimatedClosureRate),
  }
}

/**
 * 폐업률에 따른 위험 등급 분류
 */
export function getClosureRiskLevel(closureRate: number): 'low' | 'medium' | 'high' {
  if (closureRate < 30) return 'low'      // 30% 미만: 안전
  if (closureRate < 50) return 'medium'   // 30~50%: 보통
  return 'high'                           // 50% 이상: 위험
}

/**
 * 개업률 추정 (업종별 트렌드 기반)
 */
function estimateOpeningRate(category: BusinessCategory, areaType: AreaType): number {
  // 업종별 개업 트렌드 (2023-2024 기준)
  const openingTrends: Partial<Record<BusinessCategory, number>> = {
    cafe: 35,           // 카페: 여전히 높은 개업률
    dessert: 38,        // 디저트: 트렌디, 높은 개업률
    restaurant_korean: 25,
    restaurant_western: 28,
    restaurant_chicken: 30,
    convenience: 15,    // 편의점: 포화
    beauty: 22,
    gym: 28,
  }

  const baseTrend = openingTrends[category] || 25

  // 상권 유형별 조정
  const areaAdjustment: Record<AreaType, number> = {
    'A_주거': -5,   // 주거지 개업 적음
    'B_혼합': 0,
    'C_상업': 10,   // 상업지 개업 활발
    'D_특수': 5,
  }

  return baseTrend + (areaAdjustment[areaType] || 0)
}

/**
 * 폐업 위험 상세 설명 생성
 */
export function getClosureRiskDescription(
  metrics: SurvivalMetrics,
  category: BusinessCategory
): string {
  const categoryName = getCategoryName(category)
  const riskDesc = {
    low: '안정적인',
    medium: '평균 수준의',
    high: '높은',
  }[metrics.risk]

  const netChangeDesc = metrics.netChange > 0
    ? `순증가 추세 (+${metrics.netChange}%)`
    : metrics.netChange < -5
      ? `순감소 추세 (${metrics.netChange}%)`
      : '보합세'

  return `${categoryName} 업종 기준 ${riskDesc} 폐업 위험 (추정 폐업률 ${metrics.closureRate}%, ${netChangeDesc})`
}

/**
 * 업종명 조회
 */
function getCategoryName(category: BusinessCategory): string {
  const names: Record<BusinessCategory, string> = {
    restaurant_korean: '한식',
    restaurant_western: '양식',
    restaurant_japanese: '일식',
    restaurant_chinese: '중식',
    restaurant_chicken: '치킨',
    restaurant_pizza: '피자',
    restaurant_fastfood: '패스트푸드',
    cafe: '카페',
    bakery: '베이커리',
    dessert: '디저트',
    bar: '술집/바',
    convenience: '편의점',
    mart: '슈퍼마켓',
    beauty: '미용실',
    nail: '네일샵',
    laundry: '세탁소',
    pharmacy: '약국',
    gym: '헬스장',
    academy: '학원',
  }
  return names[category] || category
}

/**
 * 폐업 위험 요인 분석
 */
export function analyzeClosureRiskFactors(
  input: ClosureRiskInput
): { factor: string; impact: 'positive' | 'negative' | 'neutral'; description: string }[] {
  const factors: { factor: string; impact: 'positive' | 'negative' | 'neutral'; description: string }[] = []

  // 경쟁 밀도
  if (input.competitionDensity > 0.6) {
    factors.push({
      factor: '높은 경쟁',
      impact: 'negative',
      description: `경쟁 밀도 ${Math.round(input.competitionDensity * 100)}%로 치열한 경쟁 환경`,
    })
  } else if (input.competitionDensity < 0.2) {
    factors.push({
      factor: '낮은 경쟁',
      impact: 'positive',
      description: '경쟁이 적어 시장 선점 기회',
    })
  }

  // 유동인구
  if (['very_high', 'high'].includes(input.trafficLevel)) {
    factors.push({
      factor: '유동인구',
      impact: 'positive',
      description: '높은 유동인구로 잠재 고객 풍부',
    })
  } else if (['very_low', 'low'].includes(input.trafficLevel)) {
    factors.push({
      factor: '유동인구',
      impact: 'negative',
      description: '낮은 유동인구로 고객 확보 어려움',
    })
  }

  // 임대료
  if (input.rentLevel === 'high') {
    factors.push({
      factor: '임대료',
      impact: 'negative',
      description: '높은 임대료로 고정비 부담 증가',
    })
  } else if (input.rentLevel === 'low') {
    factors.push({
      factor: '임대료',
      impact: 'positive',
      description: '상대적으로 낮은 임대료로 비용 절감',
    })
  }

  // 상권 유형
  if (input.areaType === 'D_특수') {
    factors.push({
      factor: '상권 특성',
      impact: 'negative',
      description: '관광/이벤트 특수 상권으로 계절적 변동 위험',
    })
  } else if (input.areaType === 'A_주거') {
    factors.push({
      factor: '상권 특성',
      impact: 'positive',
      description: '안정적인 주거 밀집 상권',
    })
  }

  // 업종 특성
  const survivalRate = CATEGORY_SURVIVAL_RATES[input.category] || 55
  if (survivalRate < 50) {
    factors.push({
      factor: '업종 특성',
      impact: 'negative',
      description: `${getCategoryName(input.category)} 업종 평균 생존율 ${survivalRate}%`,
    })
  } else if (survivalRate >= 70) {
    factors.push({
      factor: '업종 특성',
      impact: 'positive',
      description: `${getCategoryName(input.category)} 업종 높은 생존율 ${survivalRate}%`,
    })
  }

  return factors
}
