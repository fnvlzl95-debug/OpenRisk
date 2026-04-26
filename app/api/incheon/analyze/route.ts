import { NextRequest, NextResponse } from 'next/server'
import { BUSINESS_CATEGORIES, getCategoryName, type BusinessCategory } from '@/lib/categories'
import {
  INCHEON_BOUNDS,
  INCHEON_DATA_POLICY,
  INCHEON_H3_RESOLUTION,
  INCHEON_PRODUCT_MODE,
  INCHEON_RADIUS_METERS,
} from '@/lib/incheon/constants'
import { buildDataQuality } from '@/lib/incheon/data-quality'
import { buildIncheonLifeDNA } from '@/lib/incheon/life-dna'
import { calculateIncheonRisk, buildIncheonRiskCards } from '@/lib/incheon/scoring'
import { assertPublicDataOnlySources, getIncheonPublicDataSources } from '@/lib/incheon/source-policy'
import type { IncheonAnalyzeRequest, IncheonAnalyzeResponse, IncheonLifestyleCard } from '@/lib/incheon/types'

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isIncheonCoord(lat: number, lng: number) {
  return (
    lat >= INCHEON_BOUNDS.latMin &&
    lat <= INCHEON_BOUNDS.latMax &&
    lng >= INCHEON_BOUNDS.lngMin &&
    lng <= INCHEON_BOUNDS.lngMax
  )
}

function isBusinessCategory(value: unknown): value is BusinessCategory {
  return typeof value === 'string' && value in BUSINESS_CATEGORIES
}

function buildLifestyleCards(lifeDNA: IncheonAnalyzeResponse['lifeDNA']): IncheonLifestyleCard[] {
  return [
    {
      title: '교육·가족 생활권 신호',
      body: lifeDNA.educationFamily.summary,
      evidence: lifeDNA.educationFamily.evidence,
      cautions: lifeDNA.educationFamily.cautions,
      metricKey: 'educationFamily',
    },
    {
      title: '교통 접근 기반 유입 신호',
      body: lifeDNA.transitAccess.summary,
      evidence: lifeDNA.transitAccess.evidence,
      cautions: lifeDNA.transitAccess.cautions,
      metricKey: 'transitAccess',
    },
    {
      title: '동종업종 밀집 구조',
      body: lifeDNA.categoryDensity.summary,
      evidence: lifeDNA.categoryDensity.evidence,
      cautions: lifeDNA.categoryDensity.cautions,
      metricKey: 'categoryDensity',
    },
    {
      title: '비용 압박 참고',
      body: lifeDNA.costPressure.summary,
      evidence: lifeDNA.costPressure.evidence,
      cautions: lifeDNA.costPressure.cautions,
      metricKey: 'costPressure',
    },
  ]
}

export async function POST(request: NextRequest) {
  let body: Partial<IncheonAnalyzeRequest>

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '요청 본문이 올바른 JSON이어야 합니다.' }, { status: 400 })
  }

  const { lat, lng, targetCategory } = body

  if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) {
    return NextResponse.json({ error: 'lat, lng는 숫자여야 합니다.' }, { status: 400 })
  }

  if (!isIncheonCoord(lat, lng)) {
    return NextResponse.json({ error: 'OpenRisk Incheon은 인천 지역 좌표만 분석합니다.' }, { status: 422 })
  }

  if (!isBusinessCategory(targetCategory)) {
    return NextResponse.json({ error: '지원하지 않는 업종입니다.' }, { status: 400 })
  }

  const riskWithSignals = calculateIncheonRisk({
    lat,
    lng,
    category: targetCategory,
    costDataAvailable: true,
  })
  const { signals, ...risk } = riskWithSignals
  const lifeDNA = buildIncheonLifeDNA({
    lat,
    lng,
    category: targetCategory,
    sameCategoryCount: signals.sameCategoryCount,
    totalStores: signals.totalStores,
    transitScore: signals.transitScore,
    costScore: signals.costScore,
  })
  const dataQuality = buildDataQuality(lifeDNA)
  const sources = getIncheonPublicDataSources().filter((source) =>
    [
      'store-small-business',
      'incheon-bus-stops',
      'incheon-bus-ridership',
      'incheon-subway-ridership',
      'school-location-standard',
      'incheon-school-status',
      'childcare-basic',
      'resident-age-admin-dong',
      'reb-small-rent',
      'reb-small-vacancy',
      'admin-boundaries',
    ].includes(source.sourceId)
  )

  assertPublicDataOnlySources(sources)

  const response: IncheonAnalyzeResponse = {
    productMode: INCHEON_PRODUCT_MODE,
    dataPolicy: INCHEON_DATA_POLICY,
    location: {
      lat,
      lng,
      label: '인천 분석 중심 위치',
      radiusMeters: INCHEON_RADIUS_METERS,
      h3Resolution: INCHEON_H3_RESOLUTION,
    },
    category: {
      key: targetCategory,
      name: getCategoryName(targetCategory),
    },
    risk,
    lifeDNA,
    cards: {
      riskTop3: buildIncheonRiskCards({
        category: targetCategory,
        risk,
        sameCategoryCount: signals.sameCategoryCount,
        costScore: signals.costScore,
        transitRisk: signals.transitRisk,
      }),
      lifestyle: buildLifestyleCards(lifeDNA),
      fieldChecks: [
        '학교·어린이집에서 점포까지 실제 동선이 이어지는지 확인하세요.',
        '정류장·역에서 점포까지 큰 도로, 횡단보도, 지하도 단절이 있는지 확인하세요.',
        '같은 업종이 같은 고객을 나누는 구조인지 주변 점포 구성을 비교하세요.',
        '공식 통계와 실제 임대 조건의 차이를 임장 단계에서 확인하세요.',
      ],
    },
    dataQuality,
    sources,
    auxiliary: {
      note: '주소 검색이나 AI 요약은 분석 근거와 점수 계산에 포함되지 않습니다.',
    },
  }

  return NextResponse.json(response)
}
