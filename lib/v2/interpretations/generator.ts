/**
 * 조합 기반 문장 생성기
 * 여러 지표 조건을 분석하여 상황에 맞는 해석 문장을 생성
 */

import type { BusinessCategory } from '../../categories'
import type { InterpretationV2, AreaType } from '../types'
import {
  type AllMetrics,
  type DynamicVars,
  type Template,
  getCompetitionLevel,
  getTrafficLevelSimple,
  getCostLevelSimple,
  getSurvivalLevel,
  buildContextKey,
  simplifyKey,
  buildDynamicVars,
  selectPhrase,
  interpolate,
} from './conditions'

import {
  competitionTemplates,
  trafficTemplates,
  costTemplates,
  survivalTemplates,
  anchorTemplates,
  areaTypeTemplates,
  combinationTemplates,
  categoryTemplates,
  type CategoryKey,
  type CategoryTemplateSet,
} from './templates'

// ===== 템플릿 검색 =====

function findTemplateByConditions(
  templates: Template[],
  contextKey: string
): Template | null {
  // 정확한 키 매칭
  for (const template of templates) {
    if (template.id === contextKey) {
      return template
    }
  }

  // 부분 키 매칭 (comp_high_traffic_low → comp_high)
  const simplifiedKey = simplifyKey(contextKey, 1)
  for (const template of templates) {
    if (template.id.startsWith(simplifiedKey)) {
      return template
    }
  }

  return null
}

function getDefaultTemplate(templates: Template[], level: string): Template | null {
  // 레벨 기반 기본 템플릿
  for (const template of templates) {
    if (template.id.includes(level)) {
      return template
    }
  }
  return templates[0] || null
}

// 업종별 템플릿에서 문구 가져오기
function getCategoryPhrase(
  categoryKey: CategoryKey | undefined,
  metric: 'competition' | 'traffic',
  level: 'high' | 'low',
  h3Id?: string
): string | null {
  if (!categoryKey) return null
  const catTemplate = categoryTemplates[categoryKey]
  if (!catTemplate) return null

  const phrases = catTemplate[metric]?.[level]
  if (!phrases || phrases.length === 0) return null

  return selectPhrase(phrases, h3Id)
}

function getCategoryAnchorPhrase(
  categoryKey: CategoryKey | undefined,
  isNear: boolean,
  h3Id?: string
): string | null {
  if (!categoryKey) return null
  const catTemplate = categoryTemplates[categoryKey]
  if (!catTemplate) return null

  const phrases = catTemplate.anchor?.[isNear ? 'near' : 'far']
  if (!phrases || phrases.length === 0) return null

  return selectPhrase(phrases, h3Id)
}

// ===== 지표별 문장 생성 =====

function generateCompetitionExplanation(
  metrics: AllMetrics,
  vars: DynamicVars,
  categoryKey?: CategoryKey
): string {
  const level = getCompetitionLevel(metrics.competition.sameCategory)
  const contextKey = `comp_${level}`

  // 1. 업종별 특화 템플릿 확인 (high/low만 지원)
  if (level === 'high' || level === 'low') {
    const categoryPhrase = getCategoryPhrase(categoryKey, 'competition', level, vars.h3Id)
    if (categoryPhrase) {
      return interpolate(categoryPhrase, vars)
    }
  }

  // 2. 공통 템플릿 검색
  let template = findTemplateByConditions(competitionTemplates, contextKey)

  // 3. 조합 템플릿 확인 (최악 조합)
  const trafficLevel = getTrafficLevelSimple(metrics.traffic.index)
  if (level === 'high' && trafficLevel === 'low') {
    const combTemplate = combinationTemplates.find(t => t.id === 'comp_high_traffic_low')
    if (combTemplate) template = combTemplate
  }

  if (!template) {
    template = getDefaultTemplate(competitionTemplates, level)
  }

  if (!template) {
    return level === 'high'
      ? `동종 업체가 ${vars.sameCategory}개로 경쟁이 치열해요`
      : `주변에 ${vars.categoryName}이 ${vars.sameCategory}개 있어요`
  }

  const phrase = selectPhrase(template.phrases, vars.h3Id)
  return interpolate(phrase, vars)
}

