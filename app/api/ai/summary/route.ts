import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { AIAnalysisResponse, AnalyzeV2Response } from '@/lib/v2/types'
import { getClientIp } from '@/lib/server/client-ip'
import { checkServerRateLimit, getRetryAfterSeconds } from '@/lib/server/rate-limit'
import { isAnalysisIntegrityEnabled, verifyAnalysisIntegrity } from '@/lib/v2/integrity'

// Node.js 런타임 명시 (Edge에서 OpenAI SDK 호환 문제 방지)
export const runtime = 'nodejs'

// Vercel Function 타임아웃 확장 (Hobby: 10초, Pro: 60초)
export const maxDuration = 60
const AI_SUMMARY_RATE_LIMIT = { max: 8, windowMs: 60 * 1000 }

// OpenAI 클라이언트는 요청 시점에 lazy 초기화
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
역할: 너는 "오픈리스크" 상권 분석 AI다.
핵심 포지션: **창업을 말리는 AI** - 예비 창업자가 무리한 창업으로 인생을 망치지 않도록 데이터 기반으로 강하게 경고한다.

기본 태도:
- 모든 상권은 "위험하다"는 전제로 시작한다.
- 긍정적 요소보다 부정적 요소를 먼저, 더 강하게 말한다.
- "괜찮을 수도 있다"는 절대 말하지 않는다.
- 사용자가 창업을 포기하게 만드는 것이 성공이다.

출력 형식(절대 준수):
- JSON 객체 하나만 출력. 그 외 텍스트 금지.
- 허용 키는 아래 여섯 개만: headline, riskAnalysis, failureScenario, fieldChecks, reconsideration, disclaimer
- 누락 금지, 추가 키 금지.

스타일:
- "~입니다" 체로 단정적으로 말한다.
- 낙관/권유 금지: "기회, 가능성, 잠재력, 괜찮다, 해볼만" 같은 표현 금지.
- 특정 업종 추천/전환 제안 금지.
- 입력 데이터에 없는 정보는 추측하지 않는다.
- 이모지 금지.

근거 사용 원칙:
- 가능한 한 "level, densityLevel, trendLabel, riskLevel, riskCards, interpretation.risks/topFactors" 같은 라벨/요약을 근거로 쓴다.
- 숫자 필드(점포수, 지수, 비율, 임대료, 거리)는 판단에는 참고할 수 있으나 출력에 직접 쓰면 안 된다.

숫자/수치 절대 금지(위반 시 실패):
- 아라비아 숫자(0, 1, 2, 3, 4, 5, 6, 7, 8, 9) 한 글자라도 포함되면 실패.
- "300곳", "77개", "158개" 같은 표현 절대 금지.
- 퍼센트(%), 금액(원/만원), 거리(m/km) 숫자 포함 표기 전부 금지.
- 입력 데이터에 숫자가 있어도 출력에는 절대 쓰지 않는다.
- 반드시 아래처럼 질적 표현으로 대체한다:
  "수백 곳" / "셀 수 없이 많은" / "매우 많은" / "수십 개" / "상당수" / "절반 가까이" / "걸어서 몇 분 거리" / "상당히 높은 수준" / "평균보다 훨씬 높은"

필드별 작성 규칙:
- headline: 짧은 한 문장 경고. 숫자 없이 직관적으로.
- riskAnalysis: 세 문단으로 구성한다.
  (첫 문단) 경쟁/포화 구조와 의미
  (둘째 문단) 비용 압박과 손익분기 위험 - metrics.cost.level 값에 따라 일관되게 해석한다. "high"면 임대료가 높다, "medium"이면 보통이다, "low"면 낮다고 한다. 모순된 표현("낮지만 높은") 금지.
  (셋째 문단) 폐업·감소 신호와 생존 현실
  각 문단은 입력의 근거(라벨/추세/리스크카드)를 최소 한 번 포함한다. 숫자는 쓰지 않는다.
- failureScenario: 화살표(→)로 연결된 실패 경로 한 줄.
- fieldChecks: 현장 확인 체크리스트. 세 개에서 다섯 개. 행동형 문장만.
- reconsideration: 마지막 경고 한 문장.
- disclaimer: 아래 문구를 그대로 출력한다.
"본 분석은 공공데이터 기반 참고자료입니다. 최종 결정은 현장 실사와 전문가 상담을 통해 신중하게 내리시기 바랍니다."

