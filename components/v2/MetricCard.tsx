/**
 * MetricCard - 공통 카드 래퍼 컴포넌트
 * 3줄 공식: (1) 핵심값 (2) 레벨+판정 (3) 초보용 해석
 */

'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LevelBadge, BadgeLevel } from './LevelBadge'

interface MetricCardProps {
  title: string
  icon?: React.ReactNode
  // 핵심 값 (1줄)
  mainValue: string | number
  mainUnit?: string
  // 레벨 + 판정 (2줄)
  level: BadgeLevel | string
  levelLabel?: string
  comparison?: string  // "구 평균 +25%", "상위 15%"
  // 초보용 해석 (3줄)
  explanation: string
  // 트렌드 (선택)
  trend?: {
    direction: 'up' | 'down' | 'stable'
    label: string  // "+3개 (증가세)"
  }
  // 확장 콘텐츠
  expandedContent?: React.ReactNode
  // 스타일
  className?: string
}

export function MetricCard({
  title,
  icon,
  mainValue,
  mainUnit,
  level,
  levelLabel,
  comparison,
  explanation,
  trend,
  expandedContent,
  className,
}: MetricCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const trendIcon = trend?.direction === 'up' ? '📈' :
                    trend?.direction === 'down' ? '📉' : '➡️'

  return (
    <div
      className={cn(
        'rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all',
        'hover:shadow-md',
        className
      )}
    >
      {/* 헤더 */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
        {icon && <span className="text-lg">{icon}</span>}
        <span className="font-medium">{title}</span>
      </div>

      {/* 1줄: 핵심 값 */}
      <div className="text-2xl font-bold text-gray-900 mb-2">
        {mainValue}
        {mainUnit && (
          <span className="text-base font-normal text-gray-500 ml-1">
            {mainUnit}
          </span>
        )}
      </div>

      {/* 2줄: 레벨 + 비교 */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <LevelBadge level={level} label={levelLabel} size="sm" />
        {comparison && (
          <span className="text-sm text-gray-500">· {comparison}</span>
        )}
      </div>

      {/* 3줄: 초보용 해석 */}
      <p className="text-sm text-gray-600 leading-relaxed">
        {explanation}
      </p>

      {/* 트렌드 (선택) */}
      {trend && (
        <div className="mt-3 text-sm text-gray-500 flex items-center gap-1">
          <span>{trendIcon}</span>
          <span>{trend.label}</span>
        </div>
      )}

      {/* 확장 버튼 */}
      {expandedContent && (
        <>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-4 w-full flex items-center justify-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            <span>{isExpanded ? '접기' : '자세히'}</span>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {/* 확장 콘텐츠 */}
          {isExpanded && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              {expandedContent}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/**
 * 간단한 카드 (확장 없음)
 */
export function SimpleMetricCard({
  title,
  icon,
  mainValue,
  mainUnit,
  level,
  levelLabel,
  comparison,
  explanation,
  className,
}: Omit<MetricCardProps, 'expandedContent'>) {
  return (
    <MetricCard
      title={title}
      icon={icon}
      mainValue={mainValue}
      mainUnit={mainUnit}
      level={level}
      levelLabel={levelLabel}
      comparison={comparison}
      explanation={explanation}
      className={className}
    />
  )
}
