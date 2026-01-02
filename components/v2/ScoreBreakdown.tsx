/**
 * ScoreBreakdown - 점수 기여도 시각화
 * "왜 이 점수인가요?" 섹션
 */

'use client'

import { cn } from '@/lib/utils'
import { InterpretationV2 } from '@/lib/v2/types'

interface ScoreBreakdownProps {
  scoreContribution: InterpretationV2['scoreContribution']
  className?: string
}

const METRIC_LABELS: Record<string, { label: string; icon: string }> = {
  competition: { label: '경쟁', icon: '🏪' },
  cost: { label: '임대료', icon: '💰' },
  survival: { label: '생존율', icon: '📊' },
  traffic: { label: '유동인구', icon: '🚶' },
  anchor: { label: '앵커시설', icon: '🏢' },
  timePattern: { label: '시간대', icon: '⏰' },
}

const IMPACT_ICON: Record<string, string> = {
  positive: '▼', // 리스크 낮춤
  negative: '▲', // 리스크 높임
  neutral: '━',
}

const IMPACT_COLOR: Record<string, string> = {
  positive: 'text-green-600',
  negative: 'text-red-600',
  neutral: 'text-gray-400',
}

export function ScoreBreakdown({ scoreContribution, className }: ScoreBreakdownProps) {
  // 퍼센트 기준 정렬
  const sortedMetrics = Object.entries(scoreContribution).sort(
    ([, a], [, b]) => b.percent - a.percent
  )

  return (
    <div className={cn('rounded-xl border border-gray-200 bg-white p-5', className)}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        왜 이 점수인가요?
      </h3>

      <div className="space-y-3">
        {sortedMetrics.map(([key, value]) => {
          const meta = METRIC_LABELS[key]
          if (!meta) return null

          return (
            <div key={key} className="flex items-center gap-3">
              {/* 라벨 */}
              <div className="w-20 flex items-center gap-1.5 text-sm text-gray-600">
                <span>{meta.icon}</span>
                <span>{meta.label}</span>
              </div>

              {/* 진행 바 */}
              <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden relative">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    value.impact === 'positive' ? 'bg-green-400' :
                    value.impact === 'negative' ? 'bg-red-400' : 'bg-gray-300'
                  )}
                  style={{ width: `${Math.min(value.percent * 4, 100)}%` }}
                />
              </div>

              {/* 퍼센트 + 영향 */}
              <div className="w-16 flex items-center justify-end gap-1 text-sm">
                <span className="text-gray-600">{value.percent}%</span>
                <span className={cn('text-xs font-bold', IMPACT_COLOR[value.impact])}>
                  {IMPACT_ICON[value.impact]}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* 범례 */}
      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="text-green-600 font-bold">▼</span>
          <span>점수 낮춤</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="text-red-600 font-bold">▲</span>
          <span>점수 높임</span>
        </span>
      </div>
    </div>
  )
}
