import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import type { AIAnalysisResponse } from '@/lib/ai-analysis/types'
import type { IncheonAnalyzeResponse, IncheonMetricCard } from '@/lib/incheon/types'
import { getClientIp } from '@/lib/server/client-ip'
import { checkServerRateLimit, getRetryAfterSeconds } from '@/lib/server/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 60

const INCHEON_AI_RATE_LIMIT = { max: 8, windowMs: 60 * 1000 }

let openaiClient: OpenAI | null = null

function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return openaiClient
}

function buildPrompt() {
  return `
역할: 너는 "OpenRisk 인천"의 상권 리스크 분석 AI다.
핵심 포지션: 예비 창업자가 무리한 계약을 하지 않도록 인천 공공데이터 기반 위험을 먼저 경고한다.

출력 형식:
- JSON 객체 하나만 출력한다. 그 외 텍스트는 금지한다.
- 허용 키는 headline, riskAnalysis, failureScenario, fieldChecks, reconsideration, disclaimer 여섯 개뿐이다.
- 모든 키를 반드시 포함한다.

말투와 판단:
- "~입니다" 체로 단정적으로 말한다.
- 긍정적 표현보다 계약 전 확인해야 할 위험과 한계를 우선한다.
- 특정 업종 전환, 창업 권유, 투자 권유는 하지 않는다.
- 입력에 없는 지역 정보, 매출, 임대 조건, 고객 성향을 추측하지 않는다.
- 공공데이터 전용 분석임을 유지하고 카카오, OpenAI, 민간 유료 데이터가 점수에 쓰였다고 말하지 않는다.
- 이모지는 사용하지 않는다.

근거 사용 원칙:
- risk.level, risk.scoreBreakdown, riskTop3, lifeDNA.summary/evidence/cautions, dataQuality, confidenceReasons를 우선 근거로 쓴다.
- 숫자 필드는 판단에는 참고하되 출력에는 직접 쓰지 않는다.
- 좌표, 반경, H3, 원자료 건수 같은 내부 수치는 출력하지 않는다.

숫자/수치 출력 금지:
- 아라비아 숫자, 퍼센트, 금액, 거리 숫자는 쓰지 않는다.
- "높은 편", "상당한 수준", "자료가 제한적", "주요 위험으로 확인"처럼 질적 표현으로 바꾼다.

필드 작성 규칙:
- headline: 짧은 경고 한 문장.
- riskAnalysis: 세 문단으로 작성한다.
  첫 문단은 경쟁 과밀과 상권 밀집 위험을 설명한다.
  둘째 문단은 유입, 앵커, 비용 부담 중 입력에서 강한 위험을 중심으로 설명한다.
  셋째 문단은 데이터 신뢰도와 현장 확인 필요성을 설명한다.
- failureScenario: 실패 경로를 화살표로 연결한 한 줄 문장.
- fieldChecks: 현장에서 확인할 행동형 체크리스트 세 개에서 다섯 개.
- reconsideration: 계약 또는 투자 결정을 다시 점검하라는 마지막 경고 한 문장.
- disclaimer: 아래 문구를 그대로 출력한다.
"본 분석은 인천 공공데이터 기반 참고자료입니다. 최종 결정은 현장 실사와 전문가 상담을 통해 신중하게 내리시기 바랍니다."

최종 규칙: JSON만 출력한다.
`.trim()
}

function compactMetric(card: IncheonMetricCard) {
  return {
    label: card.label,
    level: card.level,
    confidence: card.confidence,
    summary: card.summary,
    evidence: card.evidence.slice(0, 4),
    cautions: card.cautions.slice(0, 4),
    facts: card.facts?.slice(0, 4).map((fact) => ({
      label: fact.label,
      value: fact.value,
      unit: fact.unit,
      caption: fact.caption,
    })),
  }
}

function compactIncheonReportForAI(data: IncheonAnalyzeResponse) {
  return {
    productMode: data.productMode,
    dataPolicy: data.dataPolicy,
    location: {
      label: data.location.label,
      radiusMeters: data.location.radiusMeters,
    },
    category: data.category,
    risk: {
      score: data.risk.score,
      level: data.risk.level,
      confidence: data.risk.confidence,
      scoreBreakdown: {
        competition: data.risk.scoreBreakdown.competition,
        transit: data.risk.scoreBreakdown.transit,
        anchor: data.risk.scoreBreakdown.anchor,
        cost: data.risk.scoreBreakdown.cost,
      },
      survival: data.risk.survival,
      excludedMetrics: data.risk.excludedMetrics,
      degradedMetrics: data.risk.degradedMetrics,
      confidenceReasons: data.risk.confidenceReasons,
    },
    riskTop3: data.cards.riskTop3.map((card) => ({
      rank: card.rank,
      title: card.title,
      body: card.body,
      severity: card.severity,
      evidenceBadges: card.evidenceBadges,
    })),
    lifeDNA: {
      educationFamily: compactMetric(data.lifeDNA.educationFamily),
      transitAccess: compactMetric(data.lifeDNA.transitAccess),
      categoryDensity: compactMetric(data.lifeDNA.categoryDensity),
      costPressure: compactMetric(data.lifeDNA.costPressure),
    },
    fieldChecks: data.cards.fieldChecks,
    dataQuality: {
      overall: data.dataQuality.overall,
      store: compactMetric(data.dataQuality.store),
      transit: compactMetric(data.dataQuality.transit),
      education: compactMetric(data.dataQuality.education),
      cost: compactMetric(data.dataQuality.cost),
    },
    sources: data.sources.slice(0, 12).map((source) => ({
      sourceId: source.sourceId,
      name: source.name,
      provider: source.provider,
      scoringUse: source.scoringUse,
      dataPeriod: source.dataPeriod,
      status: source.status,
    })),
    auxiliary: data.auxiliary,
  }
}

