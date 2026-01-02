/**
 * RiskScoreHero - 리스크 점수 히어로 섹션
 * 10초 판단을 위한 핵심 정보 표시
 */

'use client'

import { cn } from '@/lib/utils'
import { RiskLevelBadge } from './LevelBadge'
import { RiskLevel, AreaType, AREA_TYPE_INFO } from '@/lib/v2/types'

interface RiskScoreHeroProps {
  // 위치 정보
  address: string
  district: string
  categoryName: string
  // 분석 결과
  riskScore: number
  riskLevel: RiskLevel
  areaType: AreaType
  // 해석
  summary: string
  topFactors: {
    risks: string[]
    opportunities: string[]
  }
  // 데이터 품질
  dataQuality: {
    storeDataAge: string
    trafficDataAge: string
    coverage: 'high' | 'medium' | 'low'
  }
  className?: string
}

const COVERAGE_LABELS = {
  high: '높음',
  medium: '보통',
  low: '낮음',
}

export function RiskScoreHero({
  address,
  district,
  categoryName,
  riskScore,
  riskLevel,
  areaType,
  summary,
  topFactors,
  dataQuality,
  className,
}: RiskScoreHeroProps) {
  const areaTypeInfo = AREA_TYPE_INFO[areaType]

  // 점수에 따른 게이지 색상
  const getScoreColor = (score: number) => {
    if (score < 30) return 'bg-green-500'
    if (score < 50) return 'bg-yellow-500'
    if (score < 70) return 'bg-orange-500'
    return 'bg-red-500'
  }

  return (
    <div
      className={cn(
        'rounded-2xl bg-white shadow-lg border border-gray-100 overflow-hidden',
        className
      )}
    >
      {/* 상단: 위치 정보 */}
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">📍</span>
            <span className="font-medium text-gray-900">{district}</span>
            <span className="text-gray-400">·</span>
            <span className="text-gray-600">{categoryName}</span>
          </div>
          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
            {areaTypeInfo.name}
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-1">{address}</p>
      </div>

      {/* 중앙: 점수 */}
      <div className="px-6 py-8 text-center">
        {/* 점수 숫자 */}
        <div className="mb-4">
          <span className="text-6xl font-bold text-gray-900">{riskScore}</span>
          <p className="text-sm text-gray-500 mt-1">리스크 점수</p>
        </div>

        {/* 게이지 바 */}
        <div className="max-w-xs mx-auto mb-4">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', getScoreColor(riskScore))}
              style={{ width: `${riskScore}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>안전</span>
            <span>위험</span>
          </div>
        </div>

        {/* 레벨 뱃지 */}
        <RiskLevelBadge level={riskLevel} className="mb-4" />

        {/* 요약문 */}
        <p className="text-gray-600 max-w-md mx-auto">{summary}</p>
      </div>

      {/* 핵심 요인 칩 */}
      <div className="px-6 pb-6">
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex flex-wrap gap-2 justify-center">
            {/* 리스크 요인 */}
            {topFactors.risks.map((risk, i) => (
              <span
                key={`risk-${i}`}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm bg-red-50 text-red-700 border border-red-100"
              >
                <span>🔴</span>
                <span>{risk}</span>
              </span>
            ))}
            {/* 기회 요인 */}
            {topFactors.opportunities.map((opp, i) => (
              <span
                key={`opp-${i}`}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm bg-green-50 text-green-700 border border-green-100"
              >
                <span>🟢</span>
                <span>{opp}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 하단: 신뢰도 */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
        <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
          <span>신뢰도: {COVERAGE_LABELS[dataQuality.coverage]}</span>
          <span className="text-gray-300">|</span>
          <span>데이터: {dataQuality.storeDataAge}</span>
        </div>
      </div>
    </div>
  )
}
