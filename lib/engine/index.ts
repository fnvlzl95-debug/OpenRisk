/**
 * 분석 엔진 모듈
 *
 * 상권 등급 계산 및 해석 문구 생성
 */

export {
  calculateGrade,
  calculateDisplayMetrics,
  calculateMarketingElasticity,
  type GradeInput,
  type GradeResult,
  type GradeReason
} from './gradeEngine'

export {
  getGradeCopy,
  getGradeSummary,
  type GradeCopy
} from './copyRenderer'
