import type { IncheonConfidence, IncheonDataQuality, IncheonLifeDNA, IncheonMetricCard } from './types'

const SCORE: Record<IncheonConfidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
}

export function combineConfidence(metrics: IncheonMetricCard[]): IncheonConfidence {
  const average = metrics.reduce((sum, metric) => sum + SCORE[metric.confidence], 0) / metrics.length
  if (average >= 2.6) return 'high'
  if (average >= 1.7) return 'medium'
  return 'low'
}

export function buildDataQuality(lifeDNA: IncheonLifeDNA): IncheonDataQuality {
  return {
    overall: combineConfidence([
      lifeDNA.educationFamily,
      lifeDNA.transitAccess,
      lifeDNA.categoryDensity,
      lifeDNA.costPressure,
    ]),
    store: lifeDNA.categoryDensity,
    transit: lifeDNA.transitAccess,
    education: lifeDNA.educationFamily,
    cost: lifeDNA.costPressure,
  }
}
