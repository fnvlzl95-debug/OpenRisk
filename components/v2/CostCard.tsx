/**
 * CostCard - 임대료 카드
 */

'use client'

import { CostMetrics } from '@/lib/v2/types'
import { MetricCard } from './MetricCard'

interface CostCardProps {
  metrics: CostMetrics
  explanation: string
  className?: string
}

export function CostCard({
  metrics,
  explanation,
  className,
}: CostCardProps) {
  const { avgRent, level, districtAvg } = metrics

  // 구 평균 대비 계산
  let comparison: string | undefined
  if (districtAvg && districtAvg > 0) {
    const diff = ((avgRent - districtAvg) / districtAvg) * 100
    if (Math.abs(diff) > 5) {
      comparison = `구 평균 ${diff > 0 ? '+' : ''}${Math.round(diff)}%`
    } else {
      comparison = '구 평균 수준'
    }
  }

  // 레벨 라벨
  const levelLabel = {
    low: '저렴',
    medium: '보통',
    high: '높음',
  }[level]

  // 손익분기 추정 (간단한 공식)
  // 임대료 * 10평 기준 월세 / 30일 = 일매출 필요
  const estimatedMinSales = Math.round((avgRent * 10) / 30)

  // 확장 콘텐츠
  const expandedContent = (
    <div className="space-y-3 text-sm text-gray-600">
      <div className="flex justify-between">
        <span>평균 임대료</span>
        <span className="font-medium text-gray-900">{avgRent}만원/평</span>
      </div>
      {districtAvg && (
        <div className="flex justify-between">
          <span>구 평균</span>
          <span className="font-medium text-gray-900">{districtAvg}만원/평</span>
        </div>
      )}
      <div className="flex justify-between items-center pt-2 border-t border-gray-100">
        <span className="flex items-center gap-1">
          <span>💡</span>
          <span>최소 일매출 목표</span>
        </span>
        <span className="font-medium text-gray-900">~{estimatedMinSales}만원</span>
      </div>
      <p className="text-xs text-gray-400">
        * 10평 기준, 임대료 충당 목표 (인건비/재료비 별도)
      </p>
    </div>
  )

  return (
    <MetricCard
      title="임대료"
      icon="💰"
      mainValue={avgRent}
      mainUnit="만원/평"
      level={level}
      levelLabel={levelLabel}
      comparison={comparison}
      explanation={explanation}
      expandedContent={expandedContent}
      className={className}
    />
  )
}
