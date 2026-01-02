/**
 * TrafficCard - 유동인구 카드
 */

'use client'

import { TrafficMetrics } from '@/lib/v2/types'
import { MetricCard } from './MetricCard'
import { cn } from '@/lib/utils'

interface TrafficCardProps {
  metrics: TrafficMetrics
  explanation: string
  className?: string
}

const PEAK_TIME_LABELS = {
  morning: '06-11시',
  day: '11-17시',
  night: '17-23시',
}

export function TrafficCard({
  metrics,
  explanation,
  className,
}: TrafficCardProps) {
  const { index, level, timePattern, peakTime, weekendRatio } = metrics

  // 유동인구 표시 형식
  const displayValue = index >= 10000
    ? `${(index / 10000).toFixed(1)}만`
    : index >= 1000
    ? `${(index / 1000).toFixed(1)}천`
    : `${index}`

  // 레벨 라벨 매핑
  const levelLabel = {
    very_low: '매우 낮음',
    low: '낮음',
    medium: '보통',
    high: '높음',
    very_high: '매우 높음',
  }[level]

  // 확장 콘텐츠
  const expandedContent = (
    <div className="space-y-4 text-sm">
      {/* 시간대별 분포 바 */}
      <div>
        <p className="text-gray-500 mb-2">시간대별 분포</p>
        <div className="flex items-end gap-1 h-12">
          <TimeBar label="아침" value={timePattern.morning} isActive={peakTime === 'morning'} />
          <TimeBar label="낮" value={timePattern.day} isActive={peakTime === 'day'} />
          <TimeBar label="저녁" value={timePattern.night} isActive={peakTime === 'night'} />
        </div>
      </div>

      <div className="flex justify-between text-gray-600">
        <span>피크 시간대</span>
        <span className="font-medium text-gray-900">{PEAK_TIME_LABELS[peakTime]}</span>
      </div>

      <div className="flex justify-between text-gray-600">
        <span>주말 비중</span>
        <span className="font-medium text-gray-900">{Math.round(weekendRatio * 100)}%</span>
      </div>

      <p className="text-xs text-gray-400 pt-2 border-t border-gray-100">
        * 유동인구 5천 미만: 낮음, 3만 이상: 매우 높음
      </p>
    </div>
  )

  return (
    <MetricCard
      title="유동인구"
      icon="🚶"
      mainValue={displayValue}
      level={level === 'very_low' ? 'low' : level === 'very_high' ? 'high' : level}
      levelLabel={levelLabel}
      comparison={`피크: ${PEAK_TIME_LABELS[peakTime]}`}
      explanation={explanation}
      expandedContent={expandedContent}
      className={className}
    />
  )
}

function TimeBar({
  label,
  value,
  isActive,
}: {
  label: string
  value: number
  isActive: boolean
}) {
  const height = Math.max(20, Math.min(100, value))

  return (
    <div className="flex-1 flex flex-col items-center">
      <div
        className={cn(
          'w-full rounded-t transition-all',
          isActive ? 'bg-blue-500' : 'bg-gray-200'
        )}
        style={{ height: `${height}%` }}
      />
      <span className="text-xs text-gray-500 mt-1">{label}</span>
    </div>
  )
}
