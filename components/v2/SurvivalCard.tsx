/**
 * SurvivalCard - 생존 신호 카드
 * 트렌드 + 등급 중심의 직관적 표현
 */

'use client'

import { SurvivalMetrics } from '@/lib/v2/types'
import { MetricCard } from './MetricCard'

interface SurvivalCardProps {
  metrics: SurvivalMetrics
  explanation?: string
  className?: string
}

export function SurvivalCard({
  metrics,
  explanation,
  className,
}: SurvivalCardProps) {
  const {
    closureRate,
    openingRate,
    netChange,
    risk,
    trend,
    trendLabel,
    riskLabel,
    summary,
  } = metrics

  // 트렌드 방향
  const trendDirection = trend === 'growing' ? 'up' : trend === 'shrinking' ? 'down' : 'stable'

  // 확장 콘텐츠 - 상세 수치
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
      <p className="text-xs text-gray-400 mt-2">
        * 2024.12 → 2025.10 데이터 비교
      </p>
    </div>
  )

  return (
    <MetricCard
      title="상권 트렌드"
      icon="📊"
      mainValue={trendLabel || '📉 점포 감소세'}
      level={risk}
      levelLabel={riskLabel?.replace(/[🟢🟡🔴]\s?/, '') || '보통'}
      explanation={summary || explanation || ''}
      trend={{
        direction: trendDirection,
        label: `폐업 ${closureRate}% · 개업 ${openingRate}%`,
      }}
      expandedContent={expandedContent}
      className={className}
    />
  )
}
