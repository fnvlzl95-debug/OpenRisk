/**
 * 상권 등급 계산 엔진 (Phase 2 - 8지표 버전)
 *
 * 8개 지표를 기반으로 상권 등급(A-D)을 산출
 * - 기본: traffic_index, daypart_variance, weekend_ratio
 * - 추가: worker_index, competition_density, open_close_churn, cost_proxy
 */

import { Grade, MarketingElasticity } from '@/lib/types'

export interface GradeInput {
  // 기본 지표 (필수)
  traffic_index: number       // 유동인구 지수 (만 단위 정규화)
  daypart_variance: number    // 시간대 편차 (0-1)
  weekend_ratio: number       // 주말 비중 (0-1)
  // 추가 지표 (Phase 2)
  resident_index?: number     // 상주인구 지수
  worker_index?: number       // 직장인구 지수
  competition_density?: number // 경쟁 밀도 (유사업종/전체)
  open_close_churn?: number   // 개폐업 변동률
  cost_proxy?: number         // 비용 압박 (서울 평균 대비)
}

export interface GradeReason {
  key: string
  value: number
  label: string
}

export interface GradeResult {
  grade: Grade
  reasons: GradeReason[]
}

/**
 * 상권 등급 계산 (Phase 2 - 8지표 공식)
 *
 * 등급별 점수 산출:
 * - A_score: 주거 안정성 (worker 낮음, 편차 낮음, 비용 낮음)
 * - B_score: 혼합 균형 (직주 혼합, 중간 편차)
 * - C_score: 상업 강도 (유동↑, 경쟁↑, 변동↑, 비용↑)
 * - D_score: 특수 케이스 (관광특구 등)
 */
export function calculateGrade(metrics: GradeInput): GradeResult {
  const {
    traffic_index,
    daypart_variance,
    weekend_ratio,
    resident_index = 0,
    worker_index = 0,
    competition_density = 0,
    open_close_churn = 0,
    cost_proxy = 0
  } = metrics

  // 정규화 (0~1 스케일)
  const traffic = Math.min(traffic_index / 1000, 1)        // 1000만 기준
  const variance = Math.min(daypart_variance, 1)
  const weekend = Math.min(weekend_ratio, 1)
  const worker = Math.min(worker_index / 10, 1)            // 10만명 기준
  const resident = Math.min(resident_index / 10, 1)        // 10만명 기준
  const competition = Math.min((competition_density - 1) * 5, 1)  // 1.0~1.2 → 0~1
  const churn = Math.min(open_close_churn * 10, 1)         // 0.1 = 10% 변동
  const cost = Math.min(cost_proxy / 10, 1)                // 서울 평균 10배 기준

  // 8지표 사용 가능 여부 체크
  const hasExtendedMetrics = worker_index !== undefined ||
                              competition_density !== undefined ||
                              open_close_churn !== undefined ||
                              cost_proxy !== undefined

  // 등급별 점수 계산
  let A_score: number, B_score: number, C_score: number, D_score: number

  if (hasExtendedMetrics && (worker > 0 || competition > 0 || churn > 0 || cost > 0)) {
    // Phase 2: 8지표 공식
    // A등급 (주거형): 직장인 적고, 편차 낮고, 비용 낮음
    A_score = (1 - worker) * 0.3 + (1 - variance) * 0.3 + (1 - cost) * 0.2 + (1 - churn) * 0.2

    // B등급 (혼합형): 직주 균형, 중간 편차, 중간 경쟁
    const workerResidentBalance = 1 - Math.abs(worker - resident)
    B_score = workerResidentBalance * 0.3 + (1 - Math.abs(variance - 0.5)) * 0.25 +
              (1 - Math.abs(competition - 0.5)) * 0.25 + (1 - Math.abs(weekend - 0.3)) * 0.2

    // C등급 (상업형): 유동↑, 경쟁↑, 변동↑, 비용↑
    C_score = traffic * 0.25 + competition * 0.25 + churn * 0.25 + cost * 0.25

    // D등급 (특수형): 주말 비중 극단적이거나 특수 조건
    D_score = weekend > 0.5 ? weekend * 0.5 : 0  // 주말 의존도 높으면 특수형 가능성
  } else {
    // Phase 1: 3지표 공식 (기존 로직 유지)
    A_score = (1 - traffic) * 0.4 + (1 - variance) * 0.4 + (1 - weekend) * 0.2
    B_score = (1 - Math.abs(traffic - 0.3)) * 0.4 + (1 - Math.abs(variance - 0.4)) * 0.4 + 0.2
    C_score = traffic * 0.4 + variance * 0.4 + weekend * 0.2
    D_score = 0
  }

  // 최고 점수 등급 선택
  const scores = { A: A_score, B: B_score, C: C_score, D: D_score }
  const sortedGrades = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)

  const [topGradeKey, topScore] = sortedGrades[0]
  const [, secondScore] = sortedGrades[1]

  const grade = topGradeKey as Grade

  // 근거 추출 (상위 영향 지표)
  const reasons = extractTopReasons(metrics, grade, hasExtendedMetrics)

  return {
    grade,
    reasons
  }
}