function normalizeAnalysis(value: AIAnalysisResponse): AIAnalysisResponse {
  return {
    headline: value.headline || '이 위치는 계약 전 리스크 점검이 필요합니다.',
    riskAnalysis: value.riskAnalysis || '',
    failureScenario: value.failureScenario || '',
    fieldChecks: Array.isArray(value.fieldChecks) ? value.fieldChecks.slice(0, 5) : [],
    reconsideration: value.reconsideration || '',
    disclaimer:
      value.disclaimer ||
      '본 분석은 인천 공공데이터 기반 참고자료입니다. 최종 결정은 현장 실사와 전문가 상담을 통해 신중하게 내리시기 바랍니다.',
  }
}

export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req)
  const rateLimit = await checkServerRateLimit(`ai-incheon-summary:${clientIp}`, INCHEON_AI_RATE_LIMIT)
  const rateLimitHeaders = {
    'X-RateLimit-Limit': String(INCHEON_AI_RATE_LIMIT.max),
    'X-RateLimit-Remaining': String(rateLimit.remaining),
    'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetAt / 1000)),
  }

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
      {
        status: 429,
        headers: {
          ...rateLimitHeaders,
          'Retry-After': String(getRetryAfterSeconds(rateLimit.resetAt)),
        },
      }
    )
  }

  try {
    const openai = getOpenAIClient()
    if (!openai) {
      return NextResponse.json(
        { error: 'OpenAI API 키가 설정되지 않았습니다.' },
        { status: 500, headers: rateLimitHeaders }
      )
    }

    const body = await req.json()
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: '잘못된 요청 형식입니다.' },
        { status: 400, headers: rateLimitHeaders }
      )
    }

    const { data } = body as { data?: IncheonAnalyzeResponse }
    if (!data) {
      return NextResponse.json(
        { error: '인천 분석 데이터가 필요합니다.' },
        { status: 400, headers: rateLimitHeaders }
      )
    }

    if (data.productMode !== 'openrisk-incheon' || data.dataPolicy !== 'public-data-only') {
      return NextResponse.json(
        { error: 'OpenRisk 인천 공공데이터 분석 결과만 AI 분석할 수 있습니다.' },
        { status: 400, headers: rateLimitHeaders }
      )
    }

    if (data.risk.insufficientData) {
      return NextResponse.json(
        { error: '상권 데이터가 부족한 위치는 AI 분석을 제공하지 않습니다. 지도와 원자료만 참고해 주세요.' },
        { status: 422, headers: rateLimitHeaders }
      )
    }

    const payloadSize = JSON.stringify(data).length
    if (payloadSize > 60_000) {
      return NextResponse.json(
        { error: '요청 데이터가 너무 큽니다.' },
        { status: 413, headers: rateLimitHeaders }
      )
    }

    const compactData = compactIncheonReportForAI(data)
    const userMessage = `[OpenRisk 인천 분석 데이터]
${JSON.stringify(compactData, null, 2)}

위 데이터를 바탕으로 예비 창업자에게 리스크 중심의 경고를 제공하라.`

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'developer', content: buildPrompt() },
        { role: 'user', content: userMessage },
      ],
      max_completion_tokens: 2000,
      response_format: { type: 'json_object' },
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json(
        { error: 'AI 응답이 비었습니다.' },
        { status: 502, headers: rateLimitHeaders }
      )
    }

    let analysis: AIAnalysisResponse
    try {
      analysis = normalizeAnalysis(JSON.parse(content) as AIAnalysisResponse)
    } catch {
      return NextResponse.json(
        { error: 'AI 응답 형식 오류' },
        { status: 502, headers: rateLimitHeaders }
      )
    }

    if (!analysis.headline || !analysis.riskAnalysis) {
      return NextResponse.json(
        { error: 'AI 응답에 필수 필드가 없습니다.' },
        { status: 502, headers: rateLimitHeaders }
      )
    }

    return NextResponse.json({ analysis }, { headers: rateLimitHeaders })
  } catch (error: unknown) {
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? (error as { status?: number }).status
      : undefined
    const message = typeof error === 'object' && error !== null && 'message' in error
      ? (error as { message?: string }).message
      : undefined
    const errorBody = typeof error === 'object' && error !== null && 'error' in error
      ? (error as { error?: { message?: string } }).error
      : undefined

    if (status === 429 || message?.includes('rate')) {
      return NextResponse.json(
        { error: 'API 호출 한도 초과. 잠시 후 다시 시도해주세요.' },
        { status: 429, headers: rateLimitHeaders }
      )
    }

    if (status === 401 || message?.includes('API key') || message?.includes('Incorrect API key')) {
      return NextResponse.json(
        { error: 'API 인증 오류' },
        { status: 401, headers: rateLimitHeaders }
      )
    }

    if (status === 400) {
      return NextResponse.json(
        { error: errorBody?.message ?? message ?? 'Bad Request' },
        { status: 400, headers: rateLimitHeaders }
      )
    }

    return NextResponse.json(
      { error: 'AI 분석 생성 중 오류가 발생했습니다.' },
      { status: 500, headers: rateLimitHeaders }
    )
  }
}
