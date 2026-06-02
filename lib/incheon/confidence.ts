import type { IncheonConfidence } from './types'

/**
 * 신뢰도는 "데이터셋 존재 여부"가 아니라 데이터 품질 점수(0~1)로 계산한다.
 * 비용 데이터만 있으면 high가 되던 과대보고를 막는다.
 */
export interface MetricQuality {
  available: boolean
  nonZero: boolean
  freshnessScore: number // 0~1
  granularityScore: number // 0~1 (h3 500m=1, 권역=0.5, 행정동=0.7)
  sourceScore: number // 0~1
}

export function calculateMetricQuality(q: MetricQuality): number {
  if (!q.available) return 0
  if (!q.nonZero) return 0.2
  return q.freshnessScore * 0.35 + q.granularityScore * 0.35 + q.sourceScore * 0.3
}

export function qualityToConfidence(quality: number): IncheonConfidence {
  if (quality >= 0.8) return 'high'
  if (quality >= 0.5) return 'medium'
  return 'low'
}

/**
 * 전체 신뢰도는 평균이 아니라 min-cap.
 * 핵심 지표 하나가 죽으면(quality≈0) 평균에 묻히지 않도록 cap한다.
 */
export function combineQualityConfidence(qualities: number[]): IncheonConfidence {
  if (qualities.length === 0) return 'low'
  const min = Math.min(...qualities)
  const avg = qualities.reduce((sum, value) => sum + value, 0) / qualities.length
  const capped = Math.min(avg, min + 0.25)
  return qualityToConfidence(capped)
}
