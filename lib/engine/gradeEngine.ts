/**
 * 상권 등급 계산 엔진
 *
 * 유동인구, 시간대 편차, 주말 비중을 기반으로 상권 등급(A-D)을 산출
 */

import { Grade } from '@/lib/types'

export interface GradeInput {
  traffic_index: number    // 유동인구 지수 (만 단위 정규화)
  daypart_variance: number // 시간대 편차 (0-1)
  weekend_ratio: number    // 주말 비중 (0-1)
}

export interface GradeReason {
  key: string
  value: number
  label: string
}

export interface GradeResult {
  grade: Grade
  confidence: number
  reasons: GradeReason[]
}

/**
 * 상권 등급 계산
 *
 * 로직:
 * - A등급 (주거형): 유동인구 적음, 시간대 편차 낮음 → 안정적
 * - B등급 (혼합형): 중간 수준, 주거+상업 혼합
 * - C등급 (상업형): 유동인구 많음, 시간대 편차 높음 → 고위험/고수익
 * - D등급 (특수형): 분류 불가 케이스
 */
export function calculateGrade(metrics: GradeInput): GradeResult {
  const { traffic_index, daypart_variance, weekend_ratio } = metrics

  // 정규화 (0~1 스케일)
  // traffic_index는 만 단위이므로, 1000만명 기준 = 1000
  const trafficScore = Math.min(traffic_index / 1000, 1)
  const varianceScore = daypart_variance
  const weekendScore = weekend_ratio

  const reasons: GradeReason[] = [
    { key: 'traffic', value: trafficScore, label: '유동인구 지수' },
    { key: 'variance', value: varianceScore, label: '시간대 편차' },
    { key: 'weekend', value: weekendScore, label: '주말 비중' }
  ]

  // 등급 결정 로직
  let grade: Grade
  let confidence: number

  // A등급: 유동인구 적고 편차 낮음 (주거형)
  if (trafficScore < 0.2 && varianceScore < 0.3) {
    grade = 'A'
    confidence = 0.8 + (1 - trafficScore) * 0.1
  }
  // B등급: 중간 수준 (혼합형)
  else if (trafficScore < 0.5 && varianceScore < 0.5) {
    grade = 'B'
    confidence = 0.7 + (0.5 - trafficScore) * 0.2
  }
  // C등급: 유동인구 많거나 편차 높음 (상업형)
  else if (trafficScore >= 0.5 || varianceScore >= 0.5) {
    grade = 'C'
    confidence = 0.65 + trafficScore * 0.2
  }
  // D등급: 분류 불가 (특수형)
  else {
    grade = 'D'
    confidence = 0.6
  }

  return {
    grade,
    confidence: Math.min(confidence, 0.95),
    reasons
  }
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
