/**
 * OpenRisk v2 결과 페이지
 * 다크 테마 + 컴팩트 레이아웃
 */

'use client'

import { useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { AnalyzeV2Response, RiskLevel, AIAnalysisResponse, AREA_TYPE_INFO } from '@/lib/v2/types'
import { BusinessCategory } from '@/lib/categories'
import RiskCardStack from '@/components/v2/RiskCardStack'
import AIAnalysisModal from '@/components/v2/AIAnalysisModal'

// 클라이언트 전용 맵 컴포넌트
const AnalysisMap = dynamic(() => import('@/components/v2/AnalysisMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[250px] bg-[#111] rounded-xl flex items-center justify-center">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin" />
        <span className="text-xs text-white/40">지도 로딩 중...</span>
      </div>
    </div>
  ),
})

// 리스크 레벨별 색상
const RISK_COLORS: Record<RiskLevel, { text: string; bg: string; border: string; hex: string }> = {
  LOW: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', hex: '#10b981' },
  MEDIUM: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', hex: '#f59e0b' },
  HIGH: { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', hex: '#f97316' },
  VERY_HIGH: { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30', hex: '#f43f5e' },
}

function ResultV2Content() {
  const searchParams = useSearchParams()
  const paramLat = parseFloat(searchParams.get('lat') || '0')
  const paramLng = parseFloat(searchParams.get('lng') || '0')
  const query = searchParams.get('query') || ''
  const category = (searchParams.get('category') || 'cafe') as BusinessCategory
  const hasInitialCoords = !!(paramLat && paramLng)
  const hasQuery = query.trim().length > 0

  const [result, setResult] = useState<AnalyzeV2Response | null>(null)
  const [loading, setLoading] = useState(hasInitialCoords || hasQuery)
  const [error, setError] = useState<string | null>(null)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    hasInitialCoords ? { lat: paramLat, lng: paramLng } : null
  )

  // AI 분석 상태
  const [showAIModal, setShowAIModal] = useState(false)
  const [aiLoading, setAILoading] = useState(false)
  const [aiData, setAIData] = useState<AIAnalysisResponse | null>(null)
  const [aiError, setAIError] = useState<string | null>(null)

  // AI 분석 요청
  const handleAIAnalysis = async () => {
    if (!result) return

    setShowAIModal(true)
    setAILoading(true)
    setAIError(null)

    try {
      const res = await fetch('/api/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: result }),
      })

      const json = await res.json()

      if (!res.ok) {
        setAIError(json.error || 'AI 분석 중 오류가 발생했습니다.')
        setAILoading(false)
        return
      }

      setAIData(json.analysis)
      setAILoading(false)
    } catch (err) {
      console.error('AI analysis error:', err)
      setAIError('AI 서버 연결에 실패했습니다.')
      setAILoading(false)
    }
  }

  // query -> 좌표 변환
  useEffect(() => {
    if (coords || !query) return

    const geocode = async () => {
      try {
        const searchRes = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const searchData = await searchRes.json()

        if (!searchData || searchData.length === 0) {
          setError('검색 결과가 없습니다.')
          setLoading(false)
          return
        }

        const first = searchData[0]
        if (first.lat && first.lng) {
          setCoords({ lat: first.lat, lng: first.lng })
        } else {
          setError('위치를 찾을 수 없습니다.')
          setLoading(false)
        }
      } catch (err) {
        console.error('Geocode error:', err)
        setError('위치 검색에 실패했습니다.')
        setLoading(false)
      }
    }

    geocode()
  }, [query, coords])

  // 분석 API 호출
  useEffect(() => {
    if (!coords) return

    const fetchAnalysis = async () => {
      try {
        const res = await fetch('/api/v2/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat: coords.lat,
            lng: coords.lng,
            targetCategory: category,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          setError(data.error || '분석 중 오류가 발생했습니다.')
          setLoading(false)
          return
        }

        console.log('v2 분석 결과:', data)
        setResult(data)
        setLoading(false)
      } catch (err) {
        console.error('Fetch error:', err)
        setError('서버 연결에 실패했습니다.')
        setLoading(false)
      }
    }

    fetchAnalysis()
  }, [coords, category])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-white">
        <div className="w-12 h-12 border-3 border-white/10 border-t-blue-500 rounded-full animate-spin mb-6" />
        <h2 className="text-xl font-light animate-pulse">분석 중...</h2>
        <p className="text-white/40 mt-2 font-mono text-xs">ANALYZING 500M RADIUS...</p>
      </div>
    )
  }

  const displayError = error || (!coords && !hasQuery ? '검색어 또는 좌표가 필요합니다.' : null)

  if (displayError || !result) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-white">
        <div className="p-6 rounded-2xl bg-[#111] border border-white/10 max-w-sm text-center">
          <div className="text-3xl mb-3">⚠️</div>
          <h2 className="text-lg font-bold mb-2">분석 실패</h2>
          <p className="text-white/60 text-sm mb-4">{displayError || '분석 데이터를 불러오지 못했습니다.'}</p>
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

  const { location, analysis, metrics, anchors, interpretation, riskCards, dataQuality } = result
  const riskColors = RISK_COLORS[analysis.riskLevel]

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-4 py-4">
      {/* 상단 헤더: 리스크 점수 + 상권명 */}
      <div className="flex items-center justify-between gap-3 mb-4 p-3 sm:p-4 rounded-xl bg-[#111] border border-white/10">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          {/* 리스크 점수 */}
          <div
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl flex flex-col items-center justify-center text-white shadow-lg shrink-0"
            style={{ background: `linear-gradient(135deg, ${riskColors.hex}, ${riskColors.hex}aa)` }}
          >
            <span className="text-xl sm:text-2xl font-black">{analysis.riskScore}</span>
            <span className="text-[8px] font-mono opacity-70">RISK</span>
          </div>
          {/* 상권 정보 */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-lg font-bold text-white truncate">{location.address}</h1>
              <span className="text-[9px] sm:text-xs font-mono font-bold px-2 py-0.5 rounded bg-white/10 text-white/70">
                {AREA_TYPE_INFO[analysis.areaType]?.name || analysis.areaType}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-[11px] sm:text-xs text-white/50">
              <span>{location.district}</span>
              <span>·</span>
              <span>{analysis.categoryName}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 한줄 요약 */}
      <div className="mb-4 p-3 rounded-xl bg-[#111] border border-white/10">
        <p className="text-sm text-white/80 leading-relaxed">{interpretation.summary}</p>
      </div>

      {/* Top 4 칩 (리스크/기회 요인) */}
      <div className="mb-4 flex flex-wrap gap-2">
        {interpretation.topFactors.risks.slice(0, 2).map((risk, i) => (
          <span key={`risk-${i}`} className="text-[11px] px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
            {risk}
          </span>
        ))}
        {interpretation.topFactors.opportunities.slice(0, 2).map((opp, i) => (
          <span key={`opp-${i}`} className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            {opp}
          </span>
        ))}
      </div>

      {/* 메인 그리드: 2열 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        {/* 왼쪽: 지표들 + 앵커 시설 + 점수 기여도 */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          {/* 핵심 3지표 */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {/* 경쟁 밀도 */}
            <div className="p-2.5 sm:p-3 rounded-xl bg-[#111] border border-white/10">
              <div className="text-[9px] sm:text-[10px] font-mono text-white/50 mb-1">경쟁 밀도</div>
              {metrics.competition.hasCategoryData === false && metrics.competition.sameCategory === 0 ? (
                <>
                  <div className="text-lg sm:text-xl font-bold text-white/40">-</div>
                  <div className="text-[10px] mt-1 text-white/40">데이터 없음</div>
                </>
              ) : (
                <>
                  <div className="text-lg sm:text-xl font-bold text-white">{metrics.competition.sameCategory}개</div>
                  <div className={`text-[10px] mt-1 ${
                    metrics.competition.densityLevel === 'low' ? 'text-emerald-400' :
                    metrics.competition.densityLevel === 'medium' ? 'text-amber-400' : 'text-rose-400'
                  }`}>
                    {metrics.competition.densityLevel === 'low' ? '경쟁 적음' :
                     metrics.competition.densityLevel === 'medium' ? '보통' : '경쟁 치열'}
                  </div>
                </>
              )}
            </div>

            {/* 유동인구 (추정) */}
            <div className="p-2.5 sm:p-3 rounded-xl bg-[#111] border border-white/10">
              <div className="text-[9px] sm:text-[10px] font-mono text-white/50 mb-1">유동인구 <span className="text-white/30">(추정)</span></div>
              {/* 레벨 바 */}
              <div className="flex items-center gap-1.5 mt-1.5 mb-1">
                {(() => {
                  const levelMap = { very_low: 1, low: 2, medium: 3, high: 4, very_high: 5 }
                  const level = levelMap[metrics.traffic.level] || 3
                  return Array.from({ length: 5 }, (_, i) => (
                    <div
                      key={i}
                      className={`h-3 flex-1 rounded-sm ${
                        i < level
                          ? level <= 2 ? 'bg-rose-500' : level === 3 ? 'bg-amber-500' : 'bg-emerald-500'
                          : 'bg-white/10'
                      }`}
                    />
                  ))
                })()}
              </div>
              <div className={`text-[11px] font-medium ${
                metrics.traffic.levelLabel === '데이터 없음' ? 'text-white/40' :
                metrics.traffic.level === 'very_high' || metrics.traffic.level === 'high' ? 'text-emerald-400' :
                metrics.traffic.level === 'medium' ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {metrics.traffic.levelLabel}
              </div>
            </div>

            {/* 임대료 */}
            <div className="p-2.5 sm:p-3 rounded-xl bg-[#111] border border-white/10">
              <div className="text-[9px] sm:text-[10px] font-mono text-white/50 mb-1">임대료</div>
              <div className={`text-lg sm:text-xl font-bold ${
                metrics.cost.level === 'low' ? 'text-emerald-400' :
                metrics.cost.level === 'medium' ? 'text-white' : 'text-rose-400'
              }`}>
                {metrics.cost.level === 'low' ? '낮음' :
                 metrics.cost.level === 'medium' ? '보통' : '높음'}
              </div>
              <div className="text-[10px] text-white/40 mt-1">
                {typeof metrics.cost.percentile === 'number'
                  ? `${location.region} 상위 ${Math.round(metrics.cost.percentile)}%`
                  : `${location.region} 평균 대비`}
              </div>
              {metrics.cost.note && (
                <div className="text-[9px] text-amber-400/90 mt-1">
                  {metrics.cost.note}
                </div>
              )}
            </div>
          </div>

          {/* 시간대별 유동인구 */}
          <div className="p-3 rounded-xl bg-[#111] border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-white/50">시간대별 유동인구</span>
              <span className="text-[9px] font-mono text-white/30">
                피크: {metrics.traffic.peakTime === 'morning' ? '아침' : metrics.traffic.peakTime === 'day' ? '낮' : '저녁'}
              </span>
            </div>
            {(() => {
              const hasData = metrics.traffic.timePattern.morning + metrics.traffic.timePattern.day + metrics.traffic.timePattern.night > 0
              const morning = hasData ? metrics.traffic.timePattern.morning : 33
              const day = hasData ? metrics.traffic.timePattern.day : 34
              const night = hasData ? metrics.traffic.timePattern.night : 33
              return (
                <>
                  <div className="flex h-6 rounded-lg overflow-hidden bg-white/5">
                    <div
                      className="bg-sky-500 flex items-center justify-center text-[8px] text-white font-bold"
                      style={{ width: `${morning}%` }}
                    >
                      {morning > 15 && `${morning}%`}
                    </div>
                    <div
                      className="bg-orange-500 flex items-center justify-center text-[8px] text-white font-bold"
                      style={{ width: `${day}%` }}
                    >
                      {day > 15 && `${day}%`}
                    </div>
                    <div
                      className="bg-indigo-500 flex items-center justify-center text-[8px] text-white font-bold"
                      style={{ width: `${night}%` }}
                    >
                      {night > 15 && `${night}%`}
                    </div>
                  </div>
                  {!hasData && (
                    <div className="text-[8px] text-white/30 mt-1 text-center">데이터 없음 (기본값 표시)</div>
                  )}
                </>
              )
            })()}
            <div className="flex justify-between mt-1.5 text-[8px] text-white/40">
              <span className="text-sky-400">아침 06-11</span>
              <span className="text-orange-400">낮 11-17</span>
              <span className="text-indigo-400">저녁 17-06</span>
            </div>
          </div>

          {/* 생존율 + 주말비율 */}
          <div className="grid grid-cols-2 gap-3">
            {/* 상권 트렌드 */}
            <div className="p-3 rounded-xl bg-[#111] border border-white/10">
              <div className="text-[10px] font-mono text-white/50 mb-2">상권 트렌드</div>
              <div className="flex items-end gap-2">
                <span className={`text-base font-bold ${
                  metrics.survival.trend === 'growing' ? 'text-emerald-400' :
                  metrics.survival.trend === 'stable' ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  {metrics.survival.trendLabel || '📉 감소세'}
                </span>
              </div>
              <div className="mt-1.5 text-[10px] text-white/60">
                폐업 {metrics.survival.closureRate}% · 개업 {metrics.survival.openingRate}%
              </div>
            </div>

            {/* 주말 비율 */}
            <div className="p-3 rounded-xl bg-[#111] border border-white/10">
              <div className="text-[10px] font-mono text-white/50 mb-2">평일/주말</div>
              <div className="flex items-end gap-2">
                <span className="text-lg font-bold text-white">
                  {Math.round(metrics.traffic.weekendRatio * 100)}%
                </span>
                <span className="text-[10px] text-white/40 pb-0.5">주말 비중</span>
              </div>
              <div className="mt-1.5 flex h-1.5 rounded-full overflow-hidden bg-white/5">
                <div className="bg-blue-500" style={{ width: `${100 - metrics.traffic.weekendRatio * 100}%` }} />
                <div className="bg-amber-500" style={{ width: `${metrics.traffic.weekendRatio * 100}%` }} />
              </div>
            </div>
          </div>

          {/* 앵커 시설 + 점수 기여도 */}
          <div className="grid grid-cols-2 gap-3">
            {/* 앵커 시설 */}
            <div className="p-3 rounded-xl bg-[#111] border border-white/10">
              <div className="text-[10px] font-mono text-white/50 mb-2">주요 시설</div>
              <div className="space-y-2">
                {anchors.subway && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white">{anchors.subway.name}역</span>
                    <span className="text-[10px] text-white/40">{anchors.subway.distance}m</span>
                  </div>
                )}
                {anchors.starbucks && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white">스타벅스 {anchors.starbucks.count}개</span>
                    <span className="text-[10px] text-white/40">{anchors.starbucks.distance}m</span>
                  </div>
                )}
                {anchors.mart && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white">{anchors.mart.name}</span>
                    <span className="text-[10px] text-white/40">{anchors.mart.distance}m</span>
                  </div>
                )}
                {anchors.department && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white">{anchors.department.name}</span>
                    <span className="text-[10px] text-white/40">{anchors.department.distance}m</span>
                  </div>
                )}
                {!anchors.hasAnyAnchor && (
                  <div className="text-center py-2 text-white/30 text-xs">주변 시설 없음</div>
                )}
              </div>
            </div>

            {/* 점수 기여도 */}
            <div className="p-3 rounded-xl bg-[#111] border border-white/10">
              <div className="text-[10px] font-mono text-white/50 mb-2">점수 기여도</div>
              <div className="space-y-1.5">
                {Object.entries(interpretation.scoreContribution).map(([key, value]) => {
                  const labels: Record<string, string> = {
                    competition: '경쟁',
                    traffic: '유동',
                    cost: '임대료',
                    survival: '생존',
                    anchor: '앵커',
                    timePattern: '시간대',
                  }
                  return (
                    <div key={key} className="flex items-center gap-1.5">
                      <span className="text-[9px] text-white/50 w-10">{labels[key]}</span>
                      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            value.impact === 'positive' ? 'bg-emerald-500' :
                            value.impact === 'negative' ? 'bg-rose-500' : 'bg-white/40'
                          }`}
                          style={{ width: `${Math.max(value.percent * 2.5, 20)}%` }}
                        />
                      </div>
                      <span className={`text-[8px] w-3 ${
                        value.impact === 'positive' ? 'text-emerald-400' :
                        value.impact === 'negative' ? 'text-rose-400' : 'text-white/30'
                      }`}>
                        {value.impact === 'positive' ? '▼' : value.impact === 'negative' ? '▲' : '━'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* 데이터 신뢰도 */}
          <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-between">
            <p className="text-[9px] text-white/30">
              공공데이터 기반 참고자료 · 창업 시 현장조사 필수
            </p>
            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
              dataQuality.coverage === 'high' ? 'bg-emerald-500/20 text-emerald-400' :
              dataQuality.coverage === 'medium' ? 'bg-blue-500/20 text-blue-400' :
              'bg-amber-500/20 text-amber-400'
            }`}>
              {dataQuality.storeDataAge}
            </span>
          </div>

        </div>

        {/* 오른쪽: 지도 + 해석 */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          {/* 지도 */}
          {coords && (
            <AnalysisMap
              center={coords}
              locationName={location.address}
              riskLevel={analysis.riskLevel}
              riskScore={analysis.riskScore}
              className="h-[200px] lg:h-[220px] border border-white/10"
            />
          )}

          {/* 핵심 리스크 카드 */}
          <div className="p-3 rounded-xl bg-[#111] border border-white/10 lg:flex-1">
            {riskCards && riskCards.length > 0 ? (
              <RiskCardStack cards={riskCards} title="핵심 리스크" />
            ) : (
              <>
                <div className="text-[10px] font-mono text-white/50 mb-3">핵심 해석</div>
                <div className="space-y-3">
                  <p className="text-[11px] text-white/70 flex">
                    <span className="mr-2 text-blue-400 font-bold">1.</span>
                    {interpretation.easyExplanations.competition}
                  </p>
                  <p className="text-[11px] text-white/70 flex">
                    <span className="mr-2 text-blue-400 font-bold">2.</span>
                    {interpretation.easyExplanations.traffic}
                  </p>
                  <p className="text-[11px] text-white/70 flex">
                    <span className="mr-2 text-blue-400 font-bold">3.</span>
                    {interpretation.easyExplanations.cost}
                  </p>
                  {interpretation.easyExplanations.survival && (
                    <p className="text-[11px] text-white/70 flex">
                      <span className="mr-2 text-blue-400 font-bold">4.</span>
                      {interpretation.easyExplanations.survival}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Floating AI Button */}
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={handleAIAnalysis}
          className="px-4 py-3 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 shadow-lg shadow-red-500/25 hover:shadow-red-500/40 transition-all flex items-center gap-2"
        >
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-sm font-bold text-white">AI 분석</span>
        </button>
      </div>

      {/* AI Analysis Modal */}
      <AIAnalysisModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        analysis={aiData}
        isLoading={aiLoading}
        error={aiError}
      />
    </div>
  )
}

export default function ResultV2Page() {
  return (
    <div className="relative min-h-screen bg-[#050505] text-white overflow-hidden selection:bg-blue-500/30">
      {/* Background Gradient */}
      <div className="fixed top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-600/8 rounded-full blur-[100px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[400px] h-[400px] bg-purple-600/8 rounded-full blur-[80px] pointer-events-none" />

      {/* Navbar */}
      <nav className="fixed top-0 w-full px-3 sm:px-4 py-3 flex justify-between items-center z-50 bg-[#050505]/80 backdrop-blur-sm">
        <Link href="/" className="font-bold text-base sm:text-lg tracking-tighter flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-2 h-2 bg-white rounded-full" />
          OpenRisk
          <span className="text-[10px] text-blue-400 font-mono">v2</span>
        </Link>
        <Link
          href="/"
          className="text-[10px] sm:text-xs text-white/50 hover:text-white transition-colors flex items-center gap-1"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          검색
        </Link>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 pt-14 pb-6">
        <Suspense fallback={
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-white">
            <div className="w-10 h-10 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin mb-4" />
            <p className="text-white/40 text-sm">로딩 중...</p>
          </div>
        }>
          <ResultV2Content />
        </Suspense>
      </main>
    </div>
  )
}
