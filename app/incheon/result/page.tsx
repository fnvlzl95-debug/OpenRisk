'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  FileText,
  Route,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
} from 'lucide-react'
import IncheonHeader from '@/components/incheon/IncheonHeader'
import IncheonFooter from '@/components/incheon/IncheonFooter'
import SearchPanel from '@/components/incheon/SearchPanel'
import DataSourcePanel from '@/components/incheon/DataSourcePanel'
import RiskAnalysisMapCard from '@/components/incheon/RiskAnalysisMapCard'
import type { IncheonAnalyzeResponse } from '@/lib/incheon/types'
import { INCHEON_DEFAULT_CATEGORY } from '@/lib/incheon/constants'

const metricConfig = [
  { key: 'competition', label: '경쟁 과밀', body: '동종 업종이 몰린 정도', icon: Users, color: '#FF8A1F' },
  { key: 'transit', label: '유입 부족', body: '교통·보행 유입이 약한 정도', icon: Route, color: '#2D8CFF' },
  { key: 'cost', label: '비용 부담', body: '임대료·공실 비용 부담', icon: Building2, color: '#20C7E8' },
  { key: 'survival', label: '폐업 위험', body: '업종이 버티기 어려운 정도', icon: ShieldCheck, color: '#47C978' },
  { key: 'anchor', label: '앵커 부족', body: '주변 핵심 유입 시설 부족', icon: Store, color: '#8B5CF6' },
] as const

function riskBand(score: number | null) {
  if (score === null) return 'unknown'
  if (score >= 67) return 'high'
  if (score >= 45) return 'medium'
  return 'low'
}

function interpretationTitle(label: string, score: number | null) {
  const band = riskBand(score)
  if (band === 'unknown') return `${label} 확인 필요`
  if (band === 'high') return `${label}이 높아요`
  if (band === 'medium') return `${label}은 주의 단계예요`
  return `${label}은 낮은 편이에요`
}

const interpretationConfig = [
  {
    key: 'competition',
    label: '경쟁 과밀',
    body: (score: number | null) => {
      const band = riskBand(score)
      if (band === 'high') return '반경 내 같은 업종이 밀집해 고객 분산과 가격 경쟁 압박이 큽니다.'
      if (band === 'medium') return '동종 업종 분포를 보면 경쟁 압박이 생길 수 있어 주변 점포 구성을 비교해야 합니다.'
      return '동종 업종 밀집 부담은 낮은 편이지만 수요 규모와 기존 단골 구조는 확인해야 합니다.'
    },
    icon: Users,
    color: '#FF6B1D',
    tone: 'border-[#FFD4BF] bg-[#FFF8F4]',
  },
  {
    key: 'transit',
    label: '유입 부족',
    body: (score: number | null) => {
      const band = riskBand(score)
      if (band === 'high') return '교통·보행 접근 신호가 약해 워킹 유입을 기대하기 어려운 구조입니다.'
      if (band === 'medium') return '기본 유입은 있지만 시간대와 보행 동선에 따라 매출 공백이 생길 수 있습니다.'
      return '정류장과 역 접근 신호가 있어 유입 부족 위험은 상대적으로 작습니다.'
    },
    icon: Route,
    color: '#0B66FF',
    tone: 'border-[#CDE0FF] bg-[#F7FAFF]',
  },
  {
    key: 'cost',
    label: '비용 부담',
    body: (score: number | null) => {
      const band = riskBand(score)
      if (band === 'unknown') return '비용 데이터가 충분하지 않아 실제 임대 조건을 별도로 확인해야 합니다.'
      if (band === 'high') return '임대료·공실률 기준 비용 부담이 커 손익분기점이 높아질 수 있습니다.'
      if (band === 'medium') return '공식 통계상 비용 부담은 평균권이지만 실제 임대 조건 확인이 필요합니다.'
      return '비용 부담은 낮은 편이지만 보증금, 권리금, 관리비까지 함께 비교해야 합니다.'
    },
    icon: Building2,
    color: '#16B8C8',
    tone: 'border-[#C9F0F5] bg-[#F6FEFF]',
  },
  {
    key: 'survival',
    label: '폐업 위험',
    body: (score: number | null) => {
      const band = riskBand(score)
      if (band === 'high') return '업종 특성과 주변 경쟁을 함께 보면 버티기 어려운 신호가 강합니다.'
      if (band === 'medium') return '폐업 위험은 주의 단계라 초기 고정비와 회수 기간을 보수적으로 잡아야 합니다.'
      return '폐업 위험은 낮은 편이지만 기존 업체의 단골 장벽은 현장에서 확인해야 합니다.'
    },
    icon: ShieldCheck,
    color: '#25B866',
    tone: 'border-[#D5F2DF] bg-[#F8FFF9]',
  },
  {
    key: 'anchor',
    label: '앵커 부족',
    body: (score: number | null) => {
      const band = riskBand(score)
      if (band === 'high') return '주변 핵심 유입 시설이 약해 브랜드력이나 목적 방문을 직접 만들어야 합니다.'
      if (band === 'medium') return '주변 유입 시설이 일부 있지만 자체 집객력도 함께 확인해야 합니다.'
      return '앵커 부족 위험은 낮은 편이라 주변 시설 유입을 활용할 여지가 있습니다.'
    },
    icon: Store,
    color: '#7957F2',
    tone: 'border-[#DDD3FF] bg-[#FAF8FF]',
  },
] as const

