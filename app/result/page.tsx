'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Suspense, useEffect, useState } from 'react'
import { AnalysisResult, Grade, CHANGE_INDICATOR_INFO, MARKETING_ELASTICITY_INFO, DATA_COVERAGE_INFO, LOCATION_STATUS_INFO } from '@/lib/types'
import Tooltip from '@/components/Tooltip'
import AISummaryModal from '@/components/AISummaryModal'
import type { AISummaryResponse } from '@/app/api/ai/summary/route'

// 툴팁 설명 텍스트
const TOOLTIP_TEXTS = {
  // 섹션 헤더
  areaInfo: '상권의 기본 정보와 등급을 한눈에 확인할 수 있습니다.',
  areaLocation: '검색한 위치와 해당 상권의 영역을 지도에서 확인합니다.',
  trafficStats: '분기별 유동인구 데이터로 상권의 유동 특성을 파악합니다.',
  population: '상권 주변의 거주 인구와 직장 인구를 보여줍니다.',
  analysisMetrics: '등급 결정에 사용된 주요 지표들의 상대적 수치입니다.',
  coreInterpretation: 'AI가 분석한 해당 상권의 핵심 특성입니다.',
  anchors: '유동인구를 끌어모으는 주요 시설의 유무입니다.',
  actions: '창업 전 현장에서 직접 확인해야 할 사항들입니다.',
  risks: '해당 상권에서 주의해야 할 잠재적 위험 요소입니다.',

  // 개별 항목
  grade: 'A(주거), B(혼합), C(상업), D(특수) 4단계로 구분합니다.',
  characteristic: '상권의 주요 특성을 한 문장으로 요약합니다.',
  marketingElasticity: '마케팅 투자 대비 효과가 기대되는 정도입니다. 유동인구와 경쟁 밀도를 고려합니다.',
  changeIndicator: '상권의 성장/정체 상태입니다. LL(정체), LH(성장), HL(쇠퇴), HH(활성).',
  trafficTotal: '해당 분기의 총 유동인구 수입니다.',
  trafficWeekday: '평일(월~금) 평균 유동인구입니다.',
  trafficWeekend: '주말(토~일) 평균 유동인구입니다.',
  residentPop: '상권 배후지역의 거주 인구 수입니다.',
  workerPop: '상권 내 직장 인구 수입니다.',

  // 분석 지표 (reason.key)
  traffic: '상권 내 유동인구 밀도입니다. 높을수록 유동인구가 많습니다.',
  churn: '개폐업 변동률입니다. 높을수록 업체 교체가 잦아 경쟁이 치열합니다.',
  cost: '임대료 등 비용 압박 수준입니다. 높을수록 고정비 부담이 큽니다.',
  competition: '동종 업종 경쟁 밀도입니다. 높을수록 경쟁이 치열합니다.',
  weekend: '주말 유동인구 비중입니다. 높을수록 주말 상권 특성이 강합니다.',
  variance: '시간대별 유동인구 편차입니다. 높을수록 특정 시간대에 집중됩니다.',
}

// 카카오맵은 클라이언트에서만 로드
const AreaMap = dynamic(() => import('@/components/AreaMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[200px] flex items-center justify-center" style={{ background: 'var(--bg-elevated)' }}>
      <span className="text-caption" style={{ color: 'var(--text-muted)' }}>지도 로딩 중...</span>
    </div>
  )
})

const GRADE_COLORS: Record<Grade, { bg: string; text: string; glow: string; border: string }> = {
  A: { bg: 'bg-emerald-500', text: 'text-emerald-400', glow: 'shadow-emerald-500/30', border: 'border-emerald-500/30' },
  B: { bg: 'bg-amber-500', text: 'text-amber-400', glow: 'shadow-amber-500/30', border: 'border-amber-500/30' },
  C: { bg: 'bg-red-500', text: 'text-red-400', glow: 'shadow-red-500/30', border: 'border-red-500/30' },
  D: { bg: 'bg-violet-500', text: 'text-violet-400', glow: 'shadow-violet-500/30', border: 'border-violet-500/30' },
}

function formatNumber(num: number): string {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + '만'
  }
  return num.toLocaleString()
}

