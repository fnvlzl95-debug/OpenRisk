import { getCategoryName, getCategoryWeights, type BusinessCategory } from '@/lib/categories'
import type { IncheonRiskCard, IncheonRiskLevel, IncheonRiskResult } from './types'

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

function coordSeed(lat: number, lng: number, salt: number) {
  const raw = Math.sin(lat * 14.31 + lng * 23.77 + salt) * 10000
  return raw - Math.floor(raw)
}

export function riskLevelFromScore(score: number): IncheonRiskLevel {
  if (score >= 70) return 'VERY_HIGH'
  if (score >= 50) return 'HIGH'
  if (score >= 30) return 'MEDIUM'
  return 'LOW'
}

export function normalizeWeights<T extends Record<string, number | null>>(weights: T): T {
  const total = Object.values(weights).reduce<number>((sum, value) => sum + (value ?? 0), 0)
  if (total <= 0) return weights

  return Object.fromEntries(
    Object.entries(weights).map(([key, value]) => [key, value === null ? null : value / total])
  ) as T
}

export function buildIncheonSignals(params: {
  lat: number
  lng: number
  category: BusinessCategory
  sameCategoryCount?: number
  totalStores?: number
  costDataAvailable?: boolean
}) {
  const sameCategoryCount = params.sameCategoryCount ?? Math.round(4 + coordSeed(params.lat, params.lng, 4) * 24)
  const totalStores = params.totalStores ?? Math.round(28 + coordSeed(params.lat, params.lng, 5) * 92)
  const competitionRisk = clamp((sameCategoryCount / 24) * 100)
  const transitScore = clamp(28 + coordSeed(params.lat, params.lng, 6) * 62)
  const transitRisk = clamp(100 - transitScore * 0.85)
  const survivalRisk = clamp(36 + coordSeed(params.lat, params.lng, 7) * 38 + competitionRisk * 0.15)
  const anchorRisk = clamp(72 - transitScore * 0.42 + coordSeed(params.lat, params.lng, 8) * 18)
  const costScore = params.costDataAvailable === false ? null : clamp(35 + coordSeed(params.lat, params.lng, 9) * 56)

  return {
    sameCategoryCount,
    totalStores,
    competitionRisk,
    transitScore,
    transitRisk,
    survivalRisk,
    anchorRisk,
    costScore,
  }
}

export function calculateIncheonRisk(params: {
  lat: number
  lng: number
  category: BusinessCategory
  sameCategoryCount?: number
  totalStores?: number
  costDataAvailable?: boolean
}): IncheonRiskResult & { signals: ReturnType<typeof buildIncheonSignals> } {
  const sourceWeights = getCategoryWeights(params.category)
  const signals = buildIncheonSignals(params)
  const rawWeights = {
    competition: sourceWeights.competition,
    transit: sourceWeights.traffic,
    survival: sourceWeights.survival,
    anchor: sourceWeights.anchor,
    cost: signals.costScore === null ? null : sourceWeights.cost,
  }
  const weights = normalizeWeights(rawWeights)
  const score =
    signals.competitionRisk * weights.competition +
    signals.transitRisk * weights.transit +
    signals.survivalRisk * weights.survival +
    signals.anchorRisk * weights.anchor +
    (signals.costScore ?? 0) * (weights.cost ?? 0)

  const rounded = Math.round(clamp(score))
  return {
    score: rounded,
    level: riskLevelFromScore(rounded),
    scoreBreakdown: {
      competition: Math.round(signals.competitionRisk),
      transit: Math.round(signals.transitRisk),
      survival: Math.round(signals.survivalRisk),
      anchor: Math.round(signals.anchorRisk),
      cost: signals.costScore === null ? null : Math.round(signals.costScore),
      weights,
    },
    excludedMetrics: signals.costScore === null ? ['cost'] : [],
    signals,
  }
}

export function buildIncheonRiskCards(params: {
  category: BusinessCategory
  risk: IncheonRiskResult
  sameCategoryCount: number
  costScore: number | null
  transitRisk: number
}): IncheonRiskCard[] {
  const cards: IncheonRiskCard[] = []
  const categoryName = getCategoryName(params.category)

  if (params.risk.score >= 55) {
    cards.push({
      rank: 1,
      title: '위험 요인이 겹쳐 있습니다',
      body: `${categoryName} 기준으로 경쟁, 교통 접근, 비용 신호를 함께 확인해야 합니다.`,
      severity: 'warning',
      evidenceBadges: [`리스크 ${params.risk.score}점`, '공공데이터 기반'],
    })
  }

  if (params.sameCategoryCount >= 12) {
    cards.push({
      rank: cards.length + 1,
      title: '동종업종 밀집도가 높습니다',
      body: '주변 수요 신호일 수 있지만 같은 고객을 나누는 경쟁 압박이 커질 수 있습니다.',
      severity: params.sameCategoryCount >= 20 ? 'critical' : 'warning',
      evidenceBadges: [`동종업종 ${params.sameCategoryCount}곳`, '반경 500m'],
    })
  }

  if (params.costScore !== null && params.costScore >= 65) {
    cards.push({
      rank: cards.length + 1,
      title: '비용 압박 신호가 있습니다',
      body: '공식 통계상 비용 부담이 높은 권역일 수 있어 실제 임대 조건 확인이 필요합니다.',
      severity: 'warning',
      evidenceBadges: ['임대료·공실률 참고', '권역 단위'],
    })
  }

  if (params.transitRisk >= 55) {
    cards.push({
      rank: cards.length + 1,
      title: '교통 접근 신호가 약합니다',
      body: '정류장·역 접근성만으로 구매 전환을 판단하기 어렵습니다. 실제 보행 동선을 확인해야 합니다.',
      severity: 'caution',
      evidenceBadges: ['교통 접근 기반', '현장 확인 필요'],
    })
  }

  return cards.slice(0, 3).map((card, index) => ({ ...card, rank: index + 1 }))
}