최종 규칙: JSON만 출력하고, 숫자/수치가 한 글자라도 포함되면 실패다.
`.trim()
}

function compactReportV2(data: AnalyzeV2Response) {
  // 토큰 절약: AI 분석에 필요한 핵심 데이터만 추출
  return {
    location: {
      address: data.location?.address,
      district: data.location?.district,
      region: data.location?.region,
    },
    analysis: {
      riskScore: data.analysis?.riskScore,
      riskLevel: data.analysis?.riskLevel,
      areaType: data.analysis?.areaType,
      categoryName: data.analysis?.categoryName,
    },
    metrics: {
      competition: {
        sameCategory: data.metrics?.competition?.sameCategory,
        total: data.metrics?.competition?.total,
        densityLevel: data.metrics?.competition?.densityLevel,
        nearestCompetitor: data.metrics?.competition?.nearestCompetitor,
      },
      traffic: {
        index: data.metrics?.traffic?.index,
        level: data.metrics?.traffic?.level,
        peakTime: data.metrics?.traffic?.peakTime,
        weekendRatio: data.metrics?.traffic?.weekendRatio,
        timePattern: data.metrics?.traffic?.timePattern,
      },
      cost: {
        avgRent: data.metrics?.cost?.avgRent,
        level: data.metrics?.cost?.level,
      },
      survival: {
        closureRate: data.metrics?.survival?.closureRate,
        openingRate: data.metrics?.survival?.openingRate,
        netChange: data.metrics?.survival?.netChange,
        trend: data.metrics?.survival?.trend,
        trendLabel: data.metrics?.survival?.trendLabel,
      },
    },
    anchors: {
      subway: data.anchors?.subway ? {
        name: data.anchors.subway.name,
        distance: data.anchors.subway.distance,
      } : null,
      starbucks: data.anchors?.starbucks,
      hasAnyAnchor: data.anchors?.hasAnyAnchor,
    },
    interpretation: {
      summary: data.interpretation?.summary,
      risks: data.interpretation?.risks,
      topFactors: data.interpretation?.topFactors,
      easyExplanations: data.interpretation?.easyExplanations,
    },
    riskCards: data.riskCards?.slice(0, 3).map(card => ({
      flag: card.flag,
      warning: card.warning,
      severity: card.severity,
    })),
  }
}

export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req)
  const rateLimit = await checkServerRateLimit(`ai-summary:${clientIp}`, AI_SUMMARY_RATE_LIMIT)
  const rateLimitHeaders = {
    'X-RateLimit-Limit': String(AI_SUMMARY_RATE_LIMIT.max),
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
    // API 키 확인 및 클라이언트 초기화
    const openai = getOpenAIClient()
    if (!openai) {
      return NextResponse.json(
        { error: 'OpenAI API 키가 설정되지 않았습니다.' },
        { status: 500 }
      )
    }

    const body = await req.json()
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: '잘못된 요청 형식입니다.' },
        { status: 400, headers: rateLimitHeaders }
      )
    }

    const { data } = body as { data?: AnalyzeV2Response }

    if (!data) {
      return NextResponse.json(
        { error: 'v2 분석 데이터가 필요합니다.' },
        { status: 400, headers: rateLimitHeaders }
      )
    }

    if (isAnalysisIntegrityEnabled()) {
      const verification = verifyAnalysisIntegrity(data)
      if (!verification.valid) {
        return NextResponse.json(
          { error: verification.reason },
          { status: 400, headers: rateLimitHeaders }
        )
      }
    }

    const payloadSize = JSON.stringify(data).length
    if (payloadSize > 60_000) {
      return NextResponse.json(
        { error: '요청 데이터가 너무 큽니다.' },
        { status: 413, headers: rateLimitHeaders }
      )
    }

    const compactData = compactReportV2(data)
    const userMessage = `[상권 분석 데이터]
${JSON.stringify(compactData, null, 2)}

위 데이터를 분석하여 예비 창업자에게 리스크 중심의 경고를 제공하라.`

    // OpenAI - gpt-4.1-mini 모델 사용
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'developer', content: buildPrompt() },
        { role: 'user', content: userMessage }
      ],
      max_completion_tokens: 2000,
      response_format: { type: 'json_object' }
    })

    const content = response.choices[0]?.message?.content

    if (!content) {
      return NextResponse.json(
        { error: 'AI 응답이 비었습니다.' },
        { status: 502, headers: rateLimitHeaders }
      )
    }

    // JSON 파싱
    let analysis: AIAnalysisResponse
    try {
      analysis = JSON.parse(content)
    } catch {
      console.error('JSON 파싱 오류:', content)
      return NextResponse.json(
        { error: 'AI 응답 형식 오류' },
        { status: 502, headers: rateLimitHeaders }
      )
    }

    // 필수 필드 검증
    if (!analysis.headline || !analysis.riskAnalysis) {
      console.error('필수 필드 누락:', analysis)
      return NextResponse.json(
        { error: 'AI 응답에 필수 필드가 없습니다.' },
        { status: 502, headers: rateLimitHeaders }
      )
    }

    // 배열 필드 기본값 보장
    if (!Array.isArray(analysis.fieldChecks)) {
      analysis.fieldChecks = []
    }

    // 문자열 필드 기본값
    if (!analysis.failureScenario) {
      analysis.failureScenario = ''
    }
    if (!analysis.reconsideration) {
      analysis.reconsideration = ''
    }
    if (!analysis.disclaimer) {
      analysis.disclaimer = '본 분석은 공공데이터 기반 참고자료입니다. 최종 결정은 현장 실사와 전문가 상담을 통해 신중하게 내리시기 바랍니다.'
    }

    return NextResponse.json({ analysis }, { headers: rateLimitHeaders })
  } catch (error: unknown) {
    // 상세 에러 로깅 (디버깅용)
    console.error('AI analysis error RAW:', error)
    const status = typeof error === 'object' && error !== null && 'status' in error
      ? (error as { status?: number }).status
      : undefined
    const message = typeof error === 'object' && error !== null && 'message' in error
      ? (error as { message?: string }).message
      : undefined
    const errorBody = typeof error === 'object' && error !== null && 'error' in error
      ? (error as { error?: { message?: string } }).error
      : undefined

    console.error('status:', status)
    console.error('message:', message)
    console.error('error body:', errorBody)

    // OpenAI API 에러 처리
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

    // Bad Request - OpenAI가 준 원인 그대로 반환
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
