/**
 * AnchorCard - 유입 시설 카드
 */

'use client'

import { AnchorMetrics } from '@/lib/v2/types'
import { cn } from '@/lib/utils'

interface AnchorCardProps {
  anchors: AnchorMetrics
  explanation: string
  className?: string
}

export function AnchorCard({
  anchors,
  explanation,
  className,
}: AnchorCardProps) {
  const { subway, starbucks, mart, department, hasAnyAnchor } = anchors

  // 앵커 아이템 구성
  const items = [
    subway && {
      icon: '🚇',
      name: `${subway.name}역`,
      distance: subway.distance,
      effect: '통근 유입',
      isGood: subway.distance <= 300,
    },
    starbucks && {
      icon: '☕',
      name: `스타벅스 ${starbucks.count}개`,
      distance: starbucks.distance,
      effect: '상권 활성화',
      isGood: starbucks.count >= 2,
    },
    mart && {
      icon: '🛒',
      name: mart.name,
      distance: mart.distance,
      effect: '목적형 방문',
      isGood: mart.distance <= 1000,
    },
    department && {
      icon: '🏬',
      name: department.name,
      distance: department.distance,
      effect: '프리미엄 유입',
      isGood: department.distance <= 500,
    },
  ].filter(Boolean) as Array<{
    icon: string
    name: string
    distance: number
    effect: string
    isGood: boolean
  }>

  return (
    <div
      className={cn(
        'rounded-xl border border-gray-200 bg-white p-4 shadow-sm',
        className
      )}
    >
      {/* 헤더 */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
        <span className="text-lg">🏢</span>
        <span className="font-medium">유입 시설</span>
      </div>

      {/* 앵커 리스트 */}
      {hasAnyAnchor ? (
        <div className="space-y-3 mb-3">
          {items.map((item, i) => (
            <div
              key={i}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{item.icon}</span>
                <span className="font-medium text-gray-900">{item.name}</span>
                <span className="text-sm text-gray-400">{item.distance}m</span>
              </div>
              <span
                className={cn(
                  'text-xs px-2 py-0.5 rounded',
                  item.isGood
                    ? 'bg-green-50 text-green-700'
                    : 'bg-gray-50 text-gray-500'
                )}
              >
                {item.effect}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-4 text-center text-gray-400 mb-3">
          <span className="text-2xl mb-2 block">🚫</span>
          <p className="text-sm">주요 앵커 시설 없음</p>
        </div>
      )}

      {/* 해석 */}
      <p className="text-sm text-gray-600 leading-relaxed pt-3 border-t border-gray-100">
        {explanation}
      </p>
    </div>
  )
}
