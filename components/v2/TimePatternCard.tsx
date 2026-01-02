/**
 * TimePatternCard - 매출 패턴 카드
 */

'use client'

import { TrafficMetrics } from '@/lib/v2/types'
import { MetricCard } from './MetricCard'

interface TimePatternCardProps {
  metrics: TrafficMetrics
  explanation: string
  className?: string
}

export function TimePatternCard({
  metrics,
  explanation,
  className,
}: TimePatternCardProps) {
  const { weekendRatio, peakTime, timePattern } = metrics

  // 패턴 유형 판단
  const isWeekendType = weekendRatio > 0.5
  const weekendPercent = Math.round(weekendRatio * 100)

  // 메인 값
  const mainValue = isWeekendType
    ? `주말형 (주말 ${weekendPercent}%)`
    : peakTime === 'night'
    ? `야간형 (저녁 ${timePattern.night}%)`
    : peakTime === 'morning'
    ? `아침형 (출근 ${timePattern.morning}%)`
    : `낮형 (점심 ${timePattern.day}%)`

  // 레벨 판단
  const level = isWeekendType ? 'medium' : weekendRatio < 0.3 ? 'low' : 'low'
  const levelLabel = isWeekendType ? '주의' : '안정'

  // 확장 콘텐츠
  const expandedContent = (
    <div className="space-y-4 text-sm text-gray-600">
      <div>
        <p className="text-gray-500 mb-2">시간대별 유동 비중</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-gray-50 rounded p-2">
            <p className="text-lg font-bold text-gray-900">{timePattern.morning}%</p>
            <p className="text-xs text-gray-500">아침</p>
          </div>
          <div className="bg-gray-50 rounded p-2">
            <p className="text-lg font-bold text-gray-900">{timePattern.day}%</p>
            <p className="text-xs text-gray-500">낮</p>
          </div>
          <div className="bg-gray-50 rounded p-2">
            <p className="text-lg font-bold text-gray-900">{timePattern.night}%</p>
            <p className="text-xs text-gray-500">저녁</p>
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-2 border-t border-gray-100">
        <span>주말 비중</span>
        <span className="font-medium text-gray-900">{weekendPercent}%</span>
      </div>

      <p className="text-xs text-gray-400">
        * 주말 비중 50% 이상: 주말형 (평일 매출 방어 필요)
      </p>
    </div>
  )

  return (
    <MetricCard
      title="매출 패턴"
      icon="⏰"
      mainValue={mainValue}
      level={level}
      levelLabel={levelLabel}
      explanation={explanation}
      expandedContent={expandedContent}
      className={className}
    />
  )
}
