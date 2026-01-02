/**
 * CompetitionCard - 경쟁 밀도 카드
 */

'use client'

import { CompetitionMetrics } from '@/lib/v2/types'
import { MetricCard } from './MetricCard'

interface CompetitionCardProps {
  metrics: CompetitionMetrics
  categoryName: string
  explanation: string
  className?: string
}

export function CompetitionCard({
  metrics,
  categoryName,
  explanation,
  className,
}: CompetitionCardProps) {
  const { sameCategory, total, densityLevel } = metrics

  // 비교 문구 생성
  const comparison = total > 0
    ? `전체 ${total}개 중`
    : undefined

  // 확장 콘텐츠
  const expandedContent = (
    <div className="space-y-3 text-sm text-gray-600">
      <div className="flex justify-between">
        <span>반경 500m 전체 점포</span>
        <span className="font-medium text-gray-900">{total}개</span>
      </div>
      <div className="flex justify-between">
        <span>동종 업종 ({categoryName})</span>
        <span className="font-medium text-gray-900">{sameCategory}개</span>
      </div>
      <div className="flex justify-between">
        <span>경쟁 밀도</span>
        <span className="font-medium text-gray-900">
          {densityLevel === 'low' ? '낮음' : densityLevel === 'medium' ? '보통' : '높음'}
        </span>
      </div>
      <p className="text-xs text-gray-400 pt-2 border-t border-gray-100">
        * 동종 업종 5개 이하: 낮음, 15개 이상: 높음
      </p>
    </div>
  )

  return (
    <MetricCard
      title="경쟁 밀도"
      icon="🏪"
      mainValue={sameCategory}
      mainUnit={`개 (${categoryName})`}
      level={densityLevel}
      comparison={comparison}
      explanation={explanation}
      expandedContent={expandedContent}
      className={className}
    />
  )
}
