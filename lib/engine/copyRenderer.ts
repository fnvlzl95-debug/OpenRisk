/**
 * 등급별 해석 문구 렌더러
 *
 * 상권 등급에 따른 핵심 해석, 추천 액션, 리스크를 반환
 */

import { Grade } from '@/lib/types'

export interface GradeCopy {
  coreCopy: string[]
  actions: string[]
  risks: string[]
}

const GRADE_COPIES: Record<Grade, GradeCopy> = {
  A: {
    coreCopy: [
      '주거 중심 상권으로 유동인구 변동이 적습니다.',
      '단골 기반 업종에 유리한 환경입니다.',
      '임대료가 상대적으로 안정적입니다.'
    ],
    actions: [
      '생활 밀착형 업종 검토 (세탁소, 미용실, 편의점 등)',
      '단골 고객 확보 전략 수립',
      '주민 니즈 파악을 위한 사전 조사'
    ],
    risks: [
      '유동인구가 적어 신규 고객 유입이 어려움',
      '업종 변경 시 기존 고객 이탈 가능성'
    ]
  },
  B: {
    coreCopy: [
      '주거와 상업이 혼합된 복합 상권입니다.',
      '낮과 밤, 평일과 주말에 고객층이 달라집니다.',
      '시간대별 전략이 중요합니다.'
    ],
    actions: [
      '시간대별 타겟 고객 분석 필수',
      '점심/저녁 메뉴 차별화 검토',
      '주중/주말 운영 전략 수립'
    ],
    risks: [
      '타겟 설정 실패 시 양쪽 모두 놓칠 수 있음',
      '운영 복잡도 증가'
    ]
  },
  C: {
    coreCopy: [
      '유동인구가 많은 상업 중심 상권입니다.',
      '경쟁이 치열하고 트렌드 변화가 빠릅니다.',
      '높은 매출 기대치만큼 리스크도 큽니다.'
    ],
    actions: [
      '경쟁 업체 대비 명확한 차별점 필수',
      '최소 6개월 고정비 버틸 자금 확보',
      '트렌드 변화 대응 계획 수립'
    ],
    risks: [
      '높은 임대료와 권리금',
      '트렌드 변화에 민감',
      '마케팅 경쟁 심화'
    ]
  },
  D: {
    coreCopy: [
      '특수 목적 상권으로 일반적 분석이 어렵습니다.',
      '특정 조건에서만 유효한 상권입니다.',
      '전문가 상담을 권장합니다.'
    ],
    actions: [
      '해당 상권 특성에 대한 심층 조사 필요',
      '유사 업종 성공/실패 사례 분석',
      '전문가 컨설팅 검토'
    ],
    risks: [
      '일반적 상권 분석이 적용되지 않음',
      '예측 어려움'
    ]
  }
}

/**
 * 등급에 해당하는 해석 문구 반환
 */
export function getGradeCopy(grade: Grade): GradeCopy {
  return GRADE_COPIES[grade]
}

/**
 * 등급별 요약 한 줄 반환
 */
export function getGradeSummary(grade: Grade): string {
  const summaries: Record<Grade, string> = {
    A: '안정적인 주거형 상권, 단골 기반 업종에 적합',
    B: '주거+상업 혼합, 시간대별 전략 필요',
    C: '고위험 고수익 상업 상권, 경쟁 치열',
    D: '특수 상권, 전문 분석 필요'
  }
  return summaries[grade]
}
