'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Suspense, useEffect, useState } from 'react'
import { AnalysisResult, Grade } from '@/lib/types'

// 카카오맵은 클라이언트에서만 로드
const AreaMap = dynamic(() => import('@/components/AreaMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[200px] flex items-center justify-center" style={{ background: 'var(--bg-elevated)' }}>
      <span className="text-caption" style={{ color: 'var(--text-muted)' }}>지도 로딩 중...</span>
    </div>
  )
})

const GRADE_CLASS: Record<Grade, string> = {
  A: 'grade-a',
  B: 'grade-b',
  C: 'grade-c',
  D: 'grade-d'
}

const GRADE_TEXT_CLASS: Record<Grade, string> = {
  A: 'grade-text-a',
  B: 'grade-text-b',
  C: 'grade-text-c',
  D: 'grade-text-d'
}

const GRADE_BG_CLASS: Record<Grade, string> = {
  A: 'grade-bg-a',
  B: 'grade-bg-b',
  C: 'grade-bg-c',
  D: 'grade-bg-d'
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
      <div className="min-h-screen grid-bg">
        {/* Header Skeleton */}
        <header className="sticky top-0 z-50" style={{ background: 'rgba(10,10,12,0.9)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
            <div className="skeleton w-20 h-4" />
            <div className="skeleton w-24 h-4" />
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {/* Hero Skeleton */}
          <div className="grid md:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
            <div className="flex flex-col gap-4 sm:gap-6">
              {/* Info Card Skeleton */}
              <div className="card animate-fade-up">
                <div className="p-4 sm:p-6">
                  <div className="flex items-start gap-3 sm:gap-5 mb-4 sm:mb-5">
                    <div className="skeleton skeleton-badge-lg shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="skeleton w-16 h-5" />
                        <div className="skeleton w-12 h-4" />
                      </div>
                      <div className="skeleton w-3/4 h-6" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="panel flex flex-col gap-2">
                        <div className="skeleton w-12 h-3" />
                        <div className="skeleton w-20 h-5" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Traffic Card Skeleton */}
              <div className="card animate-fade-up delay-1">
                <div className="card-header">
                  <div className="skeleton w-24 h-3" />
                  <div className="skeleton w-16 h-3" />
                </div>
                <div className="p-4 sm:p-5">
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="panel flex flex-col gap-2">
                        <div className="skeleton w-16 h-3" />
                        <div className="skeleton w-12 h-5" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Map Skeleton */}
            <div className="card animate-fade-up delay-1 overflow-hidden md:h-full">
              <div className="card-header">
                <div className="skeleton w-16 h-3" />
              </div>
              <div className="skeleton h-[250px] sm:h-[300px] md:h-[calc(100%-41px)] rounded-none" />
            </div>
          </div>

          {/* Two Column Skeleton */}
          <div className="grid md:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="card animate-fade-up delay-2">
                <div className="card-header">
                  <div className="skeleton w-20 h-3" />
                </div>
                <div className="card-body space-y-4">
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="flex items-center justify-between">
                      <div className="skeleton w-24 h-4" />
                      <div className="skeleton w-12 h-4" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Analysis Text Skeleton */}
          <div className="text-center py-8">
            <div className="flex items-center justify-center gap-3">
              <svg className="spinner w-5 h-5" style={{ color: 'var(--accent)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v4m0 12v4m10-10h-4M6 12H2"/>
              </svg>
              <p className="text-body" style={{ color: 'var(--text-secondary)' }}>
                <span className="text-mono" style={{ color: 'var(--text-primary)' }}>"{query}"</span> 분석 중...
              </p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (error || !result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 grid-bg">
        <div className="card p-10 max-w-md text-center">
          <div className="w-16 h-16 rounded-lg mx-auto mb-6 flex items-center justify-center grade-bg-c">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="grade-text-c" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="m15 9-6 6m0-6 6 6"/>
            </svg>
          </div>
          <p className="text-title mb-2" style={{ color: 'var(--text-primary)' }}>
            분석 실패
          </p>
          <p className="text-body mb-6" style={{ color: 'var(--text-secondary)' }}>
            {error || '결과를 찾을 수 없습니다.'}
          </p>
          <Link href="/" className="btn-primary">
            다시 검색하기
          </Link>
        </div>
      </div>
    )
  }

  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace('.', '')
  const gradeClass = GRADE_CLASS[result.lv3_5.grade]
  const gradeTextClass = GRADE_TEXT_CLASS[result.lv3_5.grade]
  const gradeBgClass = GRADE_BG_CLASS[result.lv3_5.grade]

  const rawMetrics = result.rawMetrics || {
    period: '-',
    traffic_total: 0,
    traffic_weekday: 0,
    traffic_weekend: 0,
    resident_index: 0,
    worker_index: 0
  }

  return (
    <div className="min-h-screen grid-bg">
      {/* Header */}
      <header className="sticky top-0 z-50" style={{ background: 'rgba(10,10,12,0.9)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-caption transition-colors" style={{ color: 'var(--text-tertiary)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            다시 검색
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-mono text-caption" style={{ color: 'var(--text-muted)' }}>
              {today}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Hero: Left Cards + Right Map */}
        <div className="grid md:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
          {/* Left Column: Info + Traffic */}
          <div className="flex flex-col gap-4 sm:gap-6">
            {/* Info Card */}
            <div className="card animate-fade-up">
              <div className="p-4 sm:p-6">
                <div className="flex items-start gap-3 sm:gap-5 mb-4 sm:mb-5">
                  <div className={`grade-badge ${gradeClass} shrink-0`}>
                    {result.lv3_5.grade}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="tag">{result.area.district}</span>
                      <span className="text-mono text-caption" style={{ color: 'var(--text-muted)' }}>#{result.area.id}</span>
                    </div>
                    <h1 className="text-headline truncate" style={{ color: 'var(--text-primary)' }}>
                      {result.area.name}
                    </h1>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div className="panel flex flex-col gap-1 sm:gap-2">
                    <span className="stat-label">등급</span>
                    <span className={`text-data-sm ${gradeTextClass}`}>{result.lv3_5.gradeName}</span>
                  </div>
                  <div className="panel flex flex-col gap-1 sm:gap-2">
                    <span className="stat-label">유형</span>
                    <span className="text-data-sm" style={{ color: 'var(--text-primary)' }}>{result.lv3_5.subTitle}</span>
                  </div>
                  <div className="panel flex flex-col gap-1 sm:gap-2">
                    <span className="stat-label">난이도</span>
                    <span className="text-data-sm" style={{ color: 'var(--text-primary)' }}>{result.lv3_5.difficulty === 0 ? 'N/A' : `${result.lv3_5.difficulty}/5`}</span>
                  </div>
                  <div className="panel flex flex-col gap-1 sm:gap-2">
                    <span className="stat-label">신뢰도</span>
                    <span className="text-data-sm" style={{ color: 'var(--text-primary)' }}>{Math.round(result.lv3_5.confidence * 100)}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Traffic Stats */}
            <div className="card animate-fade-up delay-1 flex-1">
              <div className="card-header">
                <span className="text-label" style={{ color: 'var(--text-tertiary)' }}>유동인구 현황</span>
                <span className="text-mono text-caption" style={{ color: 'var(--text-muted)' }}>{formatPeriod(rawMetrics.period)}</span>
              </div>
              <div className="p-4 sm:p-5">
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="panel flex flex-col gap-1 sm:gap-2">
                    <span className="stat-label">총 유동인구</span>
                    <span className="text-data-sm" style={{ color: 'var(--accent)' }}>{formatNumber(rawMetrics.traffic_total)}</span>
                  </div>
                  <div className="panel flex flex-col gap-1 sm:gap-2">
                    <span className="stat-label">평일</span>
                    <span className="text-data-sm" style={{ color: 'var(--text-primary)' }}>{formatNumber(rawMetrics.traffic_weekday)}</span>
                  </div>
                  <div className="panel flex flex-col gap-1 sm:gap-2">
                    <span className="stat-label">주말</span>
                    <span className="text-data-sm" style={{ color: 'var(--text-primary)' }}>{formatNumber(rawMetrics.traffic_weekend)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Map (full height) */}
          <div className="card animate-fade-up delay-1 overflow-hidden md:h-full">
            <div className="card-header">
              <span className="text-label" style={{ color: 'var(--text-tertiary)' }}>상권 위치</span>
            </div>
            <AreaMap
              center={result.area.center}
              areaName={result.area.name}
              grade={result.lv3_5.grade}
              polygon={result.area.polygon}
              className="h-[250px] sm:h-[300px] md:h-[calc(100%-41px)]"
            />
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid md:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
          {/* Population Data */}
          <div className="card animate-fade-up delay-2">
            <div className="card-header">
              <span className="text-label" style={{ color: 'var(--text-tertiary)' }}>인구 구성</span>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-2 gap-4">
                <div className="panel">
                  <div className="stat-block">
                    <span className="stat-label">거주 인구</span>
                    <span className="stat-value">
                      {rawMetrics.resident_index > 0
                        ? formatNumber(Math.round(rawMetrics.resident_index * 10000))
                        : '-'
                      }
                      {rawMetrics.resident_index > 0 && <span className="stat-unit">명</span>}
                    </span>
                  </div>
                </div>
                <div className="panel">
                  <div className="stat-block">
                    <span className="stat-label">직장 인구</span>
                    <span className="stat-value">
                      {rawMetrics.worker_index > 0
                        ? formatNumber(Math.round(rawMetrics.worker_index * 10000))
                        : '-'
                      }
                      {rawMetrics.worker_index > 0 && <span className="stat-unit">명</span>}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-caption mt-4 pt-4" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)' }}>
                출처: 서울시 상권분석서비스
              </p>
            </div>
          </div>

          {/* Analysis Metrics */}
          <div className="card animate-fade-up delay-3">
            <div className="card-header">
              <span className="text-label" style={{ color: 'var(--text-tertiary)' }}>분석 지표</span>
            </div>
            <div className="card-body space-y-4">
              {result.lv3_5.reasons.map((reason) => (
                <div key={reason.key}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-caption" style={{ color: 'var(--text-secondary)' }}>{reason.label}</span>
                    <span className="text-mono text-caption" style={{ color: 'var(--accent)' }}>
                      {Math.round(reason.value * 100)}%
                    </span>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${reason.value * 100}%`, background: 'var(--accent)' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Core Interpretation */}
        <div className="card mb-4 sm:mb-6 animate-fade-up delay-4">
          <div className="card-header">
            <span className="text-label" style={{ color: 'var(--text-tertiary)' }}>핵심 해석</span>
          </div>
          <div className="card-body space-y-3">
            {result.lv3_5.coreCopy.map((copy, i) => (
              <div key={i} className="list-item">
                <span className={`list-icon ${gradeBgClass} ${gradeTextClass}`}>
                  {i + 1}
                </span>
                <span className="list-content">{copy}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions & Risks */}
        <div className="grid md:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
          <div className="card animate-fade-up delay-5">
            <div className="card-header">
              <span className="text-label" style={{ color: 'var(--text-tertiary)' }}>추천 액션</span>
              <span className="tag grade-bg-a grade-text-a" style={{ border: 'none' }}>+{result.lv3_5.actions.length}</span>
            </div>
            <div className="card-body space-y-3">
              {result.lv3_5.actions.map((action, i) => (
                <div key={i} className="list-item">
                  <span className="list-icon grade-bg-a grade-text-a">+</span>
                  <span className="list-content">{action}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card animate-fade-up delay-5">
            <div className="card-header">
              <span className="text-label" style={{ color: 'var(--text-tertiary)' }}>주의 리스크</span>
              <span className="tag grade-bg-c grade-text-c" style={{ border: 'none' }}>!{result.lv3_5.risks.length}</span>
            </div>
            <div className="card-body space-y-3">
              {result.lv3_5.risks.map((risk, i) => (
                <div key={i} className="list-item">
                  <span className="list-icon grade-bg-c grade-text-c">!</span>
                  <span className="list-content">{risk}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="panel animate-fade-up delay-6">
          <div className="flex gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }}>
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 16v-4m0-4h.01"/>
            </svg>
            <p className="text-caption" style={{ color: 'var(--text-tertiary)', lineHeight: '1.6' }}>
              본 분석은 서울시 상권분석서비스의 공공데이터를 기반으로 한 참고 자료입니다.
              실제 창업 결정 시에는 현장 조사, 전문가 상담 등 추가적인 검토가 필요합니다.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 text-center" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <p className="text-caption" style={{ color: 'var(--text-muted)' }}>
          OpenRisk &middot; 초보 창업자를 위한 상권 분석 서비스
        </p>
      </footer>
    </div>
  )
}

export default function ResultPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center grid-bg">
        <p className="text-body" style={{ color: 'var(--text-secondary)' }}>로딩 중...</p>
      </div>
    }>
      <ResultContent />
    </Suspense>
  )
}
