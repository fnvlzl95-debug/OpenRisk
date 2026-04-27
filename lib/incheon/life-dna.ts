import type { BusinessCategory } from '@/lib/categories'
import type { IncheonActualSignals } from './dataset-types'
import type { IncheonLifeDNA, IncheonMetricCard, IncheonMetricLevel } from './types'
import { sourceRefs } from './source-policy'

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

function levelFromScore(score: number): IncheonMetricLevel {
  if (score >= 67) return 'high'
  if (score >= 34) return 'medium'
  return 'low'
}

function levelLabel(level: IncheonMetricLevel) {
  if (level === 'high') return '높음'
  if (level === 'medium') return '보통'
  if (level === 'low') return '낮음'
  return '정보 부족'
}

function metricCard(args: Omit<IncheonMetricCard, 'value' | 'level'> & { score: number }): IncheonMetricCard {
  const score = Math.round(clamp(args.score))
  const level = levelFromScore(score)
  return {
    ...args,
    value: `${levelLabel(level)} (${score})`,
    level,
  }
}

export function buildIncheonLifeDNA(params: {
  lat: number
  lng: number
  category: BusinessCategory
  sameCategoryCount: number
  totalStores: number
  transitScore: number
  costScore: number | null
  actualSignals?: IncheonActualSignals
}): IncheonLifeDNA {
  const educationScore = params.actualSignals?.educationFamilyScore ?? 0
  const densityScore = params.actualSignals?.competitionRisk ?? clamp((params.sameCategoryCount / Math.max(1, Math.min(params.totalStores, 80))) * 160 + 18)
  const costScore = params.costScore === null ? 0 : params.costScore
  const evidence = params.actualSignals?.evidence

  return {
    educationFamily: metricCard({
      label: '교육·가족 중심의 동네',
      score: educationScore,
      granularity: ['radius_500m', 'admin_dong_reference'],
      period: params.actualSignals?.generatedAt ?? '공공데이터 확보 후 갱신',
      confidence: evidence?.educationFamily.confidence ?? 'low',
      sources: sourceRefs(
        evidence?.educationFamily.sourceIds.length
          ? evidence.educationFamily.sourceIds
          : ['school-location-standard', 'incheon-school-status', 'childcare-basic', 'resident-age-admin-dong']
      ),
      summary: '학교와 어린이집 접근성, 행정동 아동·청소년 인구를 함께 보고 해석합니다.',
      cautions: ['학교·어린이집이 가까워도 실제 고객 동선이 이어진다는 뜻은 아닙니다.'],
      evidence: evidence?.educationFamily.evidence ?? ['교육·가족 데이터가 아직 부족합니다.'],
      facts: evidence?.educationFamily.facts ?? [],
    }),
    transitAccess: metricCard({
      label: '교통 접근성',
      score: params.transitScore,
      granularity: ['radius_500m'],
      period: params.actualSignals?.generatedAt ?? '2025 후보',
      confidence: evidence?.transit.confidence ?? 'low',
      sources: sourceRefs(['incheon-bus-stops', 'incheon-bus-ridership', 'incheon-subway-ridership']),
      summary: '버스와 지하철 이용 데이터를 바탕으로 고객이 찾아오기 쉬운 정도를 봅니다.',
      cautions: ['실제 보행 동선, 횡단보도, 큰 도로 단절 여부는 현장 확인이 필요합니다.'],
      evidence: evidence?.transit.evidence ?? ['교통 데이터가 아직 부족합니다.'],
    }),
    categoryDensity: metricCard({
      label: '경쟁 과밀',
      score: densityScore,
      granularity: ['radius_500m'],
      period: params.actualSignals?.generatedAt ?? '2025 후보',
      confidence: evidence?.competition.confidence ?? 'low',
      sources: sourceRefs(['store-small-business']),
      summary: '반경 500m 안에 비슷한 매장이 얼마나 모여 있는지 보여줍니다.',
      cautions: ['매장이 많이 모인 곳은 수요 신호일 수 있지만, 같은 고객층을 나눠 갖는 경쟁 부담도 함께 봐야 합니다.'],
      evidence: evidence?.competition.evidence ?? [`비슷한 매장 ${params.sameCategoryCount}곳`, `전체 점포 ${params.totalStores}곳`],
    }),
    costPressure: {
      label: '비용 부담',
      value: params.costScore === null ? '데이터 부족' : `${levelLabel(levelFromScore(costScore))} (${Math.round(costScore)})`,
      level: params.costScore === null ? 'unknown' : levelFromScore(costScore),
      granularity: ['regional_reference'],
      period: params.costScore === null ? 'N/A' : params.actualSignals?.costPeriod ?? 'official-file',
      confidence: evidence?.cost.confidence ?? (params.costScore === null ? 'low' : 'medium'),
      sources: sourceRefs(['reb-small-rent', 'reb-small-vacancy']),
      summary: '한국부동산원 공식 통계 기반 비용 부담 참고 지표입니다.',
      cautions: ['개별 점포의 실제 임대료, 보증금, 권리금과 다를 수 있습니다.'],
      evidence: evidence?.cost.evidence ?? (params.costScore === null ? ['비용 데이터가 아직 부족합니다.'] : ['소규모상가 임대료·공실률 권역 참고']),
    },
  }
}
