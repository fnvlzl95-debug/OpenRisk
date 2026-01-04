'use client'

import { AIAnalysisResponse } from '@/lib/v2/types'

interface AIAnalysisModalProps {
  isOpen: boolean
  onClose: () => void
  analysis: AIAnalysisResponse | null
  isLoading: boolean
  error: string | null
}

export default function AIAnalysisModal({
  isOpen,
  onClose,
  analysis,
  isLoading,
  error,
}: AIAnalysisModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal (모바일: 하단 시트, 데스크톱: 중앙 모달) */}
      <div className="relative w-full sm:max-w-2xl max-h-[85vh] sm:max-h-[90vh] sm:mx-4 bg-zinc-900 border-t sm:border border-zinc-700 rounded-t-2xl sm:rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-zinc-700 bg-zinc-900/50">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white">AI 리스크 분석</h2>
            <p className="text-[10px] sm:text-xs text-zinc-500">GPT 기반 창업 경고 시스템</p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 sm:py-16">
              <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-zinc-700 border-t-red-500 rounded-full animate-spin mb-3 sm:mb-4" />
              <p className="text-zinc-400 text-sm">리스크 분석 중...</p>
              <p className="text-[10px] sm:text-xs text-zinc-600 mt-1.5 sm:mt-2">데이터 기반 경고를 생성하고 있습니다</p>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 sm:p-4">
              <p className="text-red-400 text-xs sm:text-sm">{error}</p>
            </div>
          )}

          {analysis && !isLoading && (
            <>
              {/* Headline */}
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 sm:p-4">
                <p className="text-red-400 font-bold text-base sm:text-lg leading-relaxed">
                  {analysis.headline}
                </p>
              </div>

              {/* Risk Analysis */}
              <section>
                <div className="flex items-center gap-2 mb-2 sm:mb-3">
                  <span className="text-[9px] sm:text-[10px] font-mono text-zinc-500 tracking-wider">RISK ANALYSIS</span>
                  <div className="flex-1 h-px bg-zinc-800" />
                </div>
                <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed whitespace-pre-line">
                  {analysis.riskAnalysis}
                </p>
              </section>

              {/* Failure Scenario */}
              {analysis.failureScenario && (
                <section>
                  <div className="flex items-center gap-2 mb-2 sm:mb-3">
                    <span className="text-[9px] sm:text-[10px] font-mono text-zinc-500 tracking-wider">FAILURE SCENARIO</span>
                    <div className="flex-1 h-px bg-zinc-800" />
                  </div>
                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 sm:p-4">
                    <p className="text-orange-400 text-xs sm:text-sm font-medium leading-relaxed">
                      {analysis.failureScenario}
                    </p>
                  </div>
                </section>
              )}

              {/* Field Checks */}
              {analysis.fieldChecks && analysis.fieldChecks.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-2 sm:mb-3">
                    <span className="text-[9px] sm:text-[10px] font-mono text-zinc-500 tracking-wider">FIELD CHECKLIST</span>
                    <div className="flex-1 h-px bg-zinc-800" />
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    {analysis.fieldChecks.map((check, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 sm:gap-3 bg-zinc-800/30 rounded-lg p-2.5 sm:p-3"
                      >
                        <div className="w-4 h-4 sm:w-5 sm:h-5 rounded border border-zinc-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-[10px] sm:text-xs text-zinc-500">{i + 1}</span>
                        </div>
                        <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed">{check}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Reconsideration */}
              {analysis.reconsideration && (
                <section>
                  <div className="flex items-center gap-2 mb-2 sm:mb-3">
                    <span className="text-[9px] sm:text-[10px] font-mono text-zinc-500 tracking-wider">FINAL WARNING</span>
                    <div className="flex-1 h-px bg-zinc-800" />
                  </div>
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 sm:p-4">
                    <p className="text-yellow-400 text-xs sm:text-sm font-medium leading-relaxed">
                      {analysis.reconsideration}
                    </p>
                  </div>
                </section>
              )}

              {/* Disclaimer */}
              <div className="pt-3 sm:pt-4 border-t border-zinc-800">
                <p className="text-[10px] sm:text-xs text-zinc-600 leading-relaxed">
                  {analysis.disclaimer}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-zinc-700 bg-zinc-900/50">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs sm:text-sm font-medium rounded-lg transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
