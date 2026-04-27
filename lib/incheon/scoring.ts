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
      body: `${categoryName} 기준 반경 500m 동종 업종 밀집도가 높은지 주변 점포 구성을 비교해야 합니다.`,
      evidenceBadges: [`동종업종 약 ${params.sameCategoryCount}곳`, '반경 500m'],
    },
    {
      key: 'cost',
      score: params.risk.scoreBreakdown.cost,
      title: '비용 부담을 먼저 확인하세요',
      body: '한국부동산원 임대료·공실률 기준 비용 부담이 손익분기점에 미치는 영향을 확인해야 합니다.',
      evidenceBadges: ['임대료·공실률 참고', '권역 단위'],
    },
    {
      key: 'transit',
      score: params.risk.scoreBreakdown.transit,
      title: '유입 부족을 먼저 확인하세요',
      body: '정류장·역 접근성이 약하면 워킹 유입보다 목적 방문과 재방문 구조가 더 중요합니다.',
      evidenceBadges: [`유입 부족 ${params.transitRisk}점`, '교통 접근 기준'],
    },
    {
      key: 'anchor',
      score: params.risk.scoreBreakdown.anchor,
      title: '앵커 부족을 먼저 확인하세요',
      body: '학교, 어린이집, 역, 정류장 등 주변 유입 시설과 실제 점포 동선이 이어지는지 봐야 합니다.',
      evidenceBadges: ['공공 앵커 기준', '현장 동선 확인'],
    },
    {
      key: 'survival',
      score: params.risk.scoreBreakdown.survival,
      title: '폐업 위험 조합을 확인하세요',
      body: '실제 개폐업 데이터가 없어 경쟁·유입·비용·앵커 조합으로 보조 위험을 추정했습니다.',
      evidenceBadges: ['보조 추정', '개폐업 데이터 미포함'],
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
