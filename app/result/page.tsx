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
  marketingElasticity: '마케팅 투자 대비 효과가 기대되는 정도입니다.',
  changeIndicator: '상권의 성장/정체 상태입니다.',
  location: '검색한 위치와 해당 상권의 영역을 지도에서 확인합니다.',
  coreInterpretation: '상권 유형과 주요 특성을 요약한 내용입니다.',
  anchors: '유동인구를 끌어모으는 주요 시설입니다.',
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
      case 'A': return { text: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', glow: 'bg-emerald-500', hex: '#10b981' }
      case 'B': return { text: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/10', glow: 'bg-blue-500', hex: '#3b82f6' }
      case 'C': return { text: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/10', glow: 'bg-amber-500', hex: '#f59e0b' }
      case 'D': return { text: 'text-rose-400', border: 'border-rose-500/30', bg: 'bg-rose-500/10', glow: 'bg-rose-500', hex: '#f43f5e' }
      default: return { text: 'text-gray-400', border: 'border-gray-500/30', bg: 'bg-gray-500/10', glow: 'bg-gray-500', hex: '#6b7280' }
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-white">
        <div className="w-12 h-12 border-3 border-white/10 border-t-blue-500 rounded-full animate-spin mb-6" />
        <h2 className="text-xl font-light animate-pulse">Analyzing {query}...</h2>
        <p className="text-white/40 mt-2 font-mono text-xs">ACCESSING SEOUL OPEN DATA API...</p>
      </div>
    )
  }

  if (error || !result) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-white">
        <div className="p-6 rounded-2xl bg-[#111] border border-white/10 max-w-sm text-center">
          <div className="text-3xl mb-3">⚠️</div>
          <h2 className="text-lg font-bold mb-2">분석 실패</h2>
          <p className="text-white/60 text-sm mb-4">{error}</p>
          <Link
            href="/"
            className="inline-block px-5 py-2.5 bg-white text-black font-bold text-sm rounded-lg hover:bg-gray-200 transition-colors"
          >
            다시 검색
          </Link>
        </div>
      </div>
    )
  }

  const gradeColors = getGradeColor(result.analysis.grade)
  const rawMetrics = result.rawMetrics

  const formatNumber = (n: number) => {
    if (n >= 10000) return (n / 10000).toFixed(1) + '만'
    return n.toLocaleString()
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-4 py-4">
      {/* 상단 헤더: 등급 + 상권명 + AI버튼 한줄로 */}
      <div className="flex items-center justify-between gap-2 mb-4 p-3 sm:p-4 rounded-xl bg-[#111] border border-white/10">
        <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
          {/* 등급 배지 */}
          <div
            className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center text-xl sm:text-3xl font-black text-white shadow-lg shrink-0"
            style={{ background: `linear-gradient(135deg, ${gradeColors.hex}, ${gradeColors.hex}aa)` }}
          >
            {result.analysis.grade}
          </div>
          {/* 상권 정보 */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="text-sm sm:text-lg font-bold text-white truncate">{result.area.name}</h1>
              <span className={`text-[9px] sm:text-xs font-mono font-bold px-1.5 sm:px-2 py-0.5 rounded shrink-0 ${gradeColors.bg} ${gradeColors.text}`}>
                {result.analysis.gradeName}
              </span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5">
              <span className="text-[11px] sm:text-xs text-white/50">{result.area.district}</span>
              {result.locationStatus && (
                <span className={`text-[9px] sm:text-[10px] font-mono px-1 sm:px-1.5 py-0.5 rounded shrink-0 ${
                  result.locationStatus.status === 'IN' ? 'bg-emerald-500/20 text-emerald-400' :
                  result.locationStatus.status === 'NEAR' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-amber-500/20 text-amber-400'
                }`}>
                  {LOCATION_STATUS_INFO[result.locationStatus.status]?.label}
                  {result.locationStatus.distance && ` ${Math.round(result.locationStatus.distance)}m`}
                </span>
              )}
            </div>
          </div>
        </div>
        {/* AI 버튼 */}
        <button
          onClick={handleAISummary}
          className="px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-white hover:bg-white/90 text-black text-[11px] sm:text-sm font-bold transition-all shrink-0"
        >
          AI 요약
        </button>
      </div>

      {/* 메인 그리드: 2열 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">

        {/* 왼쪽 컬럼: 확인사항 + 리스크 + 핵심해석 + 지표 */}
        <div className="lg:col-span-3 flex flex-col gap-3">

          {/* 확인사항 + 리스크 (2컬럼) */}
          <div className="grid grid-cols-2 gap-3 flex-1">
            {/* 확인할 사항 */}
            <div className="p-3 rounded-xl bg-[#111] border border-white/10 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-emerald-500/20 flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-400">확인사항</span>
                </div>
                <Tooltip content={TOOLTIP_TEXTS.actions} />
              </div>
              <ul className="space-y-1.5 flex-1">
                {result.interpretation.actions.map((action, i) => (
                  <li key={i} className="flex items-start text-[11px] text-white/70 leading-snug">
                    <span className="mr-1.5 text-emerald-500/50 shrink-0">•</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 리스크 요인 */}
            <div className="p-3 rounded-xl bg-[#111] border border-white/10 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-rose-500/20 flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01" />
                    </svg>
                  </div>
                  <span className="text-[11px] font-bold text-rose-400">리스크</span>
                </div>
                <Tooltip content={TOOLTIP_TEXTS.risks} />
              </div>
              <ul className="space-y-1.5 flex-1">
                {result.interpretation.risks.map((risk, i) => (
                  <li key={i} className="flex items-start text-[11px] text-white/70 leading-snug">
                    <span className="mr-1.5 text-rose-500/50 shrink-0">•</span>
                    <span>{risk}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 핵심 해석 */}
          <div className="p-3 rounded-xl bg-[#111] border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${gradeColors.glow}`} />
                <span className="text-[11px] font-bold text-white">핵심 해석</span>
              </div>
              <Tooltip content={TOOLTIP_TEXTS.coreInterpretation} />
            </div>
            <div className="space-y-1">
              {result.interpretation.coreCopy.map((copy, i) => (
                <p key={i} className="text-[11px] sm:text-xs text-white/80 leading-relaxed flex">
                  <span className="mr-1.5 text-white/30 font-mono shrink-0">{i + 1}.</span>
                  <span>{copy}</span>
                </p>
              ))}
            </div>
          </div>

          {/* 유동인구 + 마케팅탄성 + 주요시설 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
            {/* 유동인구 */}
            <div className="p-2.5 sm:p-3 rounded-xl bg-[#111] border border-white/10">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] sm:text-[10px] font-mono text-white/50">유동인구</span>
                <Tooltip content={TOOLTIP_TEXTS.trafficTotal} />
              </div>
              <div className="text-base sm:text-lg font-bold text-white">{formatNumber(rawMetrics.traffic_total)}</div>
              <div className="flex gap-1.5 sm:gap-2 text-[8px] sm:text-[9px] text-white/50 mt-1">
                <span>평일 <strong className="text-white/70">{formatNumber(rawMetrics.traffic_weekday)}</strong></span>
                <span>주말 <strong className="text-white/70">{formatNumber(rawMetrics.traffic_weekend)}</strong></span>
              </div>
            </div>

            {/* 마케팅 탄성 */}
            <div className="p-2.5 sm:p-3 rounded-xl bg-[#111] border border-white/10">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] sm:text-[10px] font-mono text-white/50">마케팅 탄성</span>
                <Tooltip content={TOOLTIP_TEXTS.marketingElasticity} />
              </div>
              <div className={`text-base sm:text-lg font-bold ${gradeColors.text}`}>
                {MARKETING_ELASTICITY_INFO[result.analysis.marketingElasticity]?.name || '-'}
              </div>
              <div className="text-[8px] sm:text-[9px] text-white/40 mt-1">
                {result.analysis.changeIndicator
                  ? `변화: ${CHANGE_INDICATOR_INFO[result.analysis.changeIndicator]?.name}`
                  : '변화: -'}
              </div>
            </div>

            {/* 주요 시설 */}
            <div className="col-span-2 sm:col-span-1 p-2.5 sm:p-3 rounded-xl bg-[#111] border border-white/10">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] sm:text-[10px] font-mono text-white/50">주요 시설</span>
                <Tooltip content={TOOLTIP_TEXTS.anchors} />
              </div>
              <div className="flex flex-wrap gap-1 sm:gap-1.5 mt-1">
                {result.analysis.anchors.subway && (
                  <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10">🚇 지하철</span>
                )}
                {result.analysis.anchors.university && (
                  <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10">🎓 대학</span>
                )}
                {result.analysis.anchors.hospital && (
                  <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10">🏥 병원</span>
                )}
                {!result.analysis.anchors.subway && !result.analysis.anchors.university && !result.analysis.anchors.hospital && (
                  <span className="text-[9px] sm:text-[10px] text-white/30">없음</span>
                )}
              </div>
            </div>
          </div>

          {/* 데이터 신뢰도 + 면책 (통합) */}
          <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-between">
            <p className="text-[9px] text-white/30">
              서울시 공공데이터 기반 참고자료 · 창업 시 현장조사 필수
            </p>
            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
              result.dataQuality?.coverage === 'high' ? 'bg-emerald-500/20 text-emerald-400' :
              result.dataQuality?.coverage === 'medium' ? 'bg-blue-500/20 text-blue-400' :
              'bg-amber-500/20 text-amber-400'
            }`}>
              데이터 {result.dataQuality?.availableMetrics || 0}/{result.dataQuality?.totalMetrics || 8}
            </span>
          </div>
        </div>

        {/* 오른쪽 컬럼: 지도 */}
        <div className="lg:col-span-2">
          <div className="rounded-xl bg-[#111] border border-white/10 overflow-hidden h-full flex flex-col">
            <div className="px-2.5 sm:px-3 py-1.5 sm:py-2 border-b border-white/10 flex justify-between items-center">
              <div className="flex items-center gap-1">
                <span className="text-[9px] sm:text-[10px] font-mono text-white/50">상권 위치</span>
                <Tooltip content={TOOLTIP_TEXTS.location} />
              </div>
              <span className="text-[9px] sm:text-[10px] font-mono text-white/30">#{result.area.id}</span>
            </div>
            <div className="flex-1">
              <AreaMap
                center={result.area.center}
                areaName={result.area.name}
                grade={result.analysis.grade}
                polygon={result.area.polygon}
                searchedLocation={result.searchedLocation}
                className="h-full min-h-[280px] sm:min-h-[350px]"
              />
            </div>
            {/* 위치 안내 (NEAR/OUTSIDE일 때만) */}
            {result.locationStatus && result.locationStatus.status !== 'IN' && (
              <div className={`px-3 py-2 border-t text-[10px] ${
                result.locationStatus.status === 'NEAR'
                  ? 'bg-blue-500/5 border-blue-500/20 text-blue-400'
                  : 'bg-amber-500/5 border-amber-500/20 text-amber-400'
              }`}>
                {LOCATION_STATUS_INFO[result.locationStatus.status]?.label} · {result.locationStatus.confidenceNote}
              </div>
            )}
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

export default function ResultPage() {
  return (
    <div className="relative min-h-screen bg-[#050505] text-white overflow-hidden selection:bg-blue-500/30">
      {/* Background Gradient Spotlights */}
      <div className="fixed top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-600/8 rounded-full blur-[100px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[400px] h-[400px] bg-purple-600/8 rounded-full blur-[80px] pointer-events-none" />

      {/* Navbar */}
      <nav className="fixed top-0 w-full px-3 sm:px-4 py-3 flex justify-between items-center z-50 bg-[#050505]/80 backdrop-blur-sm">
        <Link href="/" className="font-bold text-base sm:text-lg tracking-tighter flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-2 h-2 bg-white rounded-full" />
          OpenRisk
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="text-[10px] sm:text-xs text-white/50 hover:text-white transition-colors flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            검색
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 pt-14 pb-6">
        <Suspense fallback={
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-white">
            <div className="w-10 h-10 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin mb-4" />
            <p className="text-white/40 text-sm">로딩 중...</p>
          </div>
        }>
          <ResultContent />
        </Suspense>
      </main>
    </div>
  )
}