function riskLevelText(result: IncheonAnalyzeResponse | null) {
  if (!result) return ''
  if (result.risk.level === 'VERY_HIGH') return '위험'
  if (result.risk.level === 'HIGH') return '주의'
  if (result.risk.level === 'MEDIUM') return '주의'
  return '보통'
}

function qualitativeSignal(level: 'high' | 'medium' | 'low' | 'unknown') {
  if (level === 'high') return '강함'
  if (level === 'medium') return '보통'
  if (level === 'low') return '약함'
  return '확인 필요'
}

function riskSignal(score: number | null) {
  const band = riskBand(score)
  if (band === 'high') return '높음'
  if (band === 'medium') return '주의'
  if (band === 'low') return '낮음'
  return '확인 필요'
}

function summarySentence(result: IncheonAnalyzeResponse, topRows: ReturnType<typeof buildInterpretationRows>) {
  const first = topRows[0]?.label ?? '주요 위험 요인'
  const second = topRows[1]?.label
  const pair = second ? `${first}과 ${second}` : first

  if (result.risk.score >= 67) {
    return `${pair}이 두드러져 현장 확인을 먼저 해야 하는 위치입니다.`
  }
  if (result.risk.score >= 45) {
    return `${pair}을 중심으로 조건을 점검해야 하는 주의 단계입니다.`
  }
  return `${pair}은 상대적으로 낮지만 실제 동선과 임대 조건 확인은 필요합니다.`
}

function buildInterpretationRows(result: IncheonAnalyzeResponse) {
  return interpretationConfig.map((card) => {
    const score = result.risk.scoreBreakdown[card.key]
    return {
      ...card,
      score,
      title: interpretationTitle(card.label, score),
      body: card.body(score),
      status: riskSignal(score),
    }
  })
}

function buildLivingSignals(result: IncheonAnalyzeResponse, rows: ReturnType<typeof buildInterpretationRows>) {
  const byKey = Object.fromEntries(rows.map((row) => [row.key, row]))
  const education = result.lifeDNA.educationFamily

  return [
    {
      label: '교육·가족 생활권',
      status: qualitativeSignal(education.level),
      body: '교육·보육 접근성은 분석에 반영했습니다. 실제 고객 동선은 현장에서 확인해야 합니다.',
    },
    {
      label: '유입 신호',
      status: byKey.transit?.status ?? '확인 필요',
      body: byKey.transit?.body ?? '교통·보행 접근 신호를 확인해야 합니다.',
    },
    {
      label: '경쟁 구조',
      status: byKey.competition?.status ?? '확인 필요',
      body: byKey.competition?.body ?? '동종 업종 밀집 구조를 확인해야 합니다.',
    },
    {
      label: '비용 부담',
      status: byKey.cost?.status ?? '확인 필요',
      body: byKey.cost?.body ?? '임대료·공실률 기반 비용 부담을 확인해야 합니다.',
    },
  ]
}

function statusTone(status: string) {
  if (status === '높음' || status === '위험' || status === '강함') {
    return 'bg-[#FFF1E8] text-[#F06A1A]'
  }
  if (status === '주의' || status === '보통') {
    return 'bg-[#EEF5FF] text-[#0B66FF]'
  }
  if (status === '낮음' || status === '약함') {
    return 'bg-[#ECFDF3] text-[#1C9B5F]'
  }
  return 'bg-[#F2F5F9] text-[#6B7A90]'
}

