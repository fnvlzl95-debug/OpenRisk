/**
 * SurvivalCard - 생존 신호 카드
 */

'use client'

import { SurvivalMetrics } from '@/lib/v2/types'
import { MetricCard } from './MetricCard'

interface SurvivalCardProps {
  metrics: SurvivalMetrics
  explanation: string
  className?: string
}

export function SurvivalCard({
  metrics,
  explanation,
  className,
}: SurvivalCardProps) {
  const { closureRate, openingRate, netChange, risk } = metrics

  // 메인 값 표시
  const mainValue = `폐업 ${closureRate}%`

  // 순증감 표시
  const netChangeDisplay = netChange > 0
    ? `+${netChange}개 증가`
    : netChange < 0
    ? `${netChange}개 감소`
    : '변동 없음'

  // 트렌드 방향
  const trendDirection = netChange > 0 ? 'up' : netChange < 0 ? 'down' : 'stable'

  // 레벨 라벨
  const levelLabel = {
    low: '안정',
    medium: '보통',
    high: '위험',
  }[risk]

  // 확장 콘텐츠
  const expandedContent = (
    <div className="space-y-3 text-sm text-gray-600">
      <div className="flex justify-between">
        <span>폐업률</span>
        <span className="font-medium text-red-600">{closureRate}%</span>
      </div>
      <div className="flex justify-between">
        <span>개업률</span>
        <span className="font-medium text-green-600">{openingRate}%</span>
      </div>
      <div className="flex justify-between pt-2 border-t border-gray-100">
        <span>순증감</span>
        <span className={`font-medium ${netChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {netChange >= 0 ? '+' : ''}{netChange}개
        </span>
      </div>
      <p className="text-xs text-gray-400">
        * 폐업률 5% 이하: 안정, 10% 이상: 위험
      </p>
    </div>
  )

  return (
    <MetricCard
      title="생존 신호"
      icon="📊"
      mainValue={mainValue}
      mainUnit={`· 개업 ${openingRate}%`}
      level={risk}
      levelLabel={levelLabel}
      comparison={`순증감 ${netChangeDisplay}`}
      explanation={explanation}
      trend={{
        direction: trendDirection,
        label: netChangeDisplay,
      }}
      expandedContent={expandedContent}
      className={className}
    />
  )
}