function generateTrafficExplanation(
  metrics: AllMetrics,
  vars: DynamicVars,
  categoryKey?: CategoryKey
): string {
  const level = getTrafficLevelSimple(metrics.traffic.index)
  const contextKey = `traffic_${level}`

  // 1. 업종별 특화 템플릿 확인 (high/low만 지원)
  if (level === 'high' || level === 'low') {
    const categoryPhrase = getCategoryPhrase(categoryKey, 'traffic', level, vars.h3Id)
    if (categoryPhrase) {
      return interpolate(categoryPhrase, vars)
    }
  }

  // 2. 피크타임 고려한 템플릿
  const peakTime = metrics.traffic.peakTime
  const peakTemplate = trafficTemplates.find(t =>
    t.id === `traffic_${level}` && t.conditions.peakTime === peakTime
  )
  if (peakTemplate) {
    const phrase = selectPhrase(peakTemplate.phrases, vars.h3Id)
    return interpolate(phrase, vars)
  }

  // 3. 기본 템플릿
  const template = findTemplateByConditions(trafficTemplates, contextKey)
    || getDefaultTemplate(trafficTemplates, level)

  if (!template) {
    return level === 'low'
      ? '유동인구가 적은 편이에요, 배달 의존도가 높아질 수 있어요'
      : '유동인구는 적당한 편이에요'
  }

  const phrase = selectPhrase(template.phrases, vars.h3Id)
  return interpolate(phrase, vars)
}

function generateCostExplanation(
  metrics: AllMetrics,
  vars: DynamicVars,
  _categoryKey?: CategoryKey  // 현재 cost는 업종별 템플릿 없음
): string {
  const level = getCostLevelSimple(metrics.cost.avgRent)
  const contextKey = `cost_${level}`

  // 1. 최악 조합 확인 (임대료 높음 + 생존율 낮음)
  const survivalLevel = getSurvivalLevel(metrics.survival.closureRate)
  if (level === 'high' && survivalLevel === 'high') {
    const combTemplate = combinationTemplates.find(t => t.id === 'cost_high_survival_low')
    if (combTemplate) {
      const phrase = selectPhrase(combTemplate.phrases, vars.h3Id)
      return interpolate(phrase, vars)
    }
  }

  // 3. 기본 템플릿
  const template = findTemplateByConditions(costTemplates, contextKey)
    || getDefaultTemplate(costTemplates, level)

  if (!template) {
    return level === 'high'
      ? `임대료가 평당 ${vars.avgRent}만원으로 높은 편이에요, 고정비 부담이 클 수 있어요`
      : `임대료는 평당 ${vars.avgRent}만원 정도예요`
  }

  const phrase = selectPhrase(template.phrases, vars.h3Id)
  return interpolate(phrase, vars)
}

function generateSurvivalExplanation(
  metrics: AllMetrics,
  vars: DynamicVars,
  _categoryKey?: CategoryKey  // 현재 survival은 업종별 템플릿 없음
): string {
  const level = getSurvivalLevel(metrics.survival.closureRate)
  const contextKey = `survival_${level}`

  // 기본 템플릿
  const template = findTemplateByConditions(survivalTemplates, contextKey)
    || getDefaultTemplate(survivalTemplates, level)

  if (!template) {
    return level === 'high'
      ? `폐업률이 ${vars.closureRate}%로 높은 편이에요, 운영 난이도가 높아요`
      : `생존율은 양호한 편이에요`
  }

  const phrase = selectPhrase(template.phrases, vars.h3Id)
  return interpolate(phrase, vars)
}

function generateTimePatternExplanation(
  metrics: AllMetrics,
  vars: DynamicVars
): string {
  const { peakTime, weekendRatio, timePattern } = metrics.traffic

  // 주말 비중 판단
  const isWeekendHeavy = weekendRatio > 1.3
  const isWeekdayHeavy = weekendRatio < 0.7

  // 피크타임 기반 문장
  const peakPhrases: Record<string, string[]> = {
    morning: [
      '아침 출근 시간대가 피크예요, 테이크아웃이나 빠른 서비스가 유리해요',
      '아침형 상권이라 점심 이후 매출 방어 전략이 필요해요',
    ],
    day: [
      '낮 시간대가 가장 활발해요, 직장인 점심 수요를 노려보세요',
      '점심~오후가 피크라 그 시간 인력 배치가 중요해요',
    ],
    night: [
      '저녁~밤이 피크예요, 야간 영업에 유리한 조건이에요',
      '저녁형 상권이라 낮 시간 매출은 기대하기 어려워요',
    ],
  }

  let phrase = selectPhrase(peakPhrases[peakTime] || peakPhrases.day, vars.h3Id)

  // 주말/평일 비중 추가
  if (isWeekendHeavy) {
    phrase += ' 주말 비중이 높아 평일 고정비 버티기가 필요해요.'
  } else if (isWeekdayHeavy) {
    phrase += ' 평일 수요가 강해 주말 휴무도 고려해볼 수 있어요.'
  }

  return phrase
}

