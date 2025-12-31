import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Node.js 런타임 명시 (Edge에서 OpenAI SDK 호환 문제 방지)
export const runtime = 'nodejs'

// Vercel Function 타임아웃 확장 (Hobby: 10초, Pro: 60초)
// GPT-5-mini는 reasoning 모델이라 응답이 느릴 수 있음
export const maxDuration = 60

// OpenAI 클라이언트는 요청 시점에 lazy 초기화
let openaiClient: OpenAI | null = null

function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return openaiClient
}

// 핵심 지표 항목 타입
export interface KeyMetricItem {
  key: string
  label: string
  value: number | null
  interpretation: string
}

// AI 요약 응답 구조 (v4 - OpenAI 강화 버전)
export interface AISummaryResponse {
  oneLiner: string              // 한 줄 요약
  structureAnalysis: string     // 상권 구조 해석
  keyMetrics: KeyMetricItem[]   // 핵심 지표
  opportunities: string[]       // 기회 요인 (NEW)
  riskChecks: string[]          // 리스크 체크
  nextSteps: string[]           // 확인 사항
  marketingNote: string | null  // 마케팅 전략
  idealBusiness: string | null  // 적합 업종 특성 (NEW)
  finalSummary: string          // 종합 결론
  disclaimer: string            // 면책 조항
}

function buildPrompt() {
  return `너는 "오픈리스크" 상권 분석 전문 AI 컨설턴트다.
예비 창업자에게 데이터 기반의 실질적이고 통찰력 있는 상권 분석을 제공한다.

## 역할
- 상권 데이터를 깊이 있게 해석하여 창업자가 실제로 활용할 수 있는 인사이트 제공
- 단순 수치 나열이 아닌, "이 숫자가 의미하는 바"를 명확히 설명
- 리스크는 솔직하게, 기회는 구체적으로 제시

## 톤 & 스타일
- 전문적이지만 이해하기 쉬운 언어 사용
- 데이터에 근거한 직접적인 분석 (회피적 표현 지양)
- 이모지 사용 금지, JSON 형식으로만 출력

## 입력 데이터 구조
- area: 상권명, 지역구
- analysis: 등급(A~D), 등급명, 설명, 마케팅탄성, 변화지표
- rawMetrics: 유동인구(총/평일/주말), 거주인구지수, 직장인구지수
- interpretation: 핵심 카피, 추천 액션, 리스크

## 분석 가이드라인

### 등급별 상권 특성 해석
- **A등급 (주거형)**: 거주민 기반, 단골 확보가 핵심, 마케팅보다 접근성과 품질
- **B등급 (혼합형)**: 거주+유동 복합, 시간대별 전략 차별화 필요
- **C등급 (상업형)**: 외부 유입 의존, 온라인 노출과 첫인상이 중요
- **D등급 (특수형)**: 특정 시간/요일 집중, 니치 타겟팅 필수

### 지표 해석 기준
- traffic_total 40만 이상: 대형 상권 (경쟁 치열, 임대료 높음)
- traffic_total 10만 이하: 소형 상권 (틈새시장, 고정비 관리 중요)
- 평일/주말 비율 3:1 이상: 오피스 의존형
- 거주지수 > 직장지수 2배: 주거 배후 강함
- 직장지수 > 거주지수 3배: 점심/퇴근 시간대 집중

### 마케팅 탄성 해석
- HIGH: 광고/SNS 효과 높음, 신규 고객 유치 용이
- MEDIUM: 기본 노출 필요, 차별화 콘텐츠로 승부
- LOW: 마케팅보다 입지와 단골 관리가 핵심

## 출력 JSON 구조

{
  "oneLiner": "이 상권의 핵심 특성을 한 문장으로 (80자 이내)",

  "structureAnalysis": "상권 구조를 3~4문장으로 깊이 있게 분석. 유동인구 패턴, 거주/직장 인구 비율의 의미, 시간대별 특성을 구체적으로 해석. 숫자를 활용한 비교 분석 포함. (500자 이내)",

  "keyMetrics": [
    {
      "key": "traffic_total",
      "label": "총 유동인구",
      "value": null,
      "interpretation": "이 숫자가 창업자에게 의미하는 바를 구체적으로 (80자 이내)"
    },
    {
      "key": "traffic_ratio",
      "label": "평일/주말 비율",
      "value": null,
      "interpretation": "평일과 주말 유동인구 비율이 시사하는 상권 특성 (80자 이내)"
    },
    {
      "key": "resident_worker_ratio",
      "label": "거주/직장 비율",
      "value": null,
      "interpretation": "배후 수요 구조가 영업에 미치는 영향 (80자 이내)"
    }
  ],

  "opportunities": [
    "이 상권에서 발견되는 기회 요인 1 (데이터 근거 포함)",
    "기회 요인 2"
  ],

  "riskChecks": [
    "주의해야 할 리스크 1 - 구체적인 이유와 대응 방향 포함",
    "리스크 2",
    "리스크 3"
  ],

  "nextSteps": [
    "창업 전 반드시 확인할 사항 1 (구체적인 체크 방법 포함)",
    "확인 사항 2",
    "확인 사항 3",
    "확인 사항 4"
  ],

  "marketingNote": "이 상권에 적합한 마케팅 전략 제안. 등급과 마케팅탄성을 고려한 구체적인 방향. (200자 이내, 마케팅탄성이 없으면 null)",

  "idealBusiness": "이 상권 구조에 어울리는 업종 특성 설명 (특정 업종 추천이 아닌 '어떤 특성의 업종이 유리한지' 설명, 150자 이내)",

  "finalSummary": "종합 결론. 이 상권의 핵심 특성, 주요 리스크, 성공 포인트를 3~4문장으로 압축. 창업자가 의사결정에 바로 활용할 수 있는 수준으로. (350자 이내)",

  "disclaimer": "본 분석은 공공데이터 기반 참고자료입니다. 실제 창업 결정 전 현장 답사, 임대료 확인, 경쟁 분석을 반드시 진행하세요."
}

## 주의사항
- 특정 업종(예: "카페를 차리세요")을 직접 추천하지 않음
- 데이터에 없는 정보(임대료, 권리금 등)를 추측하지 않음
- 하지만 데이터가 시사하는 바는 적극적으로 해석
- value가 null인 지표는 interpretation에 "해당 데이터 없음" 표기

JSON만 출력하라.`
}

