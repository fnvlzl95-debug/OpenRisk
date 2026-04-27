import { getCategoryName, type BusinessCategory } from '@/lib/categories'
import type { IncheonRiskCard, IncheonRiskLevel, IncheonRiskResult } from './types'

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

export function buildIncheonRiskCards(params: {
  category: BusinessCategory
  risk: IncheonRiskResult
  sameCategoryCount: number
  costScore: number | null
  transitRisk: number
}): IncheonRiskCard[] {
  const categoryName = getCategoryName(params.category)
  const severity = (score: number): IncheonRiskCard['severity'] => {
    if (score >= 75) return 'critical'
    if (score >= 55) return 'warning'
    return 'caution'
  }

  const cards = [
    {
      key: 'competition',
      score: params.risk.scoreBreakdown.competition,
      title: '경쟁 과밀을 먼저 확인하세요',
      body: `주변 500m 안에 비슷한 ${categoryName} 매장이 많습니다. 내 매장만의 특별한 경쟁력이 있는지 비교해 보세요.`,
      evidenceBadges: [`비슷한 매장 약 ${params.sameCategoryCount}곳`, '반경 500m'],
    },
    {
      key: 'cost',
      score: params.risk.scoreBreakdown.cost,
      title: '비용 부담을 먼저 확인하세요',
      body: '임대료와 공실률 통계를 볼 때, 매월 나가는 고정비용이 매출에 큰 부담이 될 수 있으니 미리 계산해 보세요.',
      evidenceBadges: ['임대료·공실률 참고', '권역 단위'],
    },
    {
      key: 'transit',
      score: params.risk.scoreBreakdown.transit,
      title: '유입 부족을 먼저 확인하세요',
      body: '정류장·역 접근성이 약하면 지나가다 들르는 손님보다 일부러 찾아오게 만드는 이유와 재방문 구조가 더 중요합니다.',
      evidenceBadges: [`유입 부족 ${params.transitRisk}점`, '교통 접근 기준'],
    },
    {
      key: 'anchor',
      score: params.risk.scoreBreakdown.anchor,
      title: '앵커 부족을 먼저 확인하세요',
      body: '역이나 학교 같은 주요 시설에서 우리 매장까지 사람들이 쉽게 걸어올 수 있는지 확인하세요.',
      evidenceBadges: ['공공 앵커 기준', '현장 동선 확인'],
    },
    {
      key: 'survival',
      score: params.risk.scoreBreakdown.survival,
      title: '폐업 위험 조합을 확인하세요',
      body: '주변 경쟁과 임대료 등을 종합해 볼 때, 버티기 어려울 수 있는 위험도를 예측했습니다.',
      evidenceBadges: ['종합 예측', '직접 확인'],
    },
  ]
    .filter((card): card is Omit<typeof card, 'score'> & { score: number } => typeof card.score === 'number')
    .sort((a, b) => b.score - a.score)

  return cards.slice(0, 3).map((card, index) => ({
    rank: index + 1,
    title: card.title,
    body: card.body,
    severity: severity(card.score),
    evidenceBadges: [`${card.score}점`, ...card.evidenceBadges],
  }))
}
