// 상권 영역
export interface TradeArea {
  id: string
  name: string
  district: string
  center_lat: number
  center_lng: number
  polygon: unknown // PostGIS geometry
  source: string | null
  updated_at: string
}

// 상권 지표
export interface AreaMetrics {
  id: number
  area_id: string
  period: string
  resident_index: number | null
  worker_index: number | null
  traffic_index: number | null
  daypart_variance: number | null
  weekend_ratio: number | null
  competition_density: number | null
  open_close_churn: number | null
  cost_proxy: number | null
}

// UX 문장 템플릿
export interface CopyTemplate {
  id: number
  key: string
  scope: 'lv3_5' | 'lv4'
  grade: 'A' | 'B' | 'C' | 'D' | null
  type: 'core' | 'action' | 'risk'
  text: string
  is_active: boolean
}

// 등급 룰셋
export interface GradeRule {
  id: number
  version: string
  grade: 'A' | 'B' | 'C' | 'D'
  weights: Record<string, number>
  is_active: boolean
}

// 등급 정의
export type Grade = 'A' | 'B' | 'C' | 'D'

export interface GradeInfo {
  grade: Grade
  name: string
  subTitle: string
  difficulty: number
  theme: string
}

export const GRADE_INFO: Record<Grade, GradeInfo> = {
  A: {
    grade: 'A',
    name: 'A_주거',
    subTitle: 'Safe Zone',
    difficulty: 1,
    theme: '생활 밀착, 안정성, 반복 소비'
  },
  B: {
    grade: 'B',
    name: 'B_혼합',
    subTitle: 'Gray Zone',
    difficulty: 3,
    theme: '시간차 공격 전략, 착시 주의'
  },
  C: {
    grade: 'C',
    name: 'C_상업',
    subTitle: 'High Risk / High Return',
    difficulty: 5,
    theme: '속도전, 비용 압박, 트렌드 함정'
  },
  D: {
    grade: 'D',
    name: 'D_특수',
    subTitle: 'Special Case',
    difficulty: 0, // 측정 불가
    theme: '고립, 조건부, 특수 목적'
  }
}

// 분석 결과
export interface AnalysisResult {
  area: {
    id: string
    name: string
    district: string
    center: { lat: number; lng: number }
  }
  lv3_5: {
    grade: Grade
    gradeName: string
    subTitle: string
    difficulty: number
    confidence: number
    reasons: { key: string; value: number; label: string }[]
    coreCopy: string[]
    actions: string[]
    risks: string[]
  }
  lv4: null // Phase 2
}
