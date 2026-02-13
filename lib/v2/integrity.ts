import { createHmac, timingSafeEqual } from 'crypto'
import type { AnalysisIntegrity, AnalyzeV2Response } from './types'

const ANALYSIS_INTEGRITY_VERSION = 1
const ANALYSIS_INTEGRITY_MAX_AGE_MS = 24 * 60 * 60 * 1000

type IntegrityVerificationResult =
  | { valid: true }
  | { valid: false; reason: string }

function getIntegritySecret(): string | null {
  const secret =
    process.env.ANALYSIS_INTEGRITY_SECRET ||
    process.env.OPENAI_API_KEY ||
    process.env.KAKAO_REST_KEY ||
    ''

  return secret.trim() ? secret : null
}

export function isAnalysisIntegrityEnabled(): boolean {
  return !!getIntegritySecret()
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue)
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, current]) => current !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))

    const sorted: Record<string, unknown> = {}
    for (const [key, current] of entries) {
      sorted[key] = sortValue(current)
    }
    return sorted
  }

  return value
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value))
}

function buildIntegrityPayload(data: AnalyzeV2Response) {
  return {
    location: {
      lat: data.location?.lat,
      lng: data.location?.lng,
      address: data.location?.address,
      district: data.location?.district,
      region: data.location?.region,
    },
    analysis: {
      riskScore: data.analysis?.riskScore,
      riskLevel: data.analysis?.riskLevel,
      areaType: data.analysis?.areaType,
      targetCategory: data.analysis?.targetCategory,
      categoryName: data.analysis?.categoryName,
      scoreBreakdown: data.analysis?.scoreBreakdown,
    },
    metrics: {
      competition: {
        sameCategory: data.metrics?.competition?.sameCategory,
        total: data.metrics?.competition?.total,
        densityLevel: data.metrics?.competition?.densityLevel,
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
      },
    },
    anchors: {
      subway: data.anchors?.subway
        ? {
            name: data.anchors.subway.name,
            distance: data.anchors.subway.distance,
          }
        : null,
      starbucks: data.anchors?.starbucks,
      hasAnyAnchor: data.anchors?.hasAnyAnchor,
    },
    interpretation: {
      summary: data.interpretation?.summary,
      risks: data.interpretation?.risks,
      topFactors: data.interpretation?.topFactors,
      easyExplanations: data.interpretation?.easyExplanations,
    },
    riskCards: data.riskCards?.slice(0, 3).map((card) => ({
      flag: card.flag,
      warning: card.warning,
      severity: card.severity,
    })),
    dataQuality: data.dataQuality,
  }
}

function signPayload(
  payload: ReturnType<typeof buildIntegrityPayload>,
  issuedAt: string,
  secret: string
): string {
  const message = `${ANALYSIS_INTEGRITY_VERSION}:${issuedAt}:${stableStringify(payload)}`
  return createHmac('sha256', secret).update(message).digest('hex')
}

export function createAnalysisIntegrity(
  data: AnalyzeV2Response
): AnalysisIntegrity | null {
  const secret = getIntegritySecret()
  if (!secret) return null

  const issuedAt = new Date().toISOString()
  const payload = buildIntegrityPayload(data)
  const signature = signPayload(payload, issuedAt, secret)

  return {
    version: ANALYSIS_INTEGRITY_VERSION,
    issuedAt,
    signature,
  }
}

export function verifyAnalysisIntegrity(
  data: AnalyzeV2Response
): IntegrityVerificationResult {
  const secret = getIntegritySecret()
  if (!secret) {
    return { valid: true }
  }

  const integrity = data.integrity
  if (!integrity) {
    return { valid: false, reason: '무결성 서명이 없습니다.' }
  }

  if (integrity.version !== ANALYSIS_INTEGRITY_VERSION) {
    return { valid: false, reason: '서명 버전이 일치하지 않습니다.' }
  }

  const issuedAtTime = Date.parse(integrity.issuedAt)
  if (Number.isNaN(issuedAtTime)) {
    return { valid: false, reason: '서명 시간이 올바르지 않습니다.' }
  }

  if (Date.now() - issuedAtTime > ANALYSIS_INTEGRITY_MAX_AGE_MS) {
    return { valid: false, reason: '서명 유효기간이 지났습니다.' }
  }

  const payload = buildIntegrityPayload(data)
  const expected = signPayload(payload, integrity.issuedAt, secret)

  try {
    const expectedBuffer = Buffer.from(expected, 'hex')
    const actualBuffer = Buffer.from(integrity.signature, 'hex')

    if (expectedBuffer.length === 0 || actualBuffer.length === 0) {
      return { valid: false, reason: '서명 형식이 올바르지 않습니다.' }
    }

    if (expectedBuffer.length !== actualBuffer.length) {
      return { valid: false, reason: '서명 검증에 실패했습니다.' }
    }

    const isValid = timingSafeEqual(expectedBuffer, actualBuffer)
    return isValid
      ? { valid: true }
      : { valid: false, reason: '서명 검증에 실패했습니다.' }
  } catch {
    return { valid: false, reason: '서명 검증 중 오류가 발생했습니다.' }
  }
}