function generateAreaTypeExplanation(
  metrics: AllMetrics,
  vars: DynamicVars
): string {
  const { areaType } = metrics
  const template = areaTypeTemplates.find(t => t.conditions.areaType === areaType)

  if (!template) {
    return `${vars.areaTypeLabel} 특성을 고려해 운영 전략을 세워보세요`
  }

  const phrase = selectPhrase(template.phrases, vars.h3Id)
  return interpolate(phrase, vars)
}

function generateAnchorExplanation(
  metrics: AllMetrics,
  vars: DynamicVars
): string {
  const { subway, starbucks, mart, department, hasAnyAnchor } = metrics.anchors

  if (!hasAnyAnchor) {
    const noAnchorTemplate = anchorTemplates.find(t => t.id === 'anchor_none')
    if (noAnchorTemplate) {
      return selectPhrase(noAnchorTemplate.phrases, vars.h3Id)
    }
    return '주변에 유입을 끌어올 앵커 시설이 없어요, 자체 집객력이 필요해요'
  }

  const parts: string[] = []

  // 지하철역
  if (subway && subway.distance <= 300) {
    const subwayTemplate = anchorTemplates.find(t => t.id === 'anchor_subway_near')
    if (subwayTemplate) {
      const phrase = selectPhrase(subwayTemplate.phrases, vars.h3Id)
      parts.push(interpolate(phrase, { ...vars, subwayName: subway.name, subwayDistance: subway.distance }))
    } else {
      parts.push(`${subway.name} ${subway.distance}m로 유입이 안정적이에요`)
    }
  } else if (subway && subway.distance <= 500) {
    parts.push(`${subway.name}이 ${subway.distance}m 거리라 도보 유입을 기대할 수 있어요`)
  }

  // 스타벅스 (상권 활성화 지표)
  if (starbucks && starbucks.count >= 2) {
    parts.push('스타벅스가 여러 개 있어 상권이 활성화된 곳이에요')
  }

  // 대형마트
  if (mart && mart.distance <= 500) {
    parts.push(`${mart.name}이 가까워 장보기 수요와 연계할 수 있어요`)
  }

  // 백화점
  if (department && department.distance <= 500) {
    parts.push(`${department.name} 인근이라 구매력 있는 고객층을 기대할 수 있어요`)
  }

  if (parts.length === 0) {
    return '앵커 시설이 있지만 거리가 좀 있어 직접적인 유입 효과는 제한적이에요'
  }

  // 역세권 주의사항 추가
  if (subway && subway.distance <= 200) {
    parts.push('단, 역세권은 임대료와 경쟁도 높다는 점 기억하세요')
  }

  return parts.join(' ')
}

// ===== 메인 생성 함수 =====

export interface GeneratorInput {
  metrics: AllMetrics
  categoryName: string
  categoryKey: BusinessCategory
  h3Id?: string
}

export function generateContextualExplanations(input: GeneratorInput): InterpretationV2['easyExplanations'] {
  const { metrics, categoryName, categoryKey, h3Id } = input

  // 동적 변수 생성
  const vars = buildDynamicVars(metrics, categoryName, h3Id)

  // 업종 키 매핑 (BusinessCategory → CategoryKey)
  const catKey = mapToCategoryKey(categoryKey)

  return {
    competition: generateCompetitionExplanation(metrics, vars, catKey),
    traffic: generateTrafficExplanation(metrics, vars, catKey),
    cost: generateCostExplanation(metrics, vars, catKey),
    survival: generateSurvivalExplanation(metrics, vars, catKey),
    timePattern: generateTimePatternExplanation(metrics, vars),
    areaType: generateAreaTypeExplanation(metrics, vars),
    anchor: generateAnchorExplanation(metrics, vars),
  }
}

// ===== 요약 문장 생성 =====

