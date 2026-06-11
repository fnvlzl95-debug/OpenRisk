'use client'

import type { AIAnalysisResponse } from '@/lib/ai-analysis/types'
import { AlertTriangle, ClipboardCheck, Loader2, RefreshCw, Route, ShieldAlert, X } from 'lucide-react'

type AIAnalysisModalProps = {
  isOpen: boolean
  onClose: () => void
  onRetry?: () => void
  analysis: AIAnalysisResponse | null
  isLoading: boolean
  error: string | null
}

export default function AIAnalysisModal({
  isOpen,
  onClose,
  onRetry,
  analysis,
  isLoading,
  error,
}: AIAnalysisModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="AI 분석 닫기"
        className="absolute inset-0 bg-[#031B37]/78 backdrop-blur-sm"
        onClick={onClose}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="incheon-ai-title"
        className="relative flex max-h-[88dvh] w-full flex-col overflow-hidden border-t border-[#8DBBFF] bg-white shadow-[0_-22px_60px_rgba(3,27,55,0.28)] sm:mx-4 sm:max-w-3xl sm:border sm:shadow-[0_24px_90px_rgba(3,27,55,0.34)]"
      >
        <header className="flex items-center justify-between gap-4 border-b border-[#DDE7F5] bg-[#F7FAFF] px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#FFF1E8] text-[#F06A1A]">
              <ShieldAlert className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#0B66FF]">AI Risk Analysis</p>
              <h2 id="incheon-ai-title" className="truncate text-lg font-black tracking-[-0.02em] text-[#0E1F38]">
                인천 상권 AI 경고
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#D7E1F0] text-[#53657E] transition-colors hover:bg-white"
            aria-label="닫기"
          >
            <X className="h-5 w-5" strokeWidth={2.2} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
          {isLoading && (
            <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
              <Loader2 className="h-10 w-10 animate-spin text-[#0B66FF]" strokeWidth={2.2} />
              <p className="mt-5 text-base font-black text-[#0E1F38]">인천 공공데이터를 해석하는 중입니다</p>
              <p className="mt-2 text-sm font-semibold text-[#6B7A90]">위험 요인, 실패 경로, 현장 체크 항목을 생성합니다.</p>
            </div>
          )}

          {error && !isLoading && (
            <div className="border border-[#FFD0BC] bg-[#FFF7F2] p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#F06A1A]" strokeWidth={2.2} />
                <div className="min-w-0">
                  <p className="text-sm font-black text-[#0E1F38]">AI 분석을 표시할 수 없습니다</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#6B5A52]">{error}</p>
                </div>
              </div>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-5 inline-flex items-center gap-2 border border-[#F06A1A] bg-white px-4 py-2.5 text-sm font-black text-[#E8590C] transition-colors hover:bg-[#FFF1E8]"
                >
                  <RefreshCw className="h-4 w-4" strokeWidth={2.2} />
                  다시 분석
                </button>
              )}
            </div>
          )}

          {analysis && !isLoading && (
            <div className="space-y-6">
              <section className="border-l-[5px] border-[#F06A1A] bg-[#FFF7F2] px-5 py-4">
                <p className="text-xl font-black leading-8 tracking-[-0.02em] text-[#0E1F38]">{analysis.headline}</p>
              </section>

              <section>
                <div className="mb-3 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-[#F06A1A]" strokeWidth={2.2} />
                  <h3 className="text-sm font-black text-[#0E1F38]">위험 분석</h3>
                  <span className="h-px flex-1 bg-[#E6EDF6]" />
                </div>
                <p className="whitespace-pre-line text-sm font-semibold leading-7 text-[#33445E]">{analysis.riskAnalysis}</p>
              </section>

              {analysis.failureScenario && (
                <section className="border border-[#E6EDF6] bg-[#F8FBFF] p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Route className="h-4 w-4 text-[#0B66FF]" strokeWidth={2.2} />
                    <h3 className="text-sm font-black text-[#0E1F38]">실패 경로</h3>
                  </div>
                  <p className="text-sm font-black leading-7 text-[#0B376D]">{analysis.failureScenario}</p>
                </section>
              )}

              {analysis.fieldChecks.length > 0 && (
                <section>
                  <div className="mb-3 flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 text-[#0B66FF]" strokeWidth={2.2} />
                    <h3 className="text-sm font-black text-[#0E1F38]">현장 체크리스트</h3>
                    <span className="h-px flex-1 bg-[#E6EDF6]" />
                  </div>
                  <div className="space-y-2">
                    {analysis.fieldChecks.map((check, index) => (
                      <div key={`${index}-${check}`} className="grid grid-cols-[32px_minmax(0,1fr)] gap-3 border border-[#EDF2F8] p-3">
                        <span className="flex h-8 w-8 items-center justify-center bg-[#EAF2FF] text-xs font-black text-[#0B66FF]">
                          {index + 1}
                        </span>
                        <p className="pt-1 text-sm font-semibold leading-6 text-[#33445E]">{check}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {analysis.reconsideration && (
                <section className="bg-[#06112A] p-5 text-white">
                  <p className="text-sm font-black leading-7">{analysis.reconsideration}</p>
                </section>
              )}

              <p className="border-t border-[#E6EDF6] pt-4 text-xs font-semibold leading-5 text-[#8A98AC]">
                {analysis.disclaimer}
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
