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
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Modal - Editorial Style (모바일: 하단 시트, 데스크톱: 중앙 모달) */}
      <div className="relative w-full sm:max-w-2xl max-h-[85vh] sm:max-h-[90vh] sm:mx-4 bg-[#FAFAF8] border-t-2 sm:border-2 border-black shadow-xl overflow-hidden flex flex-col rounded-t-xl sm:rounded-none">
        {/* Header - Newspaper Style */}
        <div className="border-b-2 border-black bg-white px-4 sm:px-6 py-3 sm:py-4">
          <div className="text-[9px] sm:text-[10px] font-mono text-gray-500 tracking-wider mb-0.5 sm:mb-1">
            AI RISK ANALYSIS
          </div>
          <h2 className="text-lg sm:text-xl font-black tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>
            RISK WARNING
          </h2>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20">
              <div className="w-8 h-8 sm:w-10 sm:h-10 border-2 border-gray-200 border-t-black rounded-full animate-spin mb-3 sm:mb-4" />
              <p className="text-gray-600 font-mono text-xs sm:text-sm">Analyzing risks...</p>
            </div>
          )}

          {error && (
            <div className="m-4 sm:m-6 border border-red-300 bg-red-50 p-3 sm:p-4">
              <p className="text-red-700 text-xs sm:text-sm">{error}</p>
            </div>
          )}

          {analysis && !isLoading && (
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* Headline - Big Quote Style */}
              <div className="border-l-4 border-black pl-3 sm:pl-4 py-1 sm:py-2">
                <p className="text-base sm:text-xl font-bold leading-tight" style={{ fontFamily: 'Georgia, serif' }}>
                  "{analysis.headline}"
                </p>
              </div>

              {/* Risk Analysis */}
              <section>
                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                  <span className="text-[9px] sm:text-[10px] font-mono text-gray-400 tracking-wider">SECTION 01</span>
                  <span className="text-[10px] sm:text-xs font-bold text-black">RISK ANALYSIS</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                <p className="text-gray-700 text-xs sm:text-sm leading-relaxed whitespace-pre-line">
                  {analysis.riskAnalysis}
                </p>
              </section>

              {/* Failure Scenario */}
              {analysis.failureScenario && (
                <section>
                  <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                    <span className="text-[9px] sm:text-[10px] font-mono text-gray-400 tracking-wider">SECTION 02</span>
                    <span className="text-[10px] sm:text-xs font-bold text-black">FAILURE SCENARIO</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                  <div className="bg-gray-100 border border-gray-200 p-3 sm:p-4">
                    <p className="text-gray-800 text-xs sm:text-sm font-medium font-mono leading-relaxed">
                      {analysis.failureScenario}
                    </p>
                  </div>
                </section>
              )}

              {/* Field Checks */}
              {analysis.fieldChecks && analysis.fieldChecks.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                    <span className="text-[9px] sm:text-[10px] font-mono text-gray-400 tracking-wider">SECTION 03</span>
                    <span className="text-[10px] sm:text-xs font-bold text-black">FIELD CHECKLIST</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                  <div className="space-y-1.5 sm:space-y-2">
                    {analysis.fieldChecks.map((check, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 sm:gap-3 border-b border-gray-100 pb-1.5 sm:pb-2"
                      >
                        <div className="w-5 h-5 sm:w-6 sm:h-6 border border-gray-300 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] sm:text-xs font-mono text-gray-500">{i + 1}</span>
                        </div>
                        <p className="text-gray-700 text-xs sm:text-sm leading-relaxed">{check}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Reconsideration */}
              {analysis.reconsideration && (
                <section>
                  <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                    <span className="text-[9px] sm:text-[10px] font-mono text-gray-400 tracking-wider">SECTION 04</span>
                    <span className="text-[10px] sm:text-xs font-bold text-black">FINAL WARNING</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                  <div className="bg-black text-white p-3 sm:p-4">
                    <p className="text-xs sm:text-sm font-medium leading-relaxed">
                      {analysis.reconsideration}
                    </p>
                  </div>
                </section>
              )}

              {/* Disclaimer */}
              <div className="pt-3 sm:pt-4 border-t border-gray-200">
                <p className="text-[9px] sm:text-[10px] font-mono text-gray-400 leading-relaxed">
                  DISCLAIMER: {analysis.disclaimer}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t-2 border-black bg-white">
          <button
            onClick={onClose}
            className="w-full py-2.5 sm:py-2.5 bg-black text-white text-xs sm:text-sm font-bold hover:bg-gray-800 transition-colors"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  )
}