function SummaryIllustration() {
  return (
    <div className="relative hidden min-h-[170px] md:block" aria-hidden="true">
      <div className="absolute left-10 top-12 h-20 w-20 rounded-[18px] bg-[#DFF7EC] shadow-[0_18px_34px_rgba(11,102,255,0.08)]" />
      <div className="absolute left-28 top-6 h-24 w-24 rounded-[20px] bg-[#FFE6B8] shadow-[0_20px_42px_rgba(240,106,26,0.13)]" />
      <div className="absolute left-36 top-20 h-24 w-24 rounded-[20px] bg-[#FF8A2A] shadow-[0_22px_44px_rgba(240,106,26,0.18)]" />
      <div className="absolute left-48 top-36 h-16 w-16 rounded-[14px] bg-[#2F72FF] shadow-[0_18px_34px_rgba(11,102,255,0.2)]" />
      <div className="absolute left-8 top-3 h-24 w-24 rounded-full border-[10px] border-[#CDE9FF] bg-white/80 shadow-[0_16px_34px_rgba(8,26,52,0.12)]" />
      <div className="absolute left-0 top-20 h-16 w-5 rotate-45 rounded-full bg-[#496CE9] shadow-[0_14px_24px_rgba(73,108,233,0.2)]" />
    </div>
  )
}

function scoreLevel(score: number | null) {
  if (score === null) return { text: '확인 필요', color: '#6B7A90', bars: 2, caption: '데이터 확보 전' }
  const bars = Math.round(score / 10)
  if (score >= 67) return { text: '위험 큼', color: '#FF6B1D', bars, caption: '우선 확인 필요' }
  if (score >= 45) return { text: '주의', color: '#0B66FF', bars, caption: '조건 확인 필요' }
  return { text: '낮음', color: '#25B866', bars, caption: '상대적으로 양호' }
}

