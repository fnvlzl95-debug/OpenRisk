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
import { calculateActualIncheonRisk, IncheonDatasetNotReadyError } from '@/lib/incheon/data-repository'
import { buildIncheonLifeDNA } from '@/lib/incheon/life-dna'
import { buildIncheonRiskCards } from '@/lib/incheon/scoring'
import { assertPublicDataOnlySources, getIncheonPublicDataSources } from '@/lib/incheon/source-policy'
import type { IncheonAnalyzeRequest, IncheonAnalyzeResponse, IncheonLifestyleCard } from '@/lib/incheon/types'

export const runtime = 'nodejs'

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
      title: '교육·가족 중심의 동네',
      body: lifeDNA.educationFamily.summary,
      evidence: lifeDNA.educationFamily.evidence,
      cautions: lifeDNA.educationFamily.cautions,
      metricKey: 'educationFamily',
    },
    {
      title: '고객 방문 불편 정도',
      body: lifeDNA.transitAccess.summary,
      evidence: lifeDNA.transitAccess.evidence,
      cautions: lifeDNA.transitAccess.cautions,
      metricKey: 'transitAccess',
    },
    {
      title: '주변 매장들과의 경쟁',
      body: lifeDNA.categoryDensity.summary,
      evidence: lifeDNA.categoryDensity.evidence,
      cautions: lifeDNA.categoryDensity.cautions,
      metricKey: 'categoryDensity',
    },
    {
      title: '비용 부담 참고',
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
    return NextResponse.json({ error: '데이터 요청 형식이 잘못되었습니다. (관리자에게 문의하세요)' }, { status: 400 })
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

  let actual
  try {
    actual = calculateActualIncheonRisk({ lat, lng, category: targetCategory })
  } catch (error) {
    if (error instanceof IncheonDatasetNotReadyError) {
      return NextResponse.json(
        {
          code: 'DATASET_NOT_READY',
          error: '인천 지역 데이터를 최신화하고 있습니다. 잠시 후 다시 시도해 주세요.',
          missingDatasets: error.missingDatasets,
          expectedFiles: [
            'data/openrisk-incheon/processed/h3-store-counts/store-counts-h3.json',
            'data/openrisk-incheon/processed/h3-transit/transit-h3.json',
          ],
        },
        { status: 503 }
      )
    }
    throw error
  }

  const { risk, signals, riskMapCells } = actual
  const lifeDNA = buildIncheonLifeDNA({
    lat,
    lng,
    category: targetCategory,
    sameCategoryCount: signals.sameCategoryCount,
    totalStores: signals.totalStores,
    transitScore: signals.transitAccessScore,
    costScore: signals.costScore,
    actualSignals: signals,
  })
  const dataQuality = buildDataQuality(lifeDNA)
  const responseSourceIds = Array.from(
    new Set([
      ...signals.sourceIds,
      ...(riskMapCells.some((cell) => cell.status === 'masked') ? ['osm-noncommercial-mask'] : []),
    ])
  )
  const sources = getIncheonPublicDataSources().filter((source) => responseSourceIds.includes(source.sourceId))

  assertPublicDataOnlySources(sources)

  const response: IncheonAnalyzeResponse = {
    productMode: INCHEON_PRODUCT_MODE,
    dataPolicy: INCHEON_DATA_POLICY,
    location: {
      lat,
      lng,
      label: '인천 분석 기준점',
      radiusMeters: INCHEON_RADIUS_METERS,
      h3Resolution: INCHEON_H3_RESOLUTION,
    },
    category: {
      key: targetCategory,
      name: getCategoryName(targetCategory),
    },
    risk,
    riskMapCells,
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
        '학교나 어린이집에서 매장까지 걸어오는 길이 자연스럽게 이어지는지 걸어보세요.',
        '정류장이나 역에서 올 때, 큰 도로나 지하도로 인해 길이 끊기거나 돌아가야 하는지 확인하세요.',
        '주변 경쟁 매장들이 내 타겟 고객층과 겹치는지, 그 매장들의 장단점은 무엇인지 비교해 보세요.',
        '공식 통계와 실제 임대 조건의 차이가 비용 부담으로 이어지는지 확인하세요.',
      ],
    },
    dataQuality,
    sources,
    auxiliary: {
      note: '주소 검색과 요약은 이해를 돕기 위한 기능이며, 실제 위험도 점수는 신뢰할 수 있는 공공데이터만으로 계산됩니다.',
      datasetGeneratedAt: signals.generatedAt,
      missingOptionalDatasets: signals.missingOptionalDatasets,
    },
  }

  return NextResponse.json(response)
}
