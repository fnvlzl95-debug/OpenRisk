/**
 * OpenRisk v2.0 - 해석 문장 다양화 시스템
 *
 * "말리는 친구" 컨셉:
 * - 부정적 지표는 명확히 경고 (판사처럼 선고 X, 친구처럼 말림 O)
 * - 긍정적 지표도 함정 알림
 * - 조합이 나쁘면 더 강하게 말림
 */

export {
  generateContextualExplanations,
  generateSummary,
  generateTopFactors,
  type GeneratorInput,
} from './generator'

export {
  type Template,
  type ConditionSet,
  type MetricLevel,
  type DynamicVars,
  type AllMetrics,
  buildDynamicVars,
  getCompetitionLevel,
  getTrafficLevelSimple,
  getCostLevelSimple,
  getSurvivalLevel,
} from './conditions'