function formatPeriod(period: string): string {
  if (period.length === 5) {
    const year = period.slice(0, 4)
    const quarter = period.slice(4)
    return `${year}.${quarter}Q`
  }
  if (period.includes('-Q')) {
    const [year, q] = period.split('-Q')
    return `${year}.${q}Q`
  }
  return period
}

function ResultContent() {
  const searchParams = useSearchParams()
  const query = searchParams.get('query')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // AI 요약 관련 상태
  const [showAIModal, setShowAIModal] = useState(false)
  const [aiSummary, setAISummary] = useState<AISummaryResponse | null>(null)
  const [aiLoading, setAILoading] = useState(false)
  const [aiError, setAIError] = useState<string | null>(null)

  // AI 요약 요청
  const handleAISummary = async () => {
    if (!result) return

    setShowAIModal(true)
    setAILoading(true)
    setAIError(null)

    try {
      const res = await fetch('/api/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report: result })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'AI 요약 생성에 실패했습니다.')
      }

      setAISummary(data.summary)
    } catch (err) {
      setAIError(err instanceof Error ? err.message : 'AI 요약 생성 중 오류가 발생했습니다.')
    } finally {
      setAILoading(false)
    }
  }

  useEffect(() => {
    if (!query) return

    async function fetchAnalysis() {
      try {
        const res = await fetch(`/api/analyze?query=${encodeURIComponent(query!)}`)
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || '분석에 실패했습니다.')
        }
        const data = await res.json()

        // 📊 개발자 도구 콘솔에 지표 로깅
        console.log('%c========== 상권 분석 지표 ==========', 'color: #3b82f6; font-weight: bold; font-size: 14px;')
        console.log(`%c🔍 검색어: ${query}`, 'color: #a3a3a3;')
        console.log(`%c📍 상권명: ${data.area.name} (${data.area.district})`, 'color: #f5f5f5; font-weight: bold;')
        console.log('%c--- 원본 지표 (rawMetrics) ---', 'color: #10b981;')
        console.table(data.rawMetrics)
        console.log('%c--- 분석 결과 (analysis) ---', 'color: #f59e0b;')
        console.log('등급:', data.analysis.grade, '|', data.analysis.gradeName)
        console.log('앵커 시설:', data.analysis.anchors)
        console.log('상권변화:', data.analysis.changeIndicator)
        console.log('마케팅 탄성:', data.analysis.marketingElasticity)
        console.log('판단 근거:')
        console.table(data.analysis.reasons)
        console.log('%c=====================================', 'color: #3b82f6; font-weight: bold;')

        setResult(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류')
      } finally {
        setLoading(false)
      }
    }

    fetchAnalysis()
  }, [query])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b]">
        {/* Header Skeleton */}
        <header className="sticky top-0 z-50 bg-[#09090b]/90 backdrop-blur-xl border-b border-white/5">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
            <div className="w-20 h-4 rounded bg-zinc-800 animate-pulse" />
            <div className="w-24 h-4 rounded bg-zinc-800 animate-pulse" />
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
          {/* Hero Skeleton */}
          <div className="grid md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <div className="flex flex-col gap-4 sm:gap-6">
              {/* Info Card Skeleton */}
              <div className="p-5 sm:p-7 rounded-2xl bg-zinc-900 border border-zinc-800 animate-fade-up">
                <div className="flex items-start gap-4 sm:gap-5 mb-5 sm:mb-6">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-zinc-800 animate-pulse shrink-0" />
                  <div className="flex-1">
                    <div className="w-20 h-4 rounded bg-zinc-800 animate-pulse mb-2" />
                    <div className="w-3/4 h-6 rounded bg-zinc-800 animate-pulse" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="p-3 sm:p-4 rounded-xl bg-zinc-800/50 border border-zinc-800">
                      <div className="w-12 h-3 rounded bg-zinc-700 animate-pulse mb-2" />
                      <div className="w-20 h-5 rounded bg-zinc-700 animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Traffic Card Skeleton */}
              <div className="rounded-2xl bg-zinc-900 border border-zinc-800 animate-fade-up delay-1 flex-1">
                <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
                  <div className="w-24 h-4 rounded bg-zinc-800 animate-pulse" />
                  <div className="w-16 h-4 rounded bg-zinc-800 animate-pulse" />
                </div>
                <div className="p-4 sm:p-5">
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="p-3 sm:p-4 rounded-xl bg-zinc-800/50 border border-zinc-800 text-center">
                        <div className="w-16 h-3 rounded bg-zinc-700 animate-pulse mx-auto mb-2" />
                        <div className="w-12 h-6 rounded bg-zinc-700 animate-pulse mx-auto" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Map Skeleton */}
            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 animate-fade-up delay-1 overflow-hidden md:h-full">
              <div className="px-5 py-4 border-b border-zinc-800">
                <div className="w-16 h-4 rounded bg-zinc-800 animate-pulse" />
              </div>
              <div className="h-[250px] sm:h-[300px] md:h-[calc(100%-57px)] bg-zinc-800 animate-pulse" />
            </div>
          </div>

          {/* Analysis Text Skeleton */}
          <div className="text-center py-12">
            <div className="flex flex-col items-center gap-4">
              <svg className="animate-spin w-8 h-8 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v4m0 12v4m10-10h-4M6 12H2"/>
              </svg>
              <p className="text-base sm:text-lg text-zinc-400">
                <span className="font-semibold text-white">"{query}"</span> 분석 중...
              </p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (error || !result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#09090b]">
        <div className="p-8 sm:p-12 rounded-2xl bg-zinc-900 border border-zinc-800 max-w-md text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center bg-red-500/20">
            <svg className="w-8 h-8 sm:w-10 sm:h-10 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="m15 9-6 6m0-6 6 6"/>
            </svg>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-white mb-2">
            분석 실패
          </p>
          <p className="text-sm sm:text-base text-zinc-400 mb-6">
            {error || '결과를 찾을 수 없습니다.'}
          </p>
          <Link href="/" className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all">
            다시 검색하기
          </Link>
        </div>
      </div>
    )
  }

  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace('.', '')
  const gradeColors = GRADE_COLORS[result.analysis.grade]

  const rawMetrics = result.rawMetrics || {
    period: '-',
    traffic_total: 0,
    traffic_weekday: 0,
    traffic_weekend: 0,
    resident_index: 0,
    worker_index: 0
  }

  return (
    <div className="min-h-screen bg-[#09090b]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#09090b]/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm text-zinc-500 hover:text-white transition-colors group">
            <svg className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            다시 검색
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={handleAISummary}
              className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-white hover:bg-zinc-100 text-zinc-900 text-xs sm:text-sm font-semibold transition-all shadow-lg shadow-black/20 hover:shadow-black/30 hover:scale-[1.02] active:scale-[0.98]"
            >
              AI 요약
            </button>
            <span className="text-xs sm:text-sm font-mono text-zinc-600">
              {today}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Hero: Left Cards + Right Map */}
        <div className="grid md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Left Column: Info + Traffic */}
          <div className="flex flex-col gap-4 sm:gap-6">
            {/* Info Card */}
            <div className="p-5 sm:p-7 rounded-2xl bg-zinc-900 border border-zinc-800 animate-fade-up">
              <div className="flex items-start gap-4 sm:gap-5 mb-5 sm:mb-6">
                <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl ${gradeColors.bg} flex items-center justify-center text-3xl sm:text-4xl font-bold text-white shadow-lg ${gradeColors.glow} shrink-0`}>
                  {result.analysis.grade}
                </div>
                <div className="flex-1 min-w-0">
                  {/* 검색어 표시 */}
                  {result.searchQuery && result.searchQuery !== result.area.name && (
                    <div className="text-xs sm:text-sm text-zinc-500 mb-1">
                      {result.searchQuery} 검색 결과
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 text-xs font-medium rounded bg-zinc-800 text-zinc-400 border border-zinc-700">{result.area.district}</span>
                    <span className="text-xs font-mono text-zinc-600">#{result.area.id}</span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-white truncate">
                    {result.area.name}
                  </h1>
                  {/* 위치 상태 안내 */}
                  {result.locationStatus && (
                    <div className={`mt-2 px-2 py-1 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 ${
                      result.locationStatus.status === 'IN'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : result.locationStatus.status === 'NEAR'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}>
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {result.locationStatus.status === 'IN' ? (
                          <path d="M20 6L9 17l-5-5"/>
                        ) : (
                          <>
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M12 16v-4m0-4h.01"/>
                          </>
                        )}
                      </svg>
                      <span>{LOCATION_STATUS_INFO[result.locationStatus.status]?.label}</span>
                      {result.locationStatus.distance && (
                        <span>({Math.round(result.locationStatus.distance)}m)</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="p-3 sm:p-4 rounded-xl bg-zinc-800/50 border border-zinc-800">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-zinc-500">등급</span>
                    <Tooltip content={TOOLTIP_TEXTS.grade} />
                  </div>
                  <span className={`text-sm sm:text-base font-semibold ${gradeColors.text}`}>{result.analysis.gradeName}</span>
                </div>
                <div className="p-3 sm:p-4 rounded-xl bg-zinc-800/50 border border-zinc-800">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-zinc-500">특성</span>
                    <Tooltip content={TOOLTIP_TEXTS.characteristic} />
                  </div>
                  <span className="text-sm sm:text-base font-medium text-white">{result.analysis.description}</span>
                </div>
                <div className="p-3 sm:p-4 rounded-xl bg-zinc-800/50 border border-zinc-800">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-zinc-500 whitespace-nowrap">마케팅 탄성</span>
                    <Tooltip content={TOOLTIP_TEXTS.marketingElasticity} />
                  </div>
                  <span className="text-sm sm:text-base font-medium text-white">
                    {MARKETING_ELASTICITY_INFO[result.analysis.marketingElasticity]?.name || '-'}
                  </span>
                </div>
                <div className="p-3 sm:p-4 rounded-xl bg-zinc-800/50 border border-zinc-800">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-zinc-500 whitespace-nowrap">상권 변화</span>
                    <Tooltip content={TOOLTIP_TEXTS.changeIndicator} />
                  </div>
                  <span className="text-sm sm:text-base font-medium text-white">
                    {result.analysis.changeIndicator
                      ? CHANGE_INDICATOR_INFO[result.analysis.changeIndicator]?.name
                      : '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* Traffic Stats */}
            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 animate-fade-up delay-1 flex-1">
              <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-zinc-500">유동인구 현황</span>
                  <Tooltip content={TOOLTIP_TEXTS.trafficStats} />
                </span>
                <span className="text-xs font-mono text-zinc-600">{formatPeriod(rawMetrics.period)}</span>
              </div>
              <div className="p-4 sm:p-5">
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="p-3 sm:p-4 rounded-xl bg-zinc-800/50 border border-zinc-800 text-center">
                    <div className="flex items-center justify-center gap-1 mb-2">
                      <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-zinc-500 whitespace-nowrap">총 유동인구</span>
                      <Tooltip content={TOOLTIP_TEXTS.trafficTotal} />
                    </div>
                    <span className="text-lg sm:text-2xl font-bold text-blue-400 whitespace-nowrap">{formatNumber(rawMetrics.traffic_total)}</span>
                  </div>
                  <div className="p-3 sm:p-4 rounded-xl bg-zinc-800/50 border border-zinc-800 text-center">
                    <div className="flex items-center justify-center gap-1 mb-2">
                      <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-zinc-500">평일</span>
                      <Tooltip content={TOOLTIP_TEXTS.trafficWeekday} />
                    </div>
                    <span className="text-lg sm:text-2xl font-bold text-white whitespace-nowrap">{formatNumber(rawMetrics.traffic_weekday)}</span>
                  </div>
                  <div className="p-3 sm:p-4 rounded-xl bg-zinc-800/50 border border-zinc-800 text-center">
                    <div className="flex items-center justify-center gap-1 mb-2">
                      <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-zinc-500">주말</span>
                      <Tooltip content={TOOLTIP_TEXTS.trafficWeekend} />
                    </div>
                    <span className="text-lg sm:text-2xl font-bold text-white whitespace-nowrap">{formatNumber(rawMetrics.traffic_weekend)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Map (full height) */}
          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 animate-fade-up delay-1 overflow-hidden md:h-full">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-2">
              <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-zinc-500">상권 위치</span>
              <Tooltip content={TOOLTIP_TEXTS.areaLocation} />
            </div>
            <AreaMap
              center={result.area.center}
              areaName={result.area.name}
              grade={result.analysis.grade}
              polygon={result.area.polygon}
              searchedLocation={result.searchedLocation}
              className="h-[250px] sm:h-[300px] md:h-[calc(100%-57px)]"
            />
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Population Data */}
          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 animate-fade-up delay-2">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-2">
              <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-zinc-500">인구 구성</span>
              <Tooltip content={TOOLTIP_TEXTS.population} />
            </div>
            <div className="p-5 sm:p-6">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="p-4 sm:p-5 rounded-xl bg-zinc-800/50 border border-zinc-800">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-zinc-500">거주 인구</span>
                    <Tooltip content={TOOLTIP_TEXTS.residentPop} />
                  </div>
                  <span className="text-xl sm:text-3xl font-bold text-white">
                    {rawMetrics.resident_index > 0
                      ? formatNumber(Math.round(rawMetrics.resident_index * 10000))
                      : '-'
                    }
                    {rawMetrics.resident_index > 0 && <span className="text-sm sm:text-lg text-zinc-500 ml-1">명</span>}
                  </span>
                </div>
                <div className="p-4 sm:p-5 rounded-xl bg-zinc-800/50 border border-zinc-800">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-zinc-500">직장 인구</span>
                    <Tooltip content={TOOLTIP_TEXTS.workerPop} />
                  </div>
                  <span className="text-xl sm:text-3xl font-bold text-white">
                    {rawMetrics.worker_index > 0
                      ? formatNumber(Math.round(rawMetrics.worker_index * 10000))
                      : '-'
                    }
                    {rawMetrics.worker_index > 0 && <span className="text-sm sm:text-lg text-zinc-500 ml-1">명</span>}
                  </span>
                </div>
              </div>
              <p className="text-xs text-zinc-600 mt-4 pt-4 border-t border-zinc-800">
                출처: 서울시 상권분석서비스
              </p>
            </div>
          </div>

          {/* Analysis Metrics */}
          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 animate-fade-up delay-3">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-2">
              <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-zinc-500">분석 지표</span>
              <Tooltip content={TOOLTIP_TEXTS.analysisMetrics} />
            </div>
            <div className="p-5 sm:p-6 space-y-4 sm:space-y-5">
              {result.analysis.reasons.map((reason) => (
                <div key={reason.key}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-1.5">
                      <span className="text-xs sm:text-sm text-zinc-400">{reason.label}</span>
                      {TOOLTIP_TEXTS[reason.key as keyof typeof TOOLTIP_TEXTS] && (
                        <Tooltip content={TOOLTIP_TEXTS[reason.key as keyof typeof TOOLTIP_TEXTS]} />
                      )}
                    </span>
                    <span className="text-sm sm:text-base font-bold text-blue-400">
                      {Math.round(reason.value * 100)}%
                    </span>
                  </div>
                  <div className="h-2 sm:h-2.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${reason.value * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Core Interpretation */}
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 mb-6 sm:mb-8 animate-fade-up delay-4">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-2">
            <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-zinc-500">핵심 해석</span>
            <Tooltip content={TOOLTIP_TEXTS.coreInterpretation} />
          </div>
          <div className="p-5 sm:p-6 space-y-3 sm:space-y-4">
            {result.interpretation.coreCopy.map((copy, i) => (
              <div key={i} className="flex gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-zinc-800/50 border border-zinc-800">
                <span className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${gradeColors.bg} flex items-center justify-center text-xs sm:text-sm font-bold text-white shrink-0`}>
                  {i + 1}
                </span>
                <span className="text-sm sm:text-base text-zinc-300 leading-relaxed">{copy}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Anchors - Phase 2-C */}
        {(result.analysis.anchors.subway || result.analysis.anchors.university || result.analysis.anchors.hospital) && (
          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 mb-6 sm:mb-8 animate-fade-up delay-4">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-2">
              <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-zinc-500">주변 앵커 시설</span>
              <Tooltip content={TOOLTIP_TEXTS.anchors} />
            </div>
            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {result.analysis.anchors.subway && (
                  <span className="px-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-sm sm:text-base text-white">🚇 지하철역</span>
                )}
                {result.analysis.anchors.university && (
                  <span className="px-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-sm sm:text-base text-white">🎓 대학교</span>
                )}
                {result.analysis.anchors.hospital && (
                  <span className="px-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-sm sm:text-base text-white">🏥 종합병원</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Actions & Risks */}
        <div className="grid md:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 animate-fade-up delay-5">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-zinc-500">확인할 사항</span>
                <Tooltip content={TOOLTIP_TEXTS.actions} />
              </span>
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400">✓{result.interpretation.actions.length}</span>
            </div>
            <div className="p-5 sm:p-6 space-y-3">
              {result.interpretation.actions.map((action, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-xl bg-zinc-800/50 border border-zinc-800">
                  <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0">✓</span>
                  <span className="text-sm text-zinc-300 leading-relaxed">{action}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 animate-fade-up delay-5">
            <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-zinc-500">리스크 요인</span>
                <Tooltip content={TOOLTIP_TEXTS.risks} />
              </span>
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-500/20 text-red-400">!{result.interpretation.risks.length}</span>
            </div>
            <div className="p-5 sm:p-6 space-y-3">
              {result.interpretation.risks.map((risk, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-xl bg-zinc-800/50 border border-zinc-800">
                  <span className="w-6 h-6 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center text-xs font-bold shrink-0">!</span>
                  <span className="text-sm text-zinc-300 leading-relaxed">{risk}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Location Status Notice (NEAR/OUTSIDE인 경우에만) */}
        {result.locationStatus && result.locationStatus.status !== 'IN' && (
          <div className={`p-4 sm:p-5 rounded-2xl border-l-4 mb-6 animate-fade-up delay-6 ${
            result.locationStatus.status === 'NEAR'
              ? 'bg-amber-500/10 border-amber-500'
              : 'bg-red-500/10 border-red-500'
          }`}>
            <div className="flex gap-3">
              <svg className={`w-5 h-5 shrink-0 ${
                result.locationStatus.status === 'NEAR' ? 'text-amber-400' : 'text-red-400'
              }`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <div>
                <p className={`text-sm font-semibold mb-1 ${
                  result.locationStatus.status === 'NEAR' ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {LOCATION_STATUS_INFO[result.locationStatus.status]?.label}
                  {result.locationStatus.distance && ` · ${Math.round(result.locationStatus.distance)}m`}
                </p>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  {result.locationStatus.confidenceNote}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Data Quality */}
        <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900 border border-zinc-800 animate-fade-up delay-6 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
              <span className="text-sm text-zinc-500">데이터 기반</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-zinc-400">
                {result.dataQuality?.availableMetrics || 0}/{result.dataQuality?.totalMetrics || 8}개 지표
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                result.dataQuality?.coverage === 'high' ? 'bg-emerald-500/20 text-emerald-400' :
                result.dataQuality?.coverage === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {DATA_COVERAGE_INFO[result.dataQuality?.coverage || 'low']?.label || '제한적'}
              </span>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900 border border-zinc-800 animate-fade-up delay-6">
          <div className="flex gap-3">
            <svg className="w-5 h-5 shrink-0 text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 16v-4m0-4h.01"/>
            </svg>
            <p className="text-sm text-zinc-500 leading-relaxed">
              본 분석은 서울시 상권분석서비스의 공공데이터를 기반으로 한 참고 자료입니다.
              특정 업종이나 입지를 추천하는 것이 아니며, 실제 창업 결정 시에는 현장 조사가 필수입니다.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-10 sm:py-12 text-center border-t border-zinc-900">
        <p className="text-xs sm:text-sm text-zinc-600">
          OpenRisk &middot; 초보 창업자를 위한 상권 분석 서비스
        </p>
      </footer>

      {/* AI 요약 모달 */}
      <AISummaryModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        summary={aiSummary}
        isLoading={aiLoading}
        error={aiError}
        areaName={result.area.name}
        grade={result.analysis.grade}
      />
    </div>
  )
}

export default function ResultPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin w-8 h-8 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v4m0 12v4m10-10h-4M6 12H2"/>
          </svg>
          <p className="text-base text-zinc-400">로딩 중...</p>
        </div>
      </div>
    }>
      <ResultContent />
    </Suspense>
  )
}
