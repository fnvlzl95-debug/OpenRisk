/**
 * LevelBadge - 레벨 표시 뱃지 컴포넌트
 * 리스크/지표 레벨을 시각적으로 표시
 */

'use client'

import { cn } from '@/lib/utils'

export type BadgeLevel = 'low' | 'medium' | 'high' | 'very_high'
export type BadgeVariant = 'default' | 'outline' | 'subtle'

interface LevelBadgeProps {
  level: BadgeLevel | string
  label?: string
  variant?: BadgeVariant
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const LEVEL_CONFIG: Record<BadgeLevel, { color: string; bgColor: string; borderColor: string; icon: string }> = {
  low: {
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    icon: '🟢',
  },
  medium: {
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    icon: '🟡',
  },
  high: {
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    icon: '🟠',
  },
  very_high: {
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: '🔴',
  },
}

const LEVEL_LABELS: Record<BadgeLevel, string> = {
  low: '낮음',
  medium: '보통',
  high: '높음',
  very_high: '매우 높음',
}

const SIZE_CLASSES = {
  sm: 'text-xs px-1.5 py-0.5',
  md: 'text-sm px-2 py-1',
  lg: 'text-base px-3 py-1.5',
}

export function LevelBadge({
  level,
  label,
  variant = 'default',
  size = 'md',
  className,
}: LevelBadgeProps) {
  // 레벨 정규화
  const normalizedLevel = normalizeLevel(level)
  const config = LEVEL_CONFIG[normalizedLevel]
  const displayLabel = label || LEVEL_LABELS[normalizedLevel]

  const variantClasses = {
    default: cn(config.bgColor, config.color),
    outline: cn('bg-transparent border', config.borderColor, config.color),
    subtle: cn('bg-gray-50', config.color),
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        SIZE_CLASSES[size],
        variantClasses[variant],
        className
      )}
    >
      <span>{config.icon}</span>
      <span>{displayLabel}</span>
    </span>
  )
}

/**
 * 리스크 레벨 뱃지 (LOW/MEDIUM/HIGH/VERY_HIGH용)
 */
export function RiskLevelBadge({
  level,
  className,
}: {
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH'
  className?: string
}) {
  const levelMap: Record<string, BadgeLevel> = {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    VERY_HIGH: 'very_high',
  }

  const labelMap: Record<string, string> = {
    LOW: '안전',
    MEDIUM: '주의',
    HIGH: '위험',
    VERY_HIGH: '매우 위험',
  }

  return (
    <LevelBadge
      level={levelMap[level]}
      label={labelMap[level]}
      size="lg"
      className={className}
    />
  )
}

/**
 * 문자열 레벨을 정규화
 */
function normalizeLevel(level: string): BadgeLevel {
  const normalized = level.toLowerCase().replace('_', '')

  if (normalized === 'verylow' || normalized === 'very_low') return 'low'
  if (normalized === 'veryhigh' || normalized === 'very_high') return 'very_high'
  if (normalized === 'low') return 'low'
  if (normalized === 'medium') return 'medium'
  if (normalized === 'high') return 'high'

  return 'medium' // 기본값
}
