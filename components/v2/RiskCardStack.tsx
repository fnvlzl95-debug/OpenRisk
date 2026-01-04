'use client'

/**
 * 리스크 카드 슬라이더 컴포넌트
 *
 * Top 3 핵심 리스크를 가로 슬라이드로 표시
 * 구조: 레드플래그 → 경고 → 근거 뱃지 → 현장 확인 질문
 *
 * 다크 테마 지원
 */

import { useState } from 'react'
import type { RiskCard, RiskSeverity, EvidenceBadge } from '@/lib/v2/types'

// ===== 스타일 상수 (다크 테마) =====

const SEVERITY_STYLES: Record<RiskSeverity, {
  border: string
  bg: string
  flagBg: string
  flagText: string
  icon: string
}> = {
  critical: {
    border: 'border-red-500/60',
    bg: 'bg-red-950/30',
    flagBg: 'bg-red-500',
    flagText: 'text-white',
    icon: '🔴',
  },
  warning: {
    border: 'border-amber-500/60',
    bg: 'bg-amber-950/30',
    flagBg: 'bg-amber-500',
    flagText: 'text-white',
    icon: '🟡',
  },
  caution: {
    border: 'border-slate-500/60',
    bg: 'bg-slate-800/30',
    flagBg: 'bg-slate-600',
    flagText: 'text-white',
    icon: '⚪',
  },
}

const BADGE_STYLES: Record<EvidenceBadge['type'], string> = {
  metric: 'bg-white/10 text-white/80',
  data: 'bg-blue-500/20 text-blue-300',
  trend: 'bg-purple-500/20 text-purple-300',
}

// ===== 개별 카드 컴포넌트 =====

interface RiskCardItemProps {
  card: RiskCard
  index: number
}

function RiskCardItem({ card, index }: RiskCardItemProps) {
  const styles = SEVERITY_STYLES[card.severity]

  return (
    <div
      className={`
        rounded-xl border ${styles.border} ${styles.bg}
        overflow-hidden transition-all duration-200
        hover:border-opacity-100
      `}
    >
      {/* 헤더: 레드플래그 타이틀 */}
      <div className={`${styles.flagBg} ${styles.flagText} px-3 py-2 flex items-center gap-2`}>
        <span className="text-sm">{styles.icon}</span>
        <span className="font-bold text-xs">#{index + 1}</span>
        <span className="font-bold text-sm">{card.flag}</span>
      </div>

      {/* 본문 */}
      <div className="p-3 space-y-2.5">
        {/* 경고 메시지 */}
        <p className="text-white/90 font-medium text-sm leading-relaxed">
          {card.warning}
        </p>

        {/* 근거 뱃지 */}
        <div className="flex flex-wrap gap-1.5">
          {card.evidenceBadges.map((badge, i) => (
            <span
              key={i}
              className={`
                px-2 py-0.5 rounded-full text-[10px] font-medium
                ${BADGE_STYLES[badge.type]}
              `}
            >
              {badge.label}
            </span>
          ))}
        </div>

        {/* 현장 확인 질문 */}
        <div className="bg-white/5 rounded-lg p-2.5 border border-white/10">
          <p className="text-white/70 text-xs leading-relaxed">
            {card.fieldQuestion}
          </p>
        </div>
      </div>
    </div>
  )
}

// ===== 메인 스택 컴포넌트 =====

interface RiskCardStackProps {
  cards: RiskCard[]
  title?: string
  className?: string
}

export default function RiskCardStack({
  cards,
  title = '핵심 리스크',
  className = '',
}: RiskCardStackProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  if (cards.length === 0) {
    return (
      <div className={`bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-4 text-center ${className}`}>
        <span className="text-xl mb-2 block">✅</span>
        <p className="text-emerald-400 font-medium text-sm">
          주요 리스크가 발견되지 않았습니다
        </p>
        <p className="text-emerald-400/60 text-xs mt-1">
          그래도 현장 확인은 필수입니다
        </p>
      </div>
    )
  }

  // 심각도별 카운트
  const criticalCount = cards.filter(c => c.severity === 'critical').length
  const warningCount = cards.filter(c => c.severity === 'warning').length

  const goTo = (index: number) => {
    if (index >= 0 && index < cards.length) {
      setCurrentIndex(index)
    }
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">
          {title}
          <span className="text-white/40 font-normal text-xs ml-2">
            {currentIndex + 1} / {cards.length}
          </span>
        </h3>

        {/* 심각도 요약 */}
        <div className="flex items-center gap-2 text-xs">
          {criticalCount > 0 && (
            <span className="flex items-center gap-1 text-red-400 font-medium">
              🔴 {criticalCount}
            </span>
          )}
          {warningCount > 0 && (
            <span className="flex items-center gap-1 text-amber-400 font-medium">
              🟡 {warningCount}
            </span>
          )}
        </div>
      </div>

      {/* 슬라이더 영역 */}
      <div className="relative overflow-hidden">
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {cards.map((card, index) => (
            <div key={card.id} className="w-full flex-shrink-0">
              <RiskCardItem card={card} index={index} />
            </div>
          ))}
        </div>
      </div>

      {/* 네비게이션 */}
      <div className="flex items-center justify-between">
        {/* 좌우 버튼 */}
        <div className="flex gap-2">
          <button
            onClick={() => goTo(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            ←
          </button>
          <button
            onClick={() => goTo(currentIndex + 1)}
            disabled={currentIndex === cards.length - 1}
            className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            →
          </button>
        </div>

        {/* 도트 인디케이터 */}
        <div className="flex gap-1.5">
          {cards.map((card, index) => {
            const styles = SEVERITY_STYLES[card.severity]
            return (
              <button
                key={card.id}
                onClick={() => goTo(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex
                    ? `${styles.flagBg} scale-125`
                    : 'bg-white/20 hover:bg-white/40'
                }`}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ===== 간단 버전 (한 줄 리스트) =====

interface RiskCardCompactProps {
  cards: RiskCard[]
}

export function RiskCardCompact({ cards }: RiskCardCompactProps) {
  if (cards.length === 0) return null

  return (
    <div className="space-y-1.5">
      {cards.slice(0, 3).map((card) => {
        const styles = SEVERITY_STYLES[card.severity]
        return (
          <div
            key={card.id}
            className={`
              flex items-center gap-2 p-2 rounded-lg
              ${styles.bg} border ${styles.border}
            `}
          >
            <span className="text-sm">{styles.icon}</span>
            <div className="flex-1 min-w-0">
              <span className="font-bold text-xs text-white">{card.flag}</span>
              <span className="text-white/60 text-xs ml-2 truncate">{card.warning}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
