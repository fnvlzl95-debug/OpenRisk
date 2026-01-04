/**
 * OpenRisk Skin B - 신문 스타일 결과 페이지
 * 화이트 배경 + 블랙 타이포그래피 + 레드 악센트
 */

'use client'

import { useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { AnalyzeV2Response, RiskLevel, AREA_TYPE_INFO, AIAnalysisResponse } from '@/lib/v2/types'
import { BusinessCategory } from '@/lib/categories'
import { AlertTriangle, Check, ArrowRight, Train, TrendingUp, TrendingDown, Sparkles, Search, MapPin, Share2 } from 'lucide-react'
import AIAnalysisModal from '@/components/skin-b/AIAnalysisModal'
import MapModal from '@/components/skin-b/MapModal'
import ShareModal from '@/components/skin-b/ShareModal'

// 차트 컴포넌트 (클라이언트 전용)
const GaugeChart = dynamic(() => import('@/components/skin-b/GaugeChart'), { ssr: false })
const RiskRadar = dynamic(() => import('@/components/skin-b/RiskRadar'), { ssr: false })
const TrafficChart = dynamic(() => import('@/components/skin-b/TrafficChart'), { ssr: false })

// 리스크 레벨별 스타일 (흑백 테마)
const RISK_STYLES: Record<RiskLevel, { label: string; color: string; bg: string }> = {
  LOW: { label: '안전', color: 'text-gray-600', bg: 'bg-gray-100' },
  MEDIUM: { label: '주의', color: 'text-gray-700', bg: 'bg-gray-200' },
  HIGH: { label: '위험', color: 'text-gray-800', bg: 'bg-gray-300' },
  VERY_HIGH: { label: '매우 위험', color: 'text-black', bg: 'bg-gray-400' },
}

function ResultBContent() {
  const searchParams = useSearchParams()
  const paramLat = parseFloat(searchParams.get('lat') || '0')
  const paramLng = parseFloat(searchParams.get('lng') || '0')
  const query = searchParams.get('query') || ''
  const category = (searchParams.get('category') || 'cafe') as BusinessCategory

  const [result, setResult] = useState<AnalyzeV2Response | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    paramLat && paramLng ? { lat: paramLat, lng: paramLng } : null
  )

  // AI 분석 상태
  const [showAIModal, setShowAIModal] = useState(false)
  const [aiLoading, setAILoading] = useState(false)
  const [aiData, setAIData] = useState<AIAnalysisResponse | null>(null)
  const [aiError, setAIError] = useState<string | null>(null)

  // 지도 모달 상태
  const [showMapModal, setShowMapModal] = useState(false)

  // 공유 모달 상태
  const [showShareModal, setShowShareModal] = useState(false)

  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

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
    if (coords) return
    if (!query) {
      setError('검색어 또는 좌표가 필요합니다.')
      setLoading(false)
      return
    }

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
      <div className="flex flex-col items-center justify-center min-h-screen bg-white">
        <div className="w-10 h-10 border-2 border-gray-200 border-t-black rounded-full animate-spin mb-4" />
        <p className="text-gray-900 font-medium">분석 중...</p>
        <p className="text-gray-400 text-xs mt-1">반경 500m 데이터 수집</p>
      </div>
    )
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-[#FAFAF8]">
        {/* Header */}
        <header className="border-b-2 border-black">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <div className="text-center py-4 border-t border-b border-gray-300">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">OPEN RISK</h1>
              <p className="text-[9px] sm:text-[10px] font-mono text-gray-500 mt-1 tracking-[0.2em]">
                COMMERCIAL DISTRICT RISK ANALYSIS
              </p>
            </div>
          </div>
        </header>

        {/* Error Content */}
        <main className="max-w-2xl mx-auto px-4 py-12 sm:py-20">
          <div className="border-2 border-black bg-white p-6 sm:p-10">
            <div className="text-center mb-6">
              <div className="inline-block px-3 py-1 bg-black text-white text-[10px] font-mono mb-4">
                SERVICE NOTICE
              </div>
              <h2 className="text-xl sm:text-2xl font-bold mb-3">분석할 수 없는 지역입니다</h2>
              <div className="w-12 h-0.5 bg-black mx-auto mb-4"></div>
            </div>

            <div className="text-center space-y-3 mb-8">
              <p className="text-sm sm:text-base text-gray-600">
                현재 <span className="font-bold">서울 · 경기 · 인천</span> 지역만 지원합니다.
              </p>
              <p className="text-xs text-gray-400">
                다른 지역은 데이터 확보 후 순차적으로 오픈 예정입니다.
              </p>
            </div>

            <div className="flex justify-center">
              <Link
                href="/home-b"
                className="inline-flex items-center gap-2 px-6 py-3 bg-black text-white text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                <Search size={14} />
                다시 검색하기
              </Link>
            </div>
          </div>

          {/* Footer note */}
          <p className="text-center text-[10px] text-gray-400 mt-6">
            문의: openrisk.kr@gmail.com
          </p>
        </main>
      </div>
    )
  }

  const { location, analysis, metrics, anchors, interpretation, riskCards } = result
  const riskStyle = RISK_STYLES[analysis.riskLevel]
  const areaTypeInfo = AREA_TYPE_INFO[analysis.areaType]

  // 레이더 차트 데이터 - 모든 지표를 "리스크" 관점으로 통일 (높을수록 위험)
  // 경쟁: 동종 15개 이상 = 100 (위험)
  const competitionRisk = Math.min(100, (metrics.competition.sameCategory / 15) * 100)
  // 유동인구: 적으면 위험 (index 범위: 0~1000+, 100 이하면 위험)
  // 100 이상이면 안전(20점), 0이면 위험(100점)
  const trafficRisk = metrics.traffic.index >= 100
    ? 20  // 유동인구 충분 - 최소 리스크
    : Math.round(100 - (metrics.traffic.index / 100) * 80)  // 0→100, 100→20
  // 임대료: 높으면 위험
  const costRisk = metrics.cost.level === 'high' ? 80 : metrics.cost.level === 'medium' ? 50 : 20
  // 폐업률: 높으면 위험 (20% = 100)
  const closureRisk = Math.min(100, (metrics.survival.closureRate / 20) * 100)
  // 앵커: 시설 개수 기반 (많을수록 안전)
  // 지하철(1), 스타벅스(실제 개수), 마트(1), 백화점(1)
  const anchorCount =
    (anchors.subway ? 1 : 0) +
    (anchors.starbucks?.count || 0) +  // 스타벅스 실제 개수 반영
    (anchors.mart ? 1 : 0) +
    (anchors.department ? 1 : 0)
  // 0개=100(위험), 5개=70, 10개+=20(안전)
  // 10개 이상이어야 안전 (판별력 확보)
  const anchorRisk = Math.max(20, Math.min(100, 100 - (anchorCount * 8)))

  const radarData = [
    { subject: '경쟁 위험', score: Math.round(competitionRisk), fullMark: 100 },
    { subject: '유동 위험', score: trafficRisk, fullMark: 100 },
    { subject: '임대료 위험', score: costRisk, fullMark: 100 },
    { subject: '폐업 위험', score: Math.round(closureRisk), fullMark: 100 },
    { subject: '앵커 위험', score: Math.round(anchorRisk), fullMark: 100 },
  ]

  return (
    <div className="min-h-screen bg-white text-black">
      {/* Header */}
      <header className="border-b-2 border-black">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex justify-between items-center">
          <Link href="/home-b" className="font-bold text-lg sm:text-xl tracking-tight">
            OpenRisk<span className="text-gray-400">.</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="text-[9px] sm:text-[10px] text-gray-400 hidden sm:block">{today}</div>
            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-300 hover:border-black hover:bg-black hover:text-white transition-colors text-xs font-medium"
            >
              <Share2 size={12} />
              <span className="hidden sm:inline">공유</span>
            </button>
            <Link
              href="/home-b"
              className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-300 hover:border-black hover:bg-black hover:text-white transition-colors text-xs font-medium"
            >
              <Search size={12} />
              <span className="hidden sm:inline">검색</span>
            </Link>
          </div>
        </div>
      </header>

      <main id="result-content" className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Hero Section */}
        <section className="mb-6 sm:mb-8">
          {/* 상단 태그 카드 4개 - 동일 크기, 동일 디자인 */}
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mb-3 sm:mb-4">
            {/* 지역 */}
            <div className="border border-black px-2 sm:px-3 py-1.5 sm:py-2 text-center">
              <div className="text-[8px] sm:text-[9px] text-gray-500 mb-0.5">지역</div>
              <div className="text-[10px] sm:text-xs font-bold truncate">{location.district}</div>
            </div>
            {/* 업종 */}
            <div className="border border-black px-2 sm:px-3 py-1.5 sm:py-2 text-center">
              <div className="text-[8px] sm:text-[9px] text-gray-500 mb-0.5">업종</div>
              <div className="text-[10px] sm:text-xs font-bold truncate">{analysis.categoryName}</div>
            </div>
            {/* 상권 유형 - Area Type 색상 적용 */}
            <div className={`border border-black px-2 sm:px-3 py-1.5 sm:py-2 text-center ${
              analysis.areaType === 'D_특수' ? 'bg-black text-white' :
              analysis.areaType === 'C_상업' ? 'bg-gray-600 text-white' :
              analysis.areaType === 'B_혼합' ? 'bg-gray-400 text-white' :
              'bg-gray-300 text-black'
            }`}>
              <div className={`text-[8px] sm:text-[9px] mb-0.5 ${
                analysis.areaType === 'A_주거' ? 'text-gray-600' : 'text-white/70'
              }`}>상권유형</div>
              <div className="text-[10px] sm:text-xs font-bold">
                {analysis.areaType === 'A_주거' ? 'A 주거형' :
                 analysis.areaType === 'B_혼합' ? 'B 혼합형' :
                 analysis.areaType === 'C_상업' ? 'C 상업형' : 'D 특수형'}
              </div>
            </div>
            {/* 반경 보기 */}
            <button
              onClick={() => setShowMapModal(true)}
              className="border border-black px-2 sm:px-3 py-1.5 sm:py-2 text-center hover:bg-black hover:text-white transition-colors"
            >
              <div className="text-[8px] sm:text-[9px] text-gray-500 group-hover:text-white/70 mb-0.5">지도</div>
              <div className="flex items-center justify-center gap-1 text-[10px] sm:text-xs font-bold">
                <MapPin size={10} />
                <span>반경 보기</span>
              </div>
            </button>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-4 leading-tight">{location.address}</h1>
          <p className="text-gray-600 border-l-2 border-black pl-2 sm:pl-3 text-xs sm:text-sm leading-relaxed">
            {interpretation.summary}
          </p>
        </section>

        {/* Risk Score + Quick Stats */}
        <section className="grid grid-cols-12 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {/* Gauge */}
          <div className="col-span-12 sm:col-span-3 md:col-span-2 border border-gray-200 p-3 sm:p-4 flex flex-col sm:justify-between">
            <div className="text-[10px] text-gray-400 mb-2">위험도</div>
            <div className="flex sm:flex-col items-center sm:items-center gap-3 sm:gap-0">
              <div className="text-4xl sm:text-5xl font-black">{analysis.riskScore}</div>
              <div className={`text-xs font-bold ${
                analysis.riskScore >= 70 ? 'text-black' :
                analysis.riskScore >= 50 ? 'text-gray-700' :
                analysis.riskScore >= 30 ? 'text-gray-500' : 'text-gray-400'
              }`}>
                {analysis.riskScore >= 70 ? '매우 위험' :
                 analysis.riskScore >= 50 ? '위험' :
                 analysis.riskScore >= 30 ? '주의' : '안전'}
              </div>
              <div className="flex-1 sm:w-full bg-gray-100 h-2 sm:mt-3">
                <div
                  className="h-full bg-black transition-all"
                  style={{ width: `${analysis.riskScore}%` }}
                />
              </div>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="col-span-12 sm:col-span-9 md:col-span-10 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {/* 경쟁 */}
            <div className="border border-gray-200 p-3 sm:p-4">
              <div className="text-[10px] text-gray-400 mb-2">경쟁</div>
              <div className="text-2xl sm:text-3xl font-bold mb-3 whitespace-nowrap">
                {metrics.competition.sameCategory >= 16 ? '과포화' :
                 metrics.competition.sameCategory >= 11 ? '포화' :
                 metrics.competition.sameCategory >= 6 ? '보통' : '여유'}
              </div>
              <div className="w-full bg-gray-100 h-2 overflow-hidden mb-2">
                <div
                  className="h-full bg-black transition-all"
                  style={{ width: `${Math.min(metrics.competition.sameCategory / 20 * 100, 100)}%` }}
                />
              </div>
              <div className="text-[10px] text-gray-400">반경 500m</div>
            </div>

            {/* 유동인구 */}
            <div className="border border-gray-200 p-3 sm:p-4">
              <div className="text-[10px] text-gray-400 mb-2">유동인구 <span className="text-gray-300">(추정)</span></div>
              <div className="text-2xl sm:text-3xl font-bold mb-3 whitespace-nowrap">
                {metrics.traffic.level === 'very_high' ? '매우 많음' :
                 metrics.traffic.level === 'high' ? '많음' :
                 metrics.traffic.level === 'medium' ? '보통' :
                 metrics.traffic.level === 'low' ? '적음' : '매우 적음'}
              </div>
              <div className="flex gap-1 mb-2">
                {[1,2,3,4,5].map((i) => (
                  <div
                    key={i}
                    className={`flex-1 h-2 transition-all ${
                      (metrics.traffic.level === 'very_high' && i <= 5) ||
                      (metrics.traffic.level === 'high' && i <= 4) ||
                      (metrics.traffic.level === 'medium' && i <= 3) ||
                      (metrics.traffic.level === 'low' && i <= 2) ||
                      (metrics.traffic.level === 'very_low' && i <= 1)
                        ? 'bg-black'
                        : 'bg-gray-100'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* 임대료 */}
            <div className="border border-gray-200 p-3 sm:p-4">
              <div className="text-[10px] text-gray-400 mb-2">임대료</div>
              <div className="text-2xl sm:text-3xl font-bold mb-3 whitespace-nowrap">
                {metrics.cost.level === 'high' ? '높음' : metrics.cost.level === 'medium' ? '보통' : '낮음'}
              </div>
              <div className="flex gap-1 mb-2">
                {[1,2,3].map((i) => (
                  <div
                    key={i}
                    className={`flex-1 h-2 transition-all ${
                      (metrics.cost.level === 'low' && i <= 1) ||
                      (metrics.cost.level === 'medium' && i <= 2) ||
                      (metrics.cost.level === 'high' && i <= 3)
                        ? 'bg-black'
                        : 'bg-gray-100'
                    }`}
                  />
                ))}
              </div>
              <div className="text-[10px] text-gray-400">{location.region} 평균</div>
            </div>

            {/* 상권 트렌드 */}
            <div className="border border-gray-200 p-3 sm:p-4">
              <div className="text-[10px] text-gray-400 mb-2">추세</div>
              <div className="flex items-center gap-2 mb-3">
                {metrics.survival.trend === 'growing' ? (
                  <TrendingUp size={24} className="text-black flex-shrink-0" />
                ) : metrics.survival.trend === 'shrinking' ? (
                  <TrendingDown size={24} className="text-black flex-shrink-0" />
                ) : (
                  <div className="w-6 h-0.5 bg-black flex-shrink-0" />
                )}
                <span className="text-2xl sm:text-3xl font-bold whitespace-nowrap">
                  {metrics.survival.trend === 'growing' ? '성장' :
                   metrics.survival.trend === 'shrinking' ? '감소' : '유지'}
                </span>
              </div>
              <div className="text-[10px] text-gray-400">점포 수 추세</div>
            </div>
          </div>
        </section>

        {/* Charts Row */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {/* Radar - 5개 지표 리스크 */}
          <div className="border border-gray-200 p-4 sm:p-5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs sm:text-sm font-bold">위험도 분석</span>
              <span className="text-[9px] sm:text-[10px] text-gray-400 px-2 py-0.5 bg-gray-100">{areaTypeInfo?.name || analysis.areaType}</span>
            </div>
            <div className="h-56 sm:h-64">
              <RiskRadar data={radarData} />
            </div>
          </div>

          {/* Traffic Time */}
          <div className="border border-gray-200 p-4 sm:p-5 flex flex-col">
            <div className="flex justify-between items-center mb-2 sm:mb-3">
              <span className="text-xs sm:text-sm font-bold">시간대별 유동</span>
              <span className="text-[9px] sm:text-[10px] text-gray-400">
                피크: {metrics.traffic.peakTime === 'morning' ? '오전' : metrics.traffic.peakTime === 'day' ? '낮' : '저녁'}
              </span>
            </div>
            <div className="flex-1 min-h-[180px] sm:min-h-[220px]">
              <TrafficChart data={metrics.traffic.timePattern} />
            </div>
            <div className="flex justify-between text-[10px] sm:text-xs text-gray-500 mt-3 pt-3 border-t border-gray-200">
              <span>오전 {metrics.traffic.timePattern.morning}%</span>
              <span>낮 {metrics.traffic.timePattern.day}%</span>
              <span>저녁 {metrics.traffic.timePattern.night}%</span>
            </div>
          </div>
        </section>

        {/* Insights */}
        <section className="mb-6 sm:mb-8">
          <div className="border-b border-black pb-1.5 sm:pb-2 mb-3 sm:mb-4">
            <h3 className="text-xs sm:text-sm font-bold">핵심 요약</h3>
          </div>
          <div className="space-y-2 sm:space-y-3">
            {riskCards && riskCards.length > 0 ? (
              riskCards.slice(0, 3).map((card, idx) => (
                <div key={card.id} className="flex gap-2 sm:gap-3 p-2 sm:p-3 bg-gray-50 border-l-2 border-black">
                  <span className="text-[10px] sm:text-xs text-gray-400 font-bold">0{idx + 1}</span>
                  <div>
                    <div className="font-bold text-xs sm:text-sm mb-0.5 sm:mb-1">{card.flag}</div>
                    <div className="text-[10px] sm:text-xs text-gray-600 leading-relaxed">{card.warning}</div>
                  </div>
                </div>
              ))
            ) : (
              <>
                <div className="flex gap-2 sm:gap-3 p-2 sm:p-3 bg-gray-50 border-l-2 border-black">
                  <span className="text-[10px] sm:text-xs text-gray-400 font-bold">01</span>
                  <div>
                    <div className="font-bold text-xs sm:text-sm mb-0.5 sm:mb-1">경쟁 현황</div>
                    <div className="text-[10px] sm:text-xs text-gray-600 leading-relaxed">{interpretation.easyExplanations.competition}</div>
                  </div>
                </div>
                <div className="flex gap-2 sm:gap-3 p-2 sm:p-3 bg-gray-50 border-l-2 border-black">
                  <span className="text-[10px] sm:text-xs text-gray-400 font-bold">02</span>
                  <div>
                    <div className="font-bold text-xs sm:text-sm mb-0.5 sm:mb-1">유동인구</div>
                    <div className="text-[10px] sm:text-xs text-gray-600 leading-relaxed">{interpretation.easyExplanations.traffic}</div>
                  </div>
                </div>
                <div className="flex gap-2 sm:gap-3 p-2 sm:p-3 bg-gray-50 border-l-2 border-black">
                  <span className="text-[10px] sm:text-xs text-gray-400 font-bold">03</span>
                  <div>
                    <div className="font-bold text-xs sm:text-sm mb-0.5 sm:mb-1">비용 효율</div>
                    <div className="text-[10px] sm:text-xs text-gray-600 leading-relaxed">{interpretation.easyExplanations.cost}</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Survival Stats */}
        <section className="mb-6 sm:mb-8 p-3 sm:p-4 bg-gray-50 border border-gray-200">
          <div className="flex justify-between items-center mb-3 sm:mb-4">
            <span className="text-[11px] sm:text-xs font-bold">상권 안정성</span>
            <span className="text-[9px] sm:text-[10px] text-gray-400">{metrics.survival.riskLabel?.replace(/^[^\s]+\s/, '')}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div>
              <div className="flex justify-between text-[10px] sm:text-xs mb-1">
                <span className="text-gray-500">연간 폐업률</span>
                <span className="font-bold text-black">{metrics.survival.closureRate}%</span>
              </div>
              <div className="w-full bg-gray-200 h-1 sm:h-1.5">
                <div className="bg-black h-1 sm:h-1.5" style={{ width: `${Math.min(metrics.survival.closureRate * 3, 100)}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] sm:text-xs mb-1">
                <span className="text-gray-500">주말 매출 비중</span>
                <span className="font-bold">{Math.round(metrics.traffic.weekendRatio * 100)}%</span>
              </div>
              <div className="w-full bg-gray-200 h-1 sm:h-1.5">
                <div className="bg-black h-1 sm:h-1.5" style={{ width: `${metrics.traffic.weekendRatio * 100}%` }}></div>
              </div>
            </div>
          </div>
          <p className="text-[9px] sm:text-[10px] text-gray-500 mt-2 sm:mt-3 leading-relaxed">{metrics.survival.summary}</p>
        </section>

        {/* Anchor Facilities */}
        {anchors.hasAnyAnchor && (
          <section className="mb-6 sm:mb-8">
            <div className="border-b border-black pb-1.5 sm:pb-2 mb-2 sm:mb-3">
              <h3 className="text-xs sm:text-sm font-bold">주변 집객 시설</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {anchors.subway && (
                <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 border border-gray-200">
                  <Train size={14} className="text-black sm:w-4 sm:h-4" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs sm:text-sm font-medium truncate">{anchors.subway.name}역</div>
                    <div className="text-[9px] sm:text-[10px] text-gray-400">{anchors.subway.line}</div>
                  </div>
                  <div className="text-[10px] sm:text-xs text-gray-500">{anchors.subway.distance}m</div>
                </div>
              )}
              {anchors.starbucks && (
                <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 border border-gray-200">
                  <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 bg-black rounded-full flex items-center justify-center text-white text-[7px] sm:text-[8px] font-bold">S</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs sm:text-sm font-medium">스타벅스</div>
                    <div className="text-[9px] sm:text-[10px] text-gray-400">반경 내 {anchors.starbucks.count}개</div>
                  </div>
                  <div className="text-[10px] sm:text-xs text-gray-500">{anchors.starbucks.distance}m</div>
                </div>
              )}
              {anchors.mart && (
                <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 border border-gray-200">
                  <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 bg-gray-700 rounded-full flex items-center justify-center text-white text-[7px] sm:text-[8px] font-bold">M</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs sm:text-sm font-medium truncate">{anchors.mart.name}</div>
                    <div className="text-[9px] sm:text-[10px] text-gray-400">대형마트</div>
                  </div>
                  <div className="text-[10px] sm:text-xs text-gray-500">{anchors.mart.distance}m</div>
                </div>
              )}
              {anchors.department && (
                <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 border border-gray-200">
                  <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 bg-gray-500 rounded-full flex items-center justify-center text-white text-[7px] sm:text-[8px] font-bold">D</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs sm:text-sm font-medium truncate">{anchors.department.name}</div>
                    <div className="text-[9px] sm:text-[10px] text-gray-400">백화점</div>
                  </div>
                  <div className="text-[10px] sm:text-xs text-gray-500">{anchors.department.distance}m</div>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-4 sm:py-6 bg-gray-50">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 text-center">
          <p className="text-[9px] sm:text-[10px] text-gray-500 leading-relaxed">
            ※ 본 분석은 공공데이터 기반 <span className="font-medium">추정치</span>이며, 실제와 다를 수 있습니다.
            <br className="sm:hidden" />
            <span className="hidden sm:inline"> · </span>
            창업 전 반드시 현장 확인을 권장합니다.
          </p>
        </div>
      </footer>

      {/* Floating AI Button */}
      <div className="fixed bottom-3 sm:bottom-4 right-3 sm:right-4 z-50">
        <button
          onClick={handleAIAnalysis}
          className="bg-black text-white px-3 sm:px-4 py-2.5 sm:py-3 shadow-lg flex items-center gap-1.5 sm:gap-2 hover:bg-gray-700 transition-colors text-xs sm:text-sm font-medium"
        >
          <Sparkles size={14} className="sm:w-4 sm:h-4" />
          AI 분석
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

      {/* Map Modal */}
      {coords && (
        <MapModal
          isOpen={showMapModal}
          onClose={() => setShowMapModal(false)}
          center={coords}
          locationName={location.address}
          riskLevel={analysis.riskLevel}
          riskScore={analysis.riskScore}
        />
      )}

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        title={`${location.address} 상권 분석 - OpenRisk`}
        text={`위험도 ${analysis.riskScore}점 | ${interpretation.summary}`}
        url={typeof window !== 'undefined' ? window.location.href : ''}
      />
    </div>
  )
}

export default function ResultBPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen bg-white">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-black rounded-full animate-spin mb-3" />
        <p className="text-gray-500 text-sm">로딩 중...</p>
      </div>
    }>
      <ResultBContent />
    </Suspense>
  )
}
