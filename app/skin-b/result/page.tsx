'use client'

import { useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import type { AnalysisResult } from '@/lib/types'
import AreaMap from '@/components/AreaMap'

function ResultContent() {
  const searchParams = useSearchParams()
  const query = searchParams.get('query') || ''

  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const gradeColors = getGradeColor(result.lv3_5.grade)
  const rawMetrics = result.rawMetrics

  const formatNumber = (n: number) => n.toLocaleString()

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8">
      <Link
        href="/skin-b"
        className="mb-8 flex items-center text-white/40 hover:text-white transition-colors group"
      >
        <svg className="w-5 h-5 mr-2 transform group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        NEW SEARCH
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Main Score Card */}
        <div className="lg:col-span-1 p-8 rounded-3xl bg-[#111] border border-white/10 flex flex-col justify-between relative overflow-hidden">
          <div className={`absolute -top-20 -right-20 w-64 h-64 rounded-full blur-[80px] opacity-20 ${gradeColors.glow}`} />
          <div>
            <div className="text-sm font-mono text-white/40 mb-2">RISK GRADE</div>
            <div className={`text-8xl font-bold tracking-tighter ${gradeColors.text}`}>
              {result.lv3_5.grade}
            </div>
            <div className={`mt-2 inline-block px-3 py-1 rounded-full border text-xs font-mono font-bold tracking-wider uppercase ${gradeColors.bg} ${gradeColors.border} ${gradeColors.text}`}>
              {result.lv3_5.gradeName}
            </div>
            <div className="mt-2 text-white/60 text-sm">
              {result.area.name} · {result.area.district}
            </div>
          </div>

          <div className="mt-12">
            <div className="flex justify-between items-end mb-2">
              <span className="text-sm text-white/60">신뢰도</span>
              <span className="text-2xl font-bold">{Math.round(result.lv3_5.confidence * 100)}%</span>
            </div>
            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-1000 ease-out"
                style={{ width: `${result.lv3_5.confidence * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Analysis Details */}
        <div className="lg:col-span-2 space-y-6">

          {/* Map Card */}
          <div className="rounded-3xl bg-[#111] border border-white/10 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center">
              <h3 className="text-sm font-mono text-white/40">LOCATION</h3>
              <span className="text-xs font-mono text-white/30">#{result.area.id}</span>
            </div>
            <AreaMap
              center={result.area.center}
              areaName={result.area.name}
              grade={result.lv3_5.grade}
              polygon={result.area.polygon}
              className="h-[200px]"
            />
          </div>

          {/* Summary Box */}
          <div className="p-8 rounded-3xl bg-[#111] border border-white/10">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full animate-pulse ${gradeColors.glow}`} />
              핵심 해석
            </h3>
            <div className="space-y-3">
              {result.lv3_5.coreCopy.map((copy, i) => (
                <p key={i} className="text-white/80 leading-relaxed font-light flex items-start">
                  <span className="mr-3 text-white/30 font-mono text-sm">0{i + 1}</span>
                  {copy}
                </p>
              ))}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-6 rounded-2xl bg-[#111] border border-white/10 text-center">
              <div className="text-xs font-mono text-white/40 mb-2">총 유동인구</div>
              <div className="text-2xl font-bold">{formatNumber(rawMetrics.traffic_total)}</div>
            </div>
            <div className="p-6 rounded-2xl bg-[#111] border border-white/10 text-center">
              <div className="text-xs font-mono text-white/40 mb-2">평일</div>
              <div className="text-2xl font-bold">{formatNumber(rawMetrics.traffic_weekday)}</div>
            </div>
            <div className="p-6 rounded-2xl bg-[#111] border border-white/10 text-center">
              <div className="text-xs font-mono text-white/40 mb-2">주말</div>
              <div className="text-2xl font-bold">{formatNumber(rawMetrics.traffic_weekend)}</div>
            </div>
          </div>

          {/* Pros & Cons Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-3xl bg-[#111] border border-white/10">
              <h4 className="text-sm font-mono text-emerald-400 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                추천 액션
              </h4>
              <ul className="space-y-3">
                {result.lv3_5.actions.map((action, i) => (
                  <li key={i} className="flex items-start text-sm text-white/70">
                    <span className="mr-3 text-white/20">0{i + 1}</span>
                    {action}
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-6 rounded-3xl bg-[#111] border border-white/10">
              <h4 className="text-sm font-mono text-rose-400 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                </svg>
                주의 사항
              </h4>
              <ul className="space-y-3">
                {result.lv3_5.risks.map((risk, i) => (
                  <li key={i} className="flex items-start text-sm text-white/70">
                    <span className="mr-3 text-white/20">0{i + 1}</span>
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          </div>

        </div>
      </div>
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
      <nav className="fixed top-0 w-full p-6 flex justify-between items-center z-50">
        <Link href="/skin-b" className="font-bold text-xl tracking-tighter flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-3 h-3 bg-white rounded-full" />
          OpenRisk
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/select"
            className="text-xs font-mono text-white/40 hover:text-white transition-colors px-3 py-1 rounded-full border border-white/10 hover:border-white/30"
          >
            SWITCH SKIN
          </Link>
          <div className="text-xs font-mono opacity-50 border border-white/20 px-3 py-1 rounded-full">
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