/**
 * 등급 결정에 기여한 상위 지표 추출
 */
function extractTopReasons(
  metrics: GradeInput,
  grade: Grade,
  hasExtendedMetrics: boolean
): GradeReason[] {
  const reasons: GradeReason[] = []

  const {
    traffic_index,
    daypart_variance,
    weekend_ratio,
    worker_index = 0,
    competition_density = 0,
    open_close_churn = 0,
    cost_proxy = 0
  } = metrics

  // 기본 지표
  reasons.push({ key: 'traffic', value: Math.min(traffic_index / 1000, 1), label: '유동인구' })
  reasons.push({ key: 'variance', value: daypart_variance, label: '시간대 편차' })
  reasons.push({ key: 'weekend', value: weekend_ratio, label: '주말 비중' })

  // 확장 지표 (Phase 2)
  // 직장인구는 인구 구성 섹션에서 표시하므로 여기서 제외
  if (hasExtendedMetrics) {
    if (competition_density > 0) {
      reasons.push({ key: 'competition', value: Math.min((competition_density - 1) * 5, 1), label: '경쟁 밀도' })
    }
    if (open_close_churn > 0) {
      reasons.push({ key: 'churn', value: Math.min(open_close_churn * 10, 1), label: '개폐업 변동' })
    }
    if (cost_proxy > 0) {
      reasons.push({ key: 'cost', value: Math.min(cost_proxy / 10, 1), label: '비용 압박' })
    }
  }

  // 등급별로 가장 영향력 있는 지표 3개 선택
  if (grade === 'A') {
    // A등급: 안정성 지표 우선 (낮은 값이 좋음)
    return reasons
      .sort((a, b) => a.value - b.value)
      .slice(0, 3)
  } else if (grade === 'C') {
    // C등급: 상업성 지표 우선 (높은 값이 특징)
    return reasons
      .sort((a, b) => b.value - a.value)
      .slice(0, 3)
  }

  // B, D등급: 값이 큰 순
  return reasons
    .sort((a, b) => b.value - a.value)
    .slice(0, 3)
}

/**
 * 원본 데이터에서 표시용 지표 계산
 */
export function calculateDisplayMetrics(metrics: {
  traffic_index: number
  weekend_ratio: number
  resident_index: number
  worker_index: number
}) {
  const trafficTotal = Math.round(metrics.traffic_index * 10000)
  const weekendRatio = metrics.weekend_ratio || 0
  const trafficWeekend = Math.round(trafficTotal * weekendRatio)
  const trafficWeekday = trafficTotal - trafficWeekend

  return {
    traffic_total: trafficTotal,
    traffic_weekday: trafficWeekday,
    traffic_weekend: trafficWeekend,
    resident_count: Math.round((metrics.resident_index || 0) * 10000),
    worker_count: Math.round((metrics.worker_index || 0) * 10000)
  }
}

/**
 * 마케팅 탄성 계산
 *
 * - HIGH: 외부 유입↑, 경쟁↑, 주말 비중↑ → SNS/블로그 효과 큼
 * - LOW: 상주 인구↑, 직장인 의존↑ → 단골/입지가 중요
 * - MEDIUM: 중간
 */
export function calculateMarketingElasticity(metrics: {
  weekend_ratio: number
  resident_index: number
  worker_index: number
  competition_density: number
  hasAnchor: boolean  // 지하철/대학 등 외부 유입원
}): MarketingElasticity {
  const { weekend_ratio, resident_index, worker_index, competition_density, hasAnchor } = metrics

  // 정규화
  const weekend = weekend_ratio
  const resident = Math.min(resident_index / 10, 1)
  const worker = Math.min(worker_index / 10, 1)
  const competition = Math.min((competition_density - 1) * 5, 1)

  // HIGH 조건: 외부 유입 + 주말 비중 높음 + 경쟁 치열
  if (hasAnchor && weekend > 0.3 && competition > 0.3) {
    return 'HIGH'
  }

  // LOW 조건: 상주인구 의존도 높음
  const residentRatio = resident / (resident + worker + 0.01)
  if (residentRatio > 0.7 || (worker > 0.5 && weekend < 0.25)) {
    return 'LOW'
  }

  return 'MEDIUM'
}