function RiskPanel({ result }: { result: IncheonAnalyzeResponse }) {
  const rows = metricConfig.map((item) => {
    const score = result.risk.scoreBreakdown[item.key]
    return { ...item, score }
  })

  return (
    <section className="h-full border border-[#3845A0] bg-[#06112A]/92 p-8 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <h2 className="text-center text-2xl font-black">예상 위험도</h2>
      <div className="mt-5 flex items-center justify-center gap-5">
        <span className="bg-[linear-gradient(180deg,#FFB14A,#FF651F)] bg-clip-text text-8xl font-black leading-none text-transparent">
          {result.risk.score}
        </span>
        <span className="border border-[#FF8A1F] bg-[#2B1B09] px-5 py-3 text-2xl font-black text-[#FFB14A]">
          {riskLevelText(result)}
        </span>
      </div>

      <div className="mt-8">
        <div className="relative h-2 bg-[linear-gradient(90deg,#47D78D_0%,#47D78D_24%,#2D8CFF_24%,#2D8CFF_50%,#FDBA3B_50%,#FDBA3B_74%,#FF4B4B_74%,#FF4B4B_100%)]">
          <span className="absolute top-1/2 h-7 w-7 -translate-y-1/2 border-4 border-white bg-[#FF8A1F]" style={{ left: `${Math.min(92, result.risk.score)}%` }} />
        </div>
        <div className="mt-4 grid grid-cols-4 text-center text-base font-black text-white/82">
          <span>안전</span>
          <span>보통</span>
          <span className="text-[#FFB14A]">주의</span>
          <span>위험</span>
        </div>
      </div>

      <p className="mt-7 border-b border-white/12 pb-7 text-center text-lg font-bold text-white/84">
        5대 요인은 모두 높을수록 위험합니다.
      </p>

      <div className="mt-7 space-y-5">
        {rows.map((row) => {
          const level = scoreLevel(row.score)
          const filledBars = row.score === null ? 0 : Math.max(0, Math.min(10, level.bars))
          const Icon = row.icon
          return (
            <div key={row.key} className="grid gap-3 border-t border-white/10 pt-4 first:border-t-0 first:pt-0 sm:grid-cols-[42px_minmax(0,1fr)_44px] sm:items-center">
              <span className="flex h-9 w-9 items-center justify-center bg-white/8">
                <Icon className="h-5 w-5" style={{ color: row.color }} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-lg font-black">{row.label}</span>
                  <span className="text-sm font-black" style={{ color: level.color }}>
                    {level.text}
                  </span>
                  <span className="text-xs font-bold text-white/45">{level.caption}</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-white/58">{row.body}</p>
                <div className="mt-3 flex h-5 gap-1.5" aria-label={`${row.label} ${row.score ?? '확인 필요'}`}>
                  {Array.from({ length: 10 }).map((_, index) => (
                    <span
                      key={index}
                      className="min-w-0 flex-1"
                      style={{ backgroundColor: index < filledBars ? row.color : 'rgba(255,255,255,0.12)' }}
                    />
                  ))}
                </div>
              </div>
              <span className="text-right text-lg font-black">{row.score ?? '-'}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function ResultDashboard({
  result,
  rows,
  signals,
}: {
  result: IncheonAnalyzeResponse
  rows: ReturnType<typeof buildInterpretationRows>
  signals: ReturnType<typeof buildLivingSignals>
}) {
  const rankedRows = [...rows]
    .filter((row) => row.score !== null)
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
  const topRows = rankedRows.slice(0, 2)
  const fieldQuestions = [
    ...result.cards.fieldChecks,
    '점포 전면 가시성, 간판 노출, 주차·배달 여건을 체크하세요.',
  ].slice(0, 5)

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <article className="min-h-[260px] border border-[#D7E1F0] bg-white p-6 shadow-[0_12px_30px_rgba(8,26,52,0.04)] md:p-8">
        <div className="flex items-center gap-2 text-sm font-black text-[#2F52D9]">
          <Sparkles className="h-5 w-5" strokeWidth={1.8} />
          <span>분석 요약</span>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-[minmax(0,1fr)_260px] md:items-center">
          <div>
            <h2 className="text-5xl font-black leading-tight tracking-[-0.04em] text-[#061B3A]">
              <span className="text-[#FF7A1A]">{riskLevelText(result)}</span> 단계입니다.
            </h2>
            <p className="mt-5 max-w-[46ch] text-base font-semibold leading-7 text-[#53657E]">
              {summarySentence(result, topRows)}
            </p>
          </div>
          <SummaryIllustration />
        </div>
      </article>

      <article className="min-h-[260px] border border-[#D7E1F0] bg-white p-6 shadow-[0_12px_30px_rgba(8,26,52,0.04)] md:p-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm font-black text-[#F06A1A]">
            <FileText className="h-5 w-5" strokeWidth={1.8} />
            <span>핵심 요인 하이라이트</span>
          </div>
          <span className="border border-[#D7E1F0] px-3 py-1 text-xs font-black text-[#6B7A90]">모두 보기</span>
        </div>

        <div className="mt-6 divide-y divide-[#EDF2F8]">
          {rankedRows.map((row, index) => (
            <div key={row.key} className="grid gap-3 py-3 first:pt-0 md:grid-cols-[36px_minmax(0,1fr)_80px_24px] md:items-center">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EEF5FF] text-xs font-black text-[#0B66FF]">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-black text-[#061B3A]">{row.label}</p>
                  <span className={`px-2 py-0.5 text-xs font-black ${statusTone(row.status)}`}>{row.status}</span>
                </div>
                <p className="mt-1 truncate text-xs font-semibold text-[#6B7A90]">{row.body}</p>
              </div>
              <span className="text-xs font-black text-[#6B7A90] md:text-right">
                {topRows.some((topRow) => topRow.key === row.key) ? '우선 확인' : '참고'}
              </span>
              <ChevronDown className="hidden h-4 w-4 text-[#9AA8BA] md:block" strokeWidth={2} />
            </div>
          ))}
        </div>
      </article>

      <article className="border border-[#D7E1F0] bg-white p-6 shadow-[0_12px_30px_rgba(8,26,52,0.04)] md:p-8">
        <div className="flex items-center gap-2 text-sm font-black text-[#2F52D9]">
          <BookOpen className="h-5 w-5" strokeWidth={1.8} />
          <span>완전 초보도 이해하는 해석</span>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {signals.map((signal) => (
            <div key={signal.label} className="border border-[#E3EAF4] bg-[#FBFDFF] p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-[#0B66FF]" strokeWidth={1.8} />
                <p className="text-sm font-black text-[#061B3A]">{signal.label}</p>
                <span className={`ml-auto px-2 py-0.5 text-xs font-black ${statusTone(signal.status)}`}>
                  {signal.status}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-[#53657E]">{signal.body}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="relative overflow-hidden border border-[#D7E1F0] bg-white p-6 shadow-[0_12px_30px_rgba(8,26,52,0.04)] md:p-8">
        <div className="flex items-center gap-2 text-sm font-black text-[#0B66FF]">
          <ClipboardCheck className="h-5 w-5" strokeWidth={1.8} />
          <span>현장에서 먼저 볼 것</span>
        </div>

        <div className="mt-6 space-y-3">
          {fieldQuestions.map((question, index) => (
            <div key={question} className="grid gap-3 border border-[#E3EAF4] bg-white p-3 md:grid-cols-[34px_minmax(0,1fr)] md:items-start">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0B66FF] text-xs font-black text-white">
                {String(index + 1).padStart(2, '0')}
              </span>
              <p className="text-sm font-black leading-6 text-[#243653]">{question}</p>
            </div>
          ))}
        </div>
      </article>
    </section>
  )
}

function ResultContent() {
  const searchParams = useSearchParams()
  const lat = Number(searchParams.get('lat') || '37.3897')
  const lng = Number(searchParams.get('lng') || '126.6454')
  const category = searchParams.get('category') || INCHEON_DEFAULT_CATEGORY
  const query = searchParams.get('query') || '인천 연수구 송도동'

  const [result, setResult] = useState<IncheonAnalyzeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    async function run() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch('/api/incheon/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng, targetCategory: category }),
          signal: controller.signal,
        })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || '분석에 실패했습니다.')
        }
        setResult(data)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : '분석에 실패했습니다.')
      } finally {
        setLoading(false)
      }
    }
    run()
    return () => controller.abort()
  }, [lat, lng, category])

  useEffect(() => {
    if (!result || !window.location.hash) return
    const target = document.querySelector(window.location.hash)
    if (!target) return
    requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }))
  }, [result])

  const interpretationRows = useMemo(() => (result ? buildInterpretationRows(result) : []), [result])
  const livingSignals = useMemo(
    () => (result ? buildLivingSignals(result, interpretationRows) : []),
    [result, interpretationRows]
  )
  const mapCenter = useMemo(() => ({ lat, lng }), [lat, lng])

  return (
    <main className="min-h-screen bg-white text-[#081A34]">
      <IncheonHeader />

      <section className="min-h-[calc(100dvh-78px)] bg-[#031B37] px-4 pb-6 pt-4 lg:px-6">
        <div className="flex min-h-[calc(100dvh-108px)] w-full flex-col">
          <SearchPanel compact initialQuery={query} initialCategory={category} />

          {loading && (
            <div className="mt-6 grid flex-1 gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(430px,0.72fr)]">
              <div className="min-h-[620px] animate-pulse border border-[#155396] bg-[#072A54]" />
              <div className="min-h-[620px] animate-pulse border border-[#155396] bg-[#06112A]" />
            </div>
          )}

          {error && (
            <div className="mt-7 border border-[#FFB999] bg-white p-8">
              <h1 className="text-2xl font-black">분석을 완료하지 못했습니다</h1>
              <p className="mt-3 text-base font-semibold text-[#53657E]">{error}</p>
            </div>
          )}

          {result && !loading && (
            <div className="mt-6 grid flex-1 gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(430px,0.72fr)] lg:items-stretch">
              <RiskAnalysisMapCard center={mapCenter} radius={500} riskCells={result.riskMapCells} locationLabel={query} />
              <RiskPanel result={result} />
            </div>
          )}
        </div>
      </section>

      {result && !loading && (
        <section className="bg-white px-5 py-8 lg:px-8">
          <div className="mx-auto max-w-7xl space-y-7">
            <ResultDashboard result={result} rows={interpretationRows} signals={livingSignals} />
            <DataSourcePanel sources={result.sources} />
          </div>
        </section>
      )}

      <IncheonFooter />
    </main>
  )
}

export default function IncheonResultPage() {
  return (
    <Suspense fallback={null}>
      <ResultContent />
    </Suspense>
  )
}
