'use client'

import { useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import type { AnalysisResult } from '@/lib/types'
import { CHANGE_INDICATOR_INFO, MARKETING_ELASTICITY_INFO, DATA_COVERAGE_INFO, LOCATION_STATUS_INFO } from '@/lib/types'
import AreaMap from '@/components/AreaMap'
import Tooltip from '@/components/Tooltip'
import AISummaryModal from '@/components/AISummaryModal'
import type { AISummaryResponse } from '@/app/api/ai/summary/route'

// 툴팁 설명 텍스트
const TOOLTIP_TEXTS = {
  grade: 'A(주거), B(혼합), C(상업), D(특수) 4단계로 구분합니다.',
  marketingElasticity: '마케팅 투자 대비 효과가 기대되는 정도입니다. 유동인구와 경쟁 밀도를 고려합니다.',
  changeIndicator: '상권의 성장/정체 상태입니다. LL(정체), LH(성장), HL(쇠퇴), HH(활성).',
  location: '검색한 위치와 해당 상권의 영역을 지도에서 확인합니다.',
  coreInterpretation: 'AI가 분석한 해당 상권의 핵심 특성입니다.',
  anchors: '유동인구를 끌어모으는 주요 시설의 유무입니다.',
  trafficTotal: '해당 분기의 총 유동인구 수입니다.',
  trafficWeekday: '평일(월~금) 평균 유동인구입니다.',
  trafficWeekend: '주말(토~일) 평균 유동인구입니다.',
  actions: '창업 전 현장에서 직접 확인해야 할 사항들입니다.',
  risks: '해당 상권에서 주의해야 할 잠재적 위험 요소입니다.',
}

function ResultContent() {
  const searchParams = useSearchParams()
  const query = searchParams.get('query') || ''

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
    if (!query) {
      setError('검색어가 없습니다.')
      setLoading(false)
      return
    }

    const fetchAnalysis = async () => {
      try {
        const res = await fetch(`/api/analyze?query=${encodeURIComponent(query)}`)
        const data = await res.json()

        if (!res.ok) {
          setError(data.error || '분석 중 오류가 발생했습니다.')
          setLoading(false)
          return
        }

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
        setLoading(false)
      } catch (err) {
        console.error('Fetch error:', err)
        setError('서버 연결에 실패했습니다.')
        setLoading(false)
      }
    }

    fetchAnalysis()
  }, [query])

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return { text: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', glow: 'bg-emerald-500' }
      case 'B': return { text: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/10', glow: 'bg-blue-500' }
      case 'C': return { text: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/10', glow: 'bg-amber-500' }
      case 'D': return { text: 'text-rose-400', border: 'border-rose-500/30', bg: 'bg-rose-500/10', glow: 'bg-rose-500' }
      default: return { text: 'text-gray-400', border: 'border-gray-500/30', bg: 'bg-gray-500/10', glow: 'bg-gray-500' }
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-white">
        <div className="w-16 h-16 border-4 border-white/10 border-t-blue-500 rounded-full animate-spin mb-8" />
        <h2 className="text-2xl font-light animate-pulse">Analyzing {query}...</h2>
        <p className="text-white/40 mt-2 font-mono text-sm">ACCESSING SEOUL OPEN DATA API...</p>
      </div>
    )
  }

  if (error || !result) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-white">
        <div className="p-8 rounded-3xl bg-[#111] border border-white/10 max-w-md text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold mb-2">분석 실패</h2>
          <p className="text-white/60 mb-6">{error}</p>
          <Link
            href="/skin-b"
            className="inline-block px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors"
          >
            다시 검색
          </Link>
        </div>
      </div>
    )
  }

  const gradeColors = getGradeColor(result.analysis.grade)
  const rawMetrics = result.rawMetrics

  const formatNumber = (n: number) => n.toLocaleString()

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8">
      {/* 헤더 영역 */}
      <div className="flex items-center justify-between mb-8">
        <Link
          href="/skin-b"
          className="flex items-center text-white/40 hover:text-white transition-colors group"
        >
          <svg className="w-5 h-5 mr-2 transform group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          NEW SEARCH
        </Link>
        <button
          onClick={handleAISummary}
          className="px-4 py-2 rounded-full bg-white hover:bg-white/90 text-black text-xs sm:text-sm font-bold transition-all shadow-lg shadow-white/10 hover:shadow-white/20 hover:scale-[1.02] active:scale-[0.98]"
        >
          AI 요약
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">

        {/* Main Score Card */}
        <div className="lg:col-span-1 p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-[#111] border border-white/10 relative overflow-hidden h-fit">
          <div className={`absolute -top-20 -right-20 w-64 h-64 rounded-full blur-[80px] opacity-20 ${gradeColors.glow}`} />
          <div className="text-[10px] sm:text-xs font-mono text-white/40 mb-1">RISK GRADE</div>
          <div className={`text-5xl sm:text-7xl font-bold tracking-tighter ${gradeColors.text}`}>
            {result.analysis.grade}
          </div>
          <div className={`mt-2 inline-block px-2 sm:px-3 py-0.5 sm:py-1 rounded-full border text-[10px] sm:text-xs font-mono font-bold tracking-wider uppercase ${gradeColors.bg} ${gradeColors.border} ${gradeColors.text}`}>
            {result.analysis.gradeName}
          </div>
          {/* 검색어 표시 */}
          {result.searchQuery && result.searchQuery !== result.area.name && (
            <div className="mt-2 text-white/60 text-[10px] sm:text-xs font-mono">
              {result.searchQuery} 검색 결과
            </div>
          )}
          <div className="mt-1 text-white/60 text-xs sm:text-sm">
            {result.area.name} · {result.area.district}
          </div>
          {/* 위치 상태 안내 */}
          {result.locationStatus && (
            <div className={`mt-2 sm:mt-3 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-mono ${
              result.locationStatus.status === 'IN'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : result.locationStatus.status === 'NEAR'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}>
              <span className="font-bold">{LOCATION_STATUS_INFO[result.locationStatus.status]?.label}</span>
              {result.locationStatus.distance && (
                <span className="ml-1">· {Math.round(result.locationStatus.distance)}m</span>
              )}
            </div>
          )}

          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/10 space-y-1.5 sm:space-y-2">
            {/* 마케팅 탄성 */}
            <div className="flex justify-between items-center">
              <span className="text-[10px] sm:text-xs text-white/60 flex items-center gap-1">
                마케팅 탄성
                <Tooltip content={TOOLTIP_TEXTS.marketingElasticity} />
              </span>
              <span className={`text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded ${gradeColors.bg} ${gradeColors.text}`}>
                {MARKETING_ELASTICITY_INFO[result.analysis.marketingElasticity]?.name || '-'}
              </span>
            </div>
            {/* 상권 변화 */}
            <div className="flex justify-between items-center">
              <span className="text-[10px] sm:text-xs text-white/60 flex items-center gap-1">
                상권 변화
                <Tooltip content={TOOLTIP_TEXTS.changeIndicator} />
              </span>
              <span className="text-[10px] sm:text-xs font-bold">
                {result.analysis.changeIndicator
                  ? CHANGE_INDICATOR_INFO[result.analysis.changeIndicator]?.name
                  : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* Analysis Details */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">

          {/* Map Card */}
          <div className="rounded-2xl sm:rounded-3xl bg-[#111] border border-white/10 overflow-hidden">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/10 flex justify-between items-center">
              <h3 className="text-xs sm:text-sm font-mono text-white/40 flex items-center gap-2">
                LOCATION
                <Tooltip content={TOOLTIP_TEXTS.location} />
              </h3>
              <span className="text-[10px] sm:text-xs font-mono text-white/30">#{result.area.id}</span>
            </div>
            <AreaMap
              center={result.area.center}
              areaName={result.area.name}
              grade={result.analysis.grade}
              polygon={result.area.polygon}
              searchedLocation={result.searchedLocation}
              className="h-[180px] sm:h-[200px]"
            />
          </div>

          {/* Summary Box */}
          <div className="p-4 sm:p-8 rounded-2xl sm:rounded-3xl bg-[#111] border border-white/10">
            <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full animate-pulse ${gradeColors.glow}`} />
              핵심 해석
              <Tooltip content={TOOLTIP_TEXTS.coreInterpretation} />
            </h3>
            <div className="space-y-2 sm:space-y-3">
              {result.interpretation.coreCopy.map((copy, i) => (
                <p key={i} className="text-sm sm:text-base text-white/80 leading-relaxed font-light flex items-start">
                  <span className="mr-2 sm:mr-3 text-white/30 font-mono text-xs sm:text-sm">0{i + 1}</span>
                  {copy}
                </p>
              ))}
            </div>
          </div>

          {/* Anchors - Phase 2-C */}
          {(result.analysis.anchors.subway || result.analysis.anchors.university || result.analysis.anchors.hospital) && (
            <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-[#111] border border-white/10">
              <h4 className="text-xs sm:text-sm font-mono text-white/40 mb-3 sm:mb-4 flex items-center gap-2">
                ANCHOR FACILITIES
                <Tooltip content={TOOLTIP_TEXTS.anchors} />
              </h4>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {result.analysis.anchors.subway && (
                  <span className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-white/20 text-xs sm:text-sm">🚇 지하철역</span>
                )}
                {result.analysis.anchors.university && (
                  <span className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-white/20 text-xs sm:text-sm">🎓 대학교</span>
                )}
                {result.analysis.anchors.hospital && (
                  <span className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-white/20 text-xs sm:text-sm">🏥 종합병원</span>
                )}
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="p-3 sm:p-6 rounded-xl sm:rounded-2xl bg-[#111] border border-white/10 text-center">
              <div className="text-[10px] sm:text-xs font-mono text-white/40 mb-1 sm:mb-2 flex items-center justify-center gap-1">
                총 유동인구
                <Tooltip content={TOOLTIP_TEXTS.trafficTotal} />
              </div>
              <div className="text-base sm:text-2xl font-bold whitespace-nowrap">{formatNumber(rawMetrics.traffic_total)}</div>
            </div>
            <div className="p-3 sm:p-6 rounded-xl sm:rounded-2xl bg-[#111] border border-white/10 text-center">
              <div className="text-[10px] sm:text-xs font-mono text-white/40 mb-1 sm:mb-2 flex items-center justify-center gap-1">
                평일
                <Tooltip content={TOOLTIP_TEXTS.trafficWeekday} />
              </div>
              <div className="text-base sm:text-2xl font-bold whitespace-nowrap">{formatNumber(rawMetrics.traffic_weekday)}</div>
            </div>
            <div className="p-3 sm:p-6 rounded-xl sm:rounded-2xl bg-[#111] border border-white/10 text-center">
              <div className="text-[10px] sm:text-xs font-mono text-white/40 mb-1 sm:mb-2 flex items-center justify-center gap-1">
                주말
                <Tooltip content={TOOLTIP_TEXTS.trafficWeekend} />
              </div>
              <div className="text-base sm:text-2xl font-bold whitespace-nowrap">{formatNumber(rawMetrics.traffic_weekend)}</div>
            </div>
          </div>

          {/* Pros & Cons Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-[#111] border border-white/10">
              <h4 className="text-xs sm:text-sm font-mono text-emerald-400 mb-3 sm:mb-4 flex items-center gap-2">
                <svg className="w-3 sm:w-4 h-3 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                확인할 사항
                <Tooltip content={TOOLTIP_TEXTS.actions} />
              </h4>
              <ul className="space-y-2 sm:space-y-3">
                {result.interpretation.actions.map((action, i) => (
                  <li key={i} className="flex items-start text-xs sm:text-sm text-white/70">
                    <span className="mr-2 sm:mr-3 text-white/20">0{i + 1}</span>
                    {action}
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-[#111] border border-white/10">
              <h4 className="text-xs sm:text-sm font-mono text-rose-400 mb-3 sm:mb-4 flex items-center gap-2">
                <svg className="w-3 sm:w-4 h-3 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                리스크 요인
                <Tooltip content={TOOLTIP_TEXTS.risks} />
              </h4>
              <ul className="space-y-2 sm:space-y-3">
                {result.interpretation.risks.map((risk, i) => (
                  <li key={i} className="flex items-start text-xs sm:text-sm text-white/70">
                    <span className="mr-2 sm:mr-3 text-white/20">0{i + 1}</span>
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Location Status Notice (NEAR/OUTSIDE인 경우에만) */}
          {result.locationStatus && result.locationStatus.status !== 'IN' && (
            <div className={`p-4 sm:p-6 rounded-2xl sm:rounded-3xl border ${
              result.locationStatus.status === 'NEAR'
                ? 'bg-blue-500/10 border-blue-500/30'
                : 'bg-amber-500/10 border-amber-500/30'
            }`}>
              <div className="flex gap-3 sm:gap-4 items-start">
                <svg className={`w-4 sm:w-5 h-4 sm:h-5 shrink-0 ${
                  result.locationStatus.status === 'NEAR' ? 'text-blue-400' : 'text-amber-400'
                }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div>
                  <p className={`text-xs sm:text-sm font-bold mb-1 ${
                    result.locationStatus.status === 'NEAR' ? 'text-blue-400' : 'text-amber-400'
                  }`}>
                    {LOCATION_STATUS_INFO[result.locationStatus.status]?.label}
                    {result.locationStatus.distance && ` · ${Math.round(result.locationStatus.distance)}m`}
                  </p>
                  <p className="text-[10px] sm:text-xs text-white/60 leading-relaxed">
                    {result.locationStatus.confidenceNote}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Data Quality & Disclaimer */}
          <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-[#111] border border-white/10">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <span className="text-xs sm:text-sm font-mono text-white/40">DATA COVERAGE</span>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-mono text-white/60">
                  {result.dataQuality?.availableMetrics || 0}/{result.dataQuality?.totalMetrics || 8}
                </span>
                <span className={`text-[10px] sm:text-xs font-mono px-2 py-0.5 rounded ${
                  result.dataQuality?.coverage === 'high' ? 'bg-emerald-500/20 text-emerald-400' :
                  result.dataQuality?.coverage === 'medium' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-amber-500/20 text-amber-400'
                }`}>
                  {DATA_COVERAGE_INFO[result.dataQuality?.coverage || 'low']?.label || '제한적'}
                </span>
              </div>
            </div>
            <p className="text-[10px] sm:text-xs text-white/40 leading-relaxed">
              본 분석은 서울시 상권분석서비스의 공공데이터를 기반으로 한 참고 자료입니다.
              특정 업종이나 입지를 추천하는 것이 아니며, 실제 창업 결정 시에는 현장 조사가 필수입니다.
            </p>
          </div>

        </div>
      </div>

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

export default function SkinBResultPage() {
  return (
    <div className="relative min-h-screen bg-[#050505] text-white overflow-hidden selection:bg-blue-500/30">
      {/* Background Gradient Spotlights */}
      <div className="fixed top-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Navbar */}
      <nav className="fixed top-0 w-full p-4 sm:p-6 flex justify-between items-center z-50">
        <Link href="/skin-b" className="font-bold text-lg sm:text-xl tracking-tighter flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-2.5 sm:w-3 h-2.5 sm:h-3 bg-white rounded-full" />
          OpenRisk
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/select"
            className="text-[10px] sm:text-xs font-mono text-white/40 hover:text-white transition-colors px-2 sm:px-3 py-1 rounded-full border border-white/10 hover:border-white/30"
          >
            SWITCH
          </Link>
          <div className="hidden sm:block text-xs font-mono opacity-50 border border-white/20 px-3 py-1 rounded-full">
            SEOUL DATA 2025.Q3
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 pt-24 pb-10">
        <Suspense fallback={
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-white">
            <div className="w-16 h-16 border-4 border-white/10 border-t-blue-500 rounded-full animate-spin mb-8" />
            <p className="text-white/40">로딩 중...</p>
          </div>
        }>
          <ResultContent />
        </Suspense>
      </main>
    </div>
  )
}
