'use client'

import { useEffect, useRef } from 'react'
import type { AISummaryResponse, KeyMetricItem } from '@/app/api/ai/summary/route'

interface AISummaryModalProps {
  isOpen: boolean
  onClose: () => void
  summary: AISummaryResponse | null
  isLoading: boolean
  error: string | null
  areaName: string
  grade: string
}

// 숫자 포맷팅 헬퍼
function formatMetricValue(value: number | null): string {
  if (value === null || value === undefined) return '-'
  if (value >= 10000) return (value / 10000).toFixed(1) + '만'
  if (value >= 1000) return value.toLocaleString()
  if (value < 1 && value > 0) return (value * 100).toFixed(1) + '%'
  return value.toLocaleString()
}

export default function AISummaryModal({
  isOpen,
  onClose,
  summary,
  isLoading,
  error,
  areaName,
  grade
}: AISummaryModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  // 바깥 클릭으로 닫기
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  if (!isOpen) return null

  const gradeConfig: Record<string, { accent: string; accentBg: string; accentBorder: string }> = {
    A: { accent: 'text-emerald-400', accentBg: 'bg-emerald-500/10', accentBorder: 'border-emerald-500/20' },
    B: { accent: 'text-amber-400', accentBg: 'bg-amber-500/10', accentBorder: 'border-amber-500/20' },
    C: { accent: 'text-rose-400', accentBg: 'bg-rose-500/10', accentBorder: 'border-rose-500/20' },
    D: { accent: 'text-violet-400', accentBg: 'bg-violet-500/10', accentBorder: 'border-violet-500/20' },
  }
  const config = gradeConfig[grade] || gradeConfig.A

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-[#0a0a0b] border border-white/[0.08] shadow-2xl animate-slide-up"
      >
        {/* 헤더 - 미니멀 */}
        <div className="sticky top-0 z-10 px-6 py-4 border-b border-white/[0.06] bg-[#0a0a0b]/95 backdrop-blur-sm flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${config.accent.replace('text-', 'bg-')}`} />
              <span className="text-[10px] font-medium tracking-widest uppercase text-zinc-500">Analysis Report</span>
            </div>
            <h2 className="text-lg font-semibold text-white mt-0.5">{areaName}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-all"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* 스크롤 컨텐츠 */}
        <div className="overflow-y-auto max-h-[calc(90vh-72px)]">
          <div className="p-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-5">
                <div className="relative w-10 h-10">
                  <div className="absolute inset-0 rounded-full border border-zinc-800" />
                  <div className="absolute inset-0 rounded-full border-t border-white/60 animate-spin" />
                </div>
                <div className="text-center">
                  <p className="text-sm text-zinc-300 font-medium">분석 중</p>
                  <p className="text-xs text-zinc-600 mt-1">약 5-10초 소요</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M15 9l-6 6M9 9l6 6"/>
                  </svg>
                </div>
                <p className="text-sm text-rose-400">{error}</p>
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-white/5 text-zinc-400 text-sm hover:bg-white/10 transition-colors"
                >
                  닫기
                </button>
              </div>
            ) : summary ? (
              <div className="space-y-6">

                {/* 한 줄 요약 - Hero */}
                <div className={`p-5 rounded-xl ${config.accentBg} border ${config.accentBorder}`}>
                  <p className={`text-base sm:text-lg font-medium leading-relaxed ${config.accent}`}>
                    {summary.oneLiner}
                  </p>
                </div>

                {/* 상권 구조 해석 */}
                <section>
                  <h3 className="text-[11px] font-semibold tracking-widest uppercase text-zinc-500 mb-3">상권 구조</h3>
                  <p className="text-[15px] text-zinc-300 leading-[1.8]">
                    {summary.structureAnalysis}
                  </p>
                </section>

                {/* 핵심 지표 - 그리드 레이아웃 */}
                {summary.keyMetrics && summary.keyMetrics.length > 0 && (
                  <section>
                    <h3 className="text-[11px] font-semibold tracking-widest uppercase text-zinc-500 mb-3">핵심 지표</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(summary.keyMetrics as KeyMetricItem[]).map((metric, i) => (
                        <div
                          key={metric.key || i}
                          className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-colors"
                        >
                          <div className="flex items-baseline justify-between mb-2">
                            <span className="text-xs text-zinc-500">{metric.label}</span>
                            <span className="text-lg font-semibold text-white tabular-nums">
                              {formatMetricValue(metric.value)}
                            </span>
                          </div>
                          <p className="text-[13px] text-zinc-400 leading-relaxed">
                            {metric.interpretation}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* 리스크 & 확인사항 - 2단 그리드 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 리스크 체크 */}
                  {summary.riskChecks && summary.riskChecks.length > 0 && (
                    <section className="p-4 rounded-xl bg-rose-500/[0.03] border border-rose-500/10">
                      <h3 className="text-[11px] font-semibold tracking-widest uppercase text-rose-400/80 mb-3 flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-rose-400" />
                        리스크
                      </h3>
                      <ul className="space-y-2.5">
                        {summary.riskChecks.map((risk, i) => (
                          <li key={i} className="text-[13px] text-zinc-400 leading-relaxed pl-3 border-l border-rose-500/20">
                            {risk}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {/* 현장 확인 사항 */}
                  {summary.nextSteps && summary.nextSteps.length > 0 && (
                    <section className="p-4 rounded-xl bg-blue-500/[0.03] border border-blue-500/10">
                      <h3 className="text-[11px] font-semibold tracking-widest uppercase text-blue-400/80 mb-3 flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-blue-400" />
                        현장 확인
                      </h3>
                      <ul className="space-y-2.5">
                        {summary.nextSteps.map((step, i) => (
                          <li key={i} className="text-[13px] text-zinc-400 leading-relaxed flex items-start gap-2">
                            <span className="text-blue-400/60 text-xs mt-0.5">{i + 1}</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </div>

                {/* 마케팅 노트 */}
                {summary.marketingNote && (
                  <section className="p-4 rounded-xl bg-violet-500/[0.03] border border-violet-500/10">
                    <h3 className="text-[11px] font-semibold tracking-widest uppercase text-violet-400/80 mb-2 flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-violet-400" />
                      마케팅 참고
                    </h3>
                    <p className="text-[13px] text-zinc-400 leading-relaxed">
                      {summary.marketingNote}
                    </p>
                  </section>
                )}

                {/* 총정리 - 강조 */}
                {summary.finalSummary && (
                  <section className={`p-5 rounded-xl ${config.accentBg} border ${config.accentBorder}`}>
                    <h3 className={`text-[11px] font-semibold tracking-widest uppercase ${config.accent} opacity-80 mb-2`}>총정리</h3>
                    <p className="text-[15px] text-zinc-200 leading-relaxed font-medium">
                      {summary.finalSummary}
                    </p>
                  </section>
                )}

                {/* 면책 조항 */}
                <div className="pt-4 border-t border-white/[0.04]">
                  <p className="text-[11px] text-zinc-600 leading-relaxed">
                    {summary.disclaimer}
                  </p>
                </div>

                {/* AI 표시 */}
                <div className="flex items-center justify-center gap-2 pt-2 pb-2">
                  <span className="text-[10px] text-zinc-600 tracking-wide">Powered by Llama 3.3 70B</span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