function compactReport(report: any) {
  // 토큰 절약: 폴리곤 제외, 핵심 데이터만 전달
  return {
    area: {
      name: report?.area?.name,
      district: report?.area?.district,
    },
    analysis: report?.analysis && {
      grade: report.analysis.grade,
      gradeName: report.analysis.gradeName,
      description: report.analysis.description,
      anchors: report.analysis.anchors,
      changeIndicator: report.analysis.changeIndicator,
      marketingElasticity: report.analysis.marketingElasticity,
      reasons: report.analysis.reasons,
    },
    rawMetrics: report?.rawMetrics && {
      period: report.rawMetrics.period,
      traffic_total: report.rawMetrics.traffic_total,
      traffic_weekday: report.rawMetrics.traffic_weekday,
      traffic_weekend: report.rawMetrics.traffic_weekend,
      resident_index: report.rawMetrics.resident_index,
      worker_index: report.rawMetrics.worker_index,
    },
    interpretation: report?.interpretation,
    dataQuality: report?.dataQuality,
  }
}

export async function POST(req: NextRequest) {
  try {
    // API 키 확인 및 클라이언트 초기화
    const openai = getOpenAIClient()
    if (!openai) {
      return NextResponse.json(
        { error: 'OpenAI API 키가 설정되지 않았습니다.' },
        { status: 500 }
      )
    }

    const { report } = await req.json()

    if (!report) {
      return NextResponse.json(
        { error: 'report 데이터가 필요합니다.' },
        { status: 400 }
      )
    }

    const compactData = compactReport(report)
    const userMessage = `[상권 데이터]\n${JSON.stringify(compactData, null, 2)}`

    // OpenAI - gpt-5-mini 모델 사용 (최신 API 권장 파라미터)
    // gpt-5-mini는 temperature 미지원 (기본값 1만 사용)
    const response = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        { role: 'developer', content: buildPrompt() },  // system 대신 developer 권장
        { role: 'user', content: userMessage }
      ],
      max_completion_tokens: 2500,
      response_format: { type: 'json_object' }
    })

    const content = response.choices[0]?.message?.content

    if (!content) {
      return NextResponse.json(
        { error: 'AI 응답이 비었습니다.' },
        { status: 502 }
      )
    }

    // JSON 파싱
    let summary: AISummaryResponse
    try {
      summary = JSON.parse(content)
    } catch (parseError) {
      console.error('JSON 파싱 오류:', content)
      return NextResponse.json(
        { error: 'AI 응답 형식 오류' },
        { status: 502 }
      )
    }

    // 필수 필드 검증
    if (!summary.oneLiner || !summary.structureAnalysis) {
      return NextResponse.json(
        { error: 'AI 응답에 필수 필드가 없습니다.' },
        { status: 502 }
      )
    }

    // 배열 필드 기본값 보장
    if (!Array.isArray(summary.keyMetrics)) {
      summary.keyMetrics = []
    }
    if (!Array.isArray(summary.opportunities)) {
      summary.opportunities = []
    }
    if (!Array.isArray(summary.riskChecks)) {
      summary.riskChecks = []
    }
    if (!Array.isArray(summary.nextSteps)) {
      summary.nextSteps = []
    }
    // 선택적 문자열 필드
    if (typeof summary.idealBusiness !== 'string') {
      summary.idealBusiness = null
    }

    return NextResponse.json({ summary })

  } catch (error: any) {
    // 상세 에러 로깅 (디버깅용)
    console.error('AI summary error RAW:', error)
    console.error('status:', error?.status)
    console.error('message:', error?.message)
    console.error('error body:', error?.error)

    // OpenAI API 에러 처리
    if (error?.status === 429 || error?.message?.includes('rate')) {
      return NextResponse.json(
        { error: 'API 호출 한도 초과. 잠시 후 다시 시도해주세요.' },
        { status: 429 }
      )
    }

    if (error?.status === 401 || error?.message?.includes('API key') || error?.message?.includes('Incorrect API key')) {
      return NextResponse.json(
        { error: 'API 인증 오류' },
        { status: 401 }
      )
    }

    // Bad Request - OpenAI가 준 원인 그대로 반환
    if (error?.status === 400) {
      return NextResponse.json(
        { error: error?.error?.message ?? error?.message ?? 'Bad Request' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'AI 요약 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