export function generateSummary(
  metrics: AllMetrics,
  vars: DynamicVars
): string {
  const compLevel = getCompetitionLevel(metrics.competition.sameCategory)
  const trafficLevel = getTrafficLevelSimple(metrics.traffic.index)
  const costLevel = getCostLevelSimple(metrics.cost.avgRent)
  const survivalLevel = getSurvivalLevel(metrics.survival.closureRate)

  // 점수 카운트
  const badCount = [compLevel, costLevel, survivalLevel].filter(l => l === 'high').length
    + (trafficLevel === 'low' ? 1 : 0)
  const goodCount = [compLevel, costLevel, survivalLevel].filter(l => l === 'low').length
    + (trafficLevel === 'high' ? 1 : 0)

  // 최악 조합: 경쟁 높음 + 유동 낮음 + 임대료 높음
  if (compLevel === 'high' && trafficLevel === 'low' && costLevel === 'high') {
    return '경쟁은 치열한데 유동인구는 적고 임대료까지 높습니다. 구조적으로 손익이 맞기 어려운 조건입니다.'
  }

  // 경쟁 낮음 + 유동 낮음 (함정) - 먼저 체크해서 타입 분기
  if (compLevel === 'low' && trafficLevel === 'low') {
    return '경쟁도 유동도 적은 구조입니다. 수요 자체가 약할 가능성이 있습니다.'
  }

  // 양호한 경우도 함정 언급
  if (goodCount >= 3) {
    return '지표는 양호한 편이지만, 좋은 조건은 경쟁자도 알고 있습니다.'
  }

  // 위험 신호 3개 이상
  if (badCount >= 3) {
    return '여러 지표가 부정적입니다. 진입 시 복합적인 리스크에 노출됩니다.'
  }

  // 경쟁 높음 + 유동 높음
  if (trafficLevel === 'high' && compLevel === 'high') {
    return `유동은 많지만 ${vars.sameCategory}개가 나눠 가지는 구조입니다. 차별점 없으면 체력전에서 밀릴 수 있습니다.`
  }

  // 임대료 높음 + 폐업률 높음
  if (costLevel === 'high' && survivalLevel === 'high') {
    return '폐업률이 높고 임대료도 높은 구조입니다. 손실이 빠르게 누적될 수 있습니다.'
  }

  // 임대료 높음
  if (costLevel === 'high') {
    return '고정비 부담이 큰 구조입니다. 매출이 기대치를 밑돌면 자금이 빠르게 소진될 수 있습니다.'
  }

  // 유동 낮음
  if (trafficLevel === 'low') {
    return '유동인구가 적은 구조입니다. 워킹 유입만으로는 매출이 채워지지 않을 수 있습니다.'
  }

  // 기본
  return '보통 수준의 상권입니다. 업종 특성과 타겟 고객층에 따라 달라질 수 있습니다.'
}

// ===== Top Factors 생성 =====

export function generateTopFactors(
  metrics: AllMetrics,
  vars: DynamicVars
): InterpretationV2['topFactors'] {
  const risks: string[] = []
  const opportunities: string[] = []

  // 경쟁
  const compLevel = getCompetitionLevel(metrics.competition.sameCategory)
  if (compLevel === 'high') {
    risks.push(`동종 ${vars.sameCategory}개`)
  } else if (compLevel === 'low') {
    opportunities.push('경쟁 적음')
  }

  // 유동인구
  const trafficLevel = getTrafficLevelSimple(metrics.traffic.index)
  if (trafficLevel === 'low') {
    risks.push('유동인구 적음')
  } else if (trafficLevel === 'high') {
    opportunities.push('유동인구 많음')
  }

  // 임대료
  const costLevel = getCostLevelSimple(metrics.cost.avgRent)
  if (costLevel === 'high') {
    risks.push('임대료 높음')
  } else if (costLevel === 'low') {
    opportunities.push('임대료 저렴')
  }

  // 생존율
  const survivalLevel = getSurvivalLevel(metrics.survival.closureRate)
  if (survivalLevel === 'high') {
    risks.push('폐업률 높음')
  } else if (survivalLevel === 'low') {
    opportunities.push('생존율 양호')
  }

  // 앵커
  if (metrics.anchors.subway && metrics.anchors.subway.distance <= 300) {
    opportunities.push(`역세권 ${metrics.anchors.subway.distance}m`)
  }
  if (!metrics.anchors.hasAnyAnchor) {
    risks.push('앵커시설 없음')
  }

  // 피크타임
  if (metrics.traffic.peakTime === 'night') {
    opportunities.push('야간 유동 강함')
  }

  // 상위 2개씩만 반환
  return {
    risks: risks.slice(0, 2),
    opportunities: opportunities.slice(0, 2),
  }
}

// ===== 업종 키 매핑 =====
// BusinessCategory가 이미 'cafe', 'bakery' 같은 키 형태이므로
// 그대로 CategoryKey로 사용 가능

function mapToCategoryKey(category: BusinessCategory): CategoryKey {
  return category
}
