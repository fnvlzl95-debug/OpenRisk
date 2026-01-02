/**
 * AreaTypeCard - 상권 성격 카드
 */

'use client'

import { AreaType, AREA_TYPE_INFO } from '@/lib/v2/types'
import { cn } from '@/lib/utils'

interface AreaTypeCardProps {
  areaType: AreaType
  explanation: string
  className?: string
}

const AREA_TYPE_DETAILS: Record<AreaType, {
  icon: string
  tags: string[]
  color: string
  bgColor: string
}> = {
  'A_주거': {
    icon: '🏠',
    tags: ['단골 위주', '안정적', '저녁 수요'],
    color: 'text-green-700',
    bgColor: 'bg-green-50',
  },
  'B_혼합': {
    icon: '🏢',
    tags: ['직주 혼합', '시간대별 상이', '다양한 고객'],
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
  },
  'C_상업': {
    icon: '🏬',
    tags: ['유입↑', '회전↑', '경쟁↑'],
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
  },
  'D_특수': {
    icon: '🎯',
    tags: ['핫플/관광', '시즌 의존', '변동성↑'],
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
  },
}

export function AreaTypeCard({
  areaType,
  explanation,
  className,
}: AreaTypeCardProps) {
  const info = AREA_TYPE_INFO[areaType]
  const details = AREA_TYPE_DETAILS[areaType]

  return (
    <div
      className={cn(
        'rounded-xl border border-gray-200 bg-white p-4 shadow-sm',
        className
      )}
    >
      {/* 헤더 */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
        <span className="text-lg">🗺️</span>
        <span className="font-medium">상권 성격</span>
      </div>

      {/* 상권 유형 */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl">{details.icon}</span>
        <div>
          <p className={cn('text-xl font-bold', details.color)}>
            {info.name}
          </p>
          <p className="text-sm text-gray-500">{info.description}</p>
        </div>
      </div>

      {/* 특성 태그 */}
      <div className="flex flex-wrap gap-2 mb-3">
        {details.tags.map((tag, i) => (
          <span
            key={i}
            className={cn(
              'px-2 py-1 rounded text-xs font-medium',
              details.bgColor,
              details.color
            )}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* 해석 */}
      <p className="text-sm text-gray-600 leading-relaxed">
        {explanation}
      </p>
    </div>
  )
}
