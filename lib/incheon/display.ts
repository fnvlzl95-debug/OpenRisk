import type { IncheonConfidence, MetricDisplayState } from './types'

/**
 * 모든 지표 null/제외/제한 표기를 한 곳에서 통일한다.
 * UI는 metricStateTag()의 결과만 사용해 "정보 부족"/"제한적 반영"/"업종 산식 제외"를
 * 일관되게 노출한다.
 */
export function deriveMetricState(
  score: number | null,
  options: {
    excluded?: boolean
    degraded?: boolean
    reason?: string
    confidence?: IncheonConfidence
  } = {}
): MetricDisplayState {
  if (options.excluded) {
    return { status: 'excluded', score: null, reason: options.reason ?? '업종 산식에서 제외된 지표입니다.' }
  }
  if (score === null || Number.isNaN(score)) {
    return { status: 'unavailable', score: null, reason: options.reason ?? '산출에 필요한 데이터가 아직 부족합니다.' }
  }
  if (options.degraded) {
    return { status: 'degraded', score, reason: options.reason ?? '일부 원천 데이터가 비어 제한적으로 반영됩니다.' }
  }
  return { status: 'available', score, confidence: options.confidence ?? 'medium' }
}

/** 점수 옆에 붙는 짧은 상태 태그. available은 태그 없음(null). */
export function metricStateTag(state: MetricDisplayState): string | null {
  switch (state.status) {
    case 'available':
      return null
    case 'degraded':
      return '제한적 반영'
    case 'unavailable':
      return '정보 부족'
    case 'excluded':
      return '업종 산식 제외'
  }
}

/** 점수 숫자 표기. 점수가 없으면 대시 대신 통일된 '—'. */
export function metricScoreText(state: MetricDisplayState): string {
  return state.status === 'available' || (state.status === 'degraded' && state.score !== null)
    ? String(state.score)
    : '—'
}

export function confidenceLabel(confidence: IncheonConfidence): string {
  if (confidence === 'high') return '높음'
  if (confidence === 'medium') return '중간'
  return '낮음'
}
