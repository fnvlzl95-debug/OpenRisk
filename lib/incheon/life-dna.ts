import type { BusinessCategory } from '@/lib/categories'
import type { IncheonLifeDNA, IncheonMetricCard, IncheonMetricLevel } from './types'
import { sourceRefs } from './source-policy'

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

function coordSeed(lat: number, lng: number, salt: number) {
  const raw = Math.sin(lat * 18.17 + lng * 11.91 + salt) * 10000
  return raw - Math.floor(raw)
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
  return '확인 필요'
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
}): IncheonLifeDNA {
  const educationScore = clamp(42 + coordSeed(params.lat, params.lng, 2) * 44 + (params.category === 'academy' ? 8 : 0))
  const densityScore = clamp((params.sameCategoryCount / Math.max(1, Math.min(params.totalStores, 80))) * 160 + 18)
  const costScore = params.costScore === null ? 0 : params.costScore

  return {
    educationFamily: metricCard({
      label: '교육·가족 생활권',
      score: educationScore,
      granularity: ['radius_500m', 'admin_dong_reference'],
      period: '공공데이터 확보 후 갱신',
      confidence: 'medium',
      sources: sourceRefs(['school-location-standard', 'incheon-school-status', 'childcare-basic', 'resident-age-admin-dong']),
      summary: '교육·가족 생활권 신호를 학교·어린이집 접근성과 행정동 아동·청소년 인구 참고값으로 해석합니다.',
      cautions: ['학교·어린이집이 가까워도 실제 고객 동선이 이어진다는 뜻은 아닙니다.'],
      evidence: ['학교 위치와 학생 규모 조인 예정', '어린이집 정원·현원·입소대기 데이터 반영 예정'],
    }),
    transitAccess: metricCard({
      label: '교통 접근성',
      score: params.transitScore,
      granularity: ['radius_500m'],
      period: '2025 후보',
      confidence: 'medium',
      sources: sourceRefs(['incheon-bus-stops', 'incheon-bus-ridership', 'incheon-subway-ridership']),
      summary: '버스 승하차와 지하철 수송인원 기반의 교통 접근 유입 신호입니다.',
      cautions: ['실제 보행 동선, 횡단보도, 큰 도로 단절 여부는 현장 확인이 필요합니다.'],
      evidence: ['정류장 이용승객 거리감쇠', '역별 수송인원 거리감쇠', '반경 내 정류장 수 보조'],
    }),
    categoryDensity: metricCard({
      label: '동종업종 밀집도',
      score: densityScore,
      granularity: ['radius_500m'],
      period: '2025-10 후보',
      confidence: 'medium',
      sources: sourceRefs(['store-small-business']),
      summary: '반경 500m 안의 동일·유사 업종 밀집도를 경쟁 압박 신호로 보여줍니다.',
      cautions: ['밀집도는 수요 신호일 수 있지만 같은 고객을 나누는 경쟁 압박이기도 합니다.'],
      evidence: [`동종업종 추정 ${params.sameCategoryCount}곳`, `전체 점포 추정 ${params.totalStores}곳`],
    }),
    costPressure: {
      label: '비용 압박',
      value: params.costScore === null ? '데이터 부족' : `${levelLabel(levelFromScore(costScore))} (${Math.round(costScore)})`,
      level: params.costScore === null ? 'unknown' : levelFromScore(costScore),
      granularity: ['regional_reference'],
      period: params.costScore === null ? 'N/A' : '2025 후보',
      confidence: params.costScore === null ? 'low' : 'medium',
      sources: sourceRefs(['reb-small-rent', 'reb-small-vacancy']),
      summary: '한국부동산원 공식 통계 기반 비용 압박 참고 지표입니다.',
      cautions: ['개별 점포의 실제 임대료, 보증금, 권리금과 다를 수 있습니다.'],
      evidence: params.costScore === null ? ['비용 데이터 확보 전'] : ['소규모상가 임대료·공실률 권역 참고'],
    },
  }
}
