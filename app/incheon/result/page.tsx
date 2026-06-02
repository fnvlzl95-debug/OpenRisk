'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  BookOpen,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Download,
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
import { confidenceLabel, deriveMetricState, metricScoreText, metricStateTag } from '@/lib/incheon/display'

// 종합 점수에 반영되는 4개 지표(survival은 별도 '복합 위험 신호'로 분리)
const metricConfig = [
  { key: 'competition', label: '경쟁 과밀', body: '비슷한 매장이 몰려 있는 정도', icon: Users, color: '#FF8A1F' },
  { key: 'transit', label: '유입 부족', body: '고객이 찾아오기 불편한 정도', icon: Route, color: '#2D8CFF' },
  { key: 'cost', label: '비용 부담', body: '예상되는 임대료와 공실 부담', icon: Building2, color: '#20C7E8' },
  { key: 'anchor', label: '앵커 부족', body: '사람을 모으는 주요 시설(역, 학교 등) 부족', icon: Store, color: '#8B5CF6' },
] as const

function riskBand(score: number | null) {
  if (score === null) return 'unknown'
  if (score >= 67) return 'high'
  if (score >= 45) return 'medium'
  return 'low'
}

function interpretationTitle(label: string, score: number | null) {
  const band = riskBand(score)
  if (band === 'unknown') return `${label} 정보 부족`
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
      if (band === 'medium') return '비슷한 매장 분포를 보면 경쟁 압박이 생길 수 있어 주변 점포 구성을 비교해야 합니다.'
      return '비슷한 매장 밀집 부담은 낮은 편이지만 수요 규모와 기존 단골 구조는 확인해야 합니다.'
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
      if (band === 'high') return '교통과 보행 접근성이 떨어져, 지나가다 들르는 손님을 기대하기 어렵습니다.'
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
      if (band === 'high') return '임대료와 공실률을 보면 매월 나가는 고정비용이 매출에 큰 부담이 될 수 있습니다.'
      if (band === 'medium') return '통계상 임대료는 평균 수준이지만, 실제 매장의 보증금과 권리금은 꼭 따로 확인하세요.'
      return '비용 부담은 낮은 편이지만 보증금, 권리금, 관리비까지 함께 비교해야 합니다.'
    },
    icon: Building2,
    color: '#16B8C8',
    tone: 'border-[#C9F0F5] bg-[#F6FEFF]',
  },
  {
    key: 'anchor',
    label: '앵커 부족',
    body: (score: number | null) => {
      const band = riskBand(score)
      if (band === 'high') return '주변에 사람을 모으는 시설이 부족해, 고객이 일부러 찾아오게 만들 강력한 무기(브랜드/마케팅)가 필요합니다.'
      if (band === 'medium') return '사람을 모으는 시설이 일부 있지만 우리 매장 자체의 방문 이유도 함께 확인해야 합니다.'
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
  if (level === 'high') return '높음'
  if (level === 'medium') return '보통'
  if (level === 'low') return '낮음'
  return '직접 확인'
}

function riskSignal(score: number | null) {
  const band = riskBand(score)
  if (band === 'high') return '높음'
  if (band === 'medium') return '보통'
  if (band === 'low') return '낮음'
  return '정보 부족'
}

function positiveSignalFromRisk(score: number | null) {
  const band = riskBand(score)
  if (band === 'high') return '낮음'
  if (band === 'medium') return '보통'
  if (band === 'low') return '높음'
  return '정보 부족'
}

function summarySentence(result: IncheonAnalyzeResponse, topRows: ReturnType<typeof buildInterpretationRows>) {
  const first = topRows[0]?.label ?? '주요 위험 요인'
  const second = topRows[1]?.label
  const pair = second ? `${first}, ${second}` : first
  const score = result.risk.score ?? 0

  if (score >= 67) {
    return `${pair} 위험이 큽니다. 계약 전 현장 확인이 꼭 필요한 위치입니다.`
  }
  if (score >= 45) {
    return `${pair}을(를) 중심으로 꼼꼼히 따져봐야 하는 주의 단계입니다.`
  }
  return `${pair}은 상대적으로 낮지만 실제 이동 경로와 임대 조건 확인은 필요합니다.`
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
      label: '교육·가족 중심의 동네',
      status: qualitativeSignal(education.level),
      body: '학교와 어린이집이 가깝지만, 학생과 학부모가 실제로 우리 매장 앞을 지나가는지는 직접 확인해 보세요.',
    },
    {
      label: '고객이 찾아오기 쉬운 정도',
      status: positiveSignalFromRisk(byKey.transit?.score ?? null),
      body: byKey.transit?.body ?? '교통과 보행 접근성을 확인해야 합니다.',
    },
    {
      label: '주변 매장들과의 경쟁',
      status: byKey.competition?.status ?? '정보 부족',
      body: byKey.competition?.body ?? '비슷한 매장 밀집 구조를 확인해야 합니다.',
    },
    {
      label: '비용 부담',
      status: byKey.cost?.status ?? '정보 부족',
      body: byKey.cost?.body ?? '임대료·공실률 기반 비용 부담을 확인해야 합니다.',
    },
  ]
}

function statusTone(status: string) {
  if (status === '높음' || status === '위험') {
    return 'bg-[#FFF1E8] text-[#F06A1A]'
  }
  if (status === '주의' || status === '보통') {
    return 'bg-[#EEF5FF] text-[#0B66FF]'
  }
  if (status === '낮음') {
    return 'bg-[#ECFDF3] text-[#1C9B5F]'
  }
  return 'bg-[#F2F5F9] text-[#6B7A90]'
}

function scoreLevel(score: number | null) {
  if (score === null) return { text: '정보 부족', color: '#6B7A90', bars: 2, caption: '직접 확인' }
  const bars = Math.round(score / 10)
  if (score >= 67) return { text: '높음', color: '#FF6B1D', bars, caption: '우선 확인' }
  if (score >= 45) return { text: '보통', color: '#0B66FF', bars, caption: '조건 점검' }
  return { text: '낮음', color: '#25B866', bars, caption: '상대적으로 낮음' }
}

function RiskPanel({ result }: { result: IncheonAnalyzeResponse }) {
  const rows = metricConfig.map((item) => {
    const score = result.risk.scoreBreakdown[item.key]
    const excluded = result.risk.excludedMetrics.includes(item.key)
    const degraded = result.risk.degradedMetrics.includes(item.key)
    const state = deriveMetricState(score, { excluded, degraded, confidence: result.risk.confidence })
    return { ...item, score, state }
  })
  const survival = result.risk.survival
  const gaugeScore = result.risk.score ?? 0

  return (
    <section className="h-full border border-[#3845A0] bg-[#06112A]/92 p-8 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <h2 className="text-center text-2xl font-black">예상 위험도</h2>
      <div className="mt-5 flex items-center justify-center gap-5">
        <span className="bg-[linear-gradient(180deg,#FFB14A,#FF651F)] bg-clip-text text-8xl font-black leading-none text-transparent">
          {result.risk.score ?? '—'}
        </span>
        <span className="border border-[#FF8A1F] bg-[#2B1B09] px-5 py-3 text-2xl font-black text-[#FFB14A]">
          {riskLevelText(result)}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 text-sm font-bold">
        <span className="bg-white/10 px-3 py-1 text-white/78">신뢰도 {confidenceLabel(result.risk.confidence ?? 'medium')}</span>
        {result.risk.degradedMetrics.length > 0 && (
          <span className="bg-[#3a2a12] px-3 py-1 text-[#FFC780]">일부 데이터 제한</span>
        )}
      </div>

      <div className="mt-7">
        <div className="relative h-2 bg-[linear-gradient(90deg,#47D78D_0%,#47D78D_24%,#2D8CFF_24%,#2D8CFF_50%,#FDBA3B_50%,#FDBA3B_74%,#FF4B4B_74%,#FF4B4B_100%)]">
          <span className="absolute top-1/2 h-7 w-7 -translate-y-1/2 border-4 border-white bg-[#FF8A1F]" style={{ left: `${Math.min(92, gaugeScore)}%` }} />
        </div>
        <div className="mt-4 grid grid-cols-4 text-center text-base font-black text-white/82">
          <span>안전</span>
          <span>보통</span>
          <span className="text-[#FFB14A]">주의</span>
          <span>위험</span>
        </div>
      </div>

      <p className="mt-7 border-b border-white/12 pb-7 text-center text-lg font-bold text-white/84">
        4대 요인은 모두 높을수록 위험합니다. (복합 위험 신호는 참고용)
      </p>

      <div className="mt-7 space-y-5">
        {rows.map((row) => {
          const level = scoreLevel(row.score)
          const filledBars = row.score === null ? 0 : Math.max(0, Math.min(10, level.bars))
          const tag = metricStateTag(row.state)
          const available = row.state.status === 'available' || row.state.status === 'degraded'
          const Icon = row.icon
          return (
            <div key={row.key} className="grid gap-3 border-t border-white/10 pt-4 first:border-t-0 first:pt-0 sm:grid-cols-[42px_minmax(0,1fr)_44px] sm:items-center">
              <span className="flex h-9 w-9 items-center justify-center bg-white/8">
                <Icon className="h-5 w-5" style={{ color: row.color }} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-lg font-black">{row.label}</span>
                  {available ? (
                    <span className="text-sm font-black" style={{ color: level.color }}>
                      {level.text}
                    </span>
                  ) : (
                    <span className="text-sm font-black text-white/50">{tag}</span>
                  )}
                  {available && tag ? (
                    <span className="bg-[#3a2a12] px-2 py-0.5 text-xs font-bold text-[#FFC780]">{tag}</span>
                  ) : (
                    available && <span className="text-xs font-bold text-white/45">{level.caption}</span>
                  )}
                </div>
                <p className="mt-1 text-sm font-semibold text-white/58">{row.body}</p>
                <div className="mt-3 flex h-5 gap-1.5" aria-label={`${row.label} ${metricScoreText(row.state)}`}>
                  {Array.from({ length: 10 }).map((_, index) => (
                    <span
                      key={index}
                      className="min-w-0 flex-1"
                      style={{ backgroundColor: index < filledBars ? row.color : 'rgba(255,255,255,0.12)' }}
                    />
                  ))}
                </div>
              </div>
              <span className="text-right text-lg font-black">{metricScoreText(row.state)}</span>
            </div>
          )
        })}
      </div>

      <div className="mt-7 grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-[42px_minmax(0,1fr)_44px] sm:items-center">
        <span className="flex h-9 w-9 items-center justify-center bg-white/8">
          <ShieldCheck className="h-5 w-5 text-[#47C978]" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-lg font-black">{survival.label}</span>
            <span className="bg-white/10 px-2 py-0.5 text-xs font-bold text-white/60">종합 점수 미반영 · 참고</span>
          </div>
          <p className="mt-1 text-sm font-semibold text-white/58">
            경쟁·비용·접근성을 조합한 참고 신호입니다. 실제 폐업률 데이터가 아닙니다.
          </p>
        </div>
        <span className="text-right text-lg font-black text-white/80">{survival.score}</span>
      </div>
    </section>
  )
}

function ConfidenceNotice({ result }: { result: IncheonAnalyzeResponse }) {
  const reasons = result.risk.confidenceReasons ?? []
  const generatedAt = result.auxiliary?.datasetGeneratedAt
  const baseDate = generatedAt ? new Date(generatedAt).toLocaleDateString('ko-KR') : null

  return (
    <section className="border border-[#D7E1F0] bg-[#F8FBFF] p-6 md:p-7">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm font-black text-[#2F52D9]">
          <ShieldCheck className="h-5 w-5" strokeWidth={1.8} />
          <span>데이터 신뢰도</span>
        </div>
        <span className="bg-[#EEF5FF] px-3 py-1 text-xs font-black text-[#0B66FF]">
          종합 신뢰도 {confidenceLabel(result.risk.confidence ?? 'medium')}
        </span>
        {baseDate && (
          <span className="text-xs font-bold text-[#6B7A90]">데이터 기준일 {baseDate}</span>
        )}
      </div>
      {reasons.length > 0 && (
        <ul className="mt-4 space-y-2">
          {reasons.map((reason) => (
            <li key={reason} className="flex gap-2 text-sm font-semibold leading-6 text-[#53657E]">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#9AA8BA]" />
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function InsufficientPanel({ result }: { result: IncheonAnalyzeResponse }) {
  return (
    <section className="flex h-full flex-col justify-center border border-[#3845A0] bg-[#06112A]/92 p-8 text-white">
      <h2 className="text-2xl font-black">분석 제한 지역</h2>
      <p className="mt-4 text-base font-semibold leading-7 text-white/72">
        {result.risk.notice ??
          '해당 위치 주변에는 점포·교통·생활권 데이터가 부족해 종합 점수를 제공하지 않습니다. 지도와 원자료만 참고해 주세요.'}
      </p>
      <p className="mt-6 text-sm font-bold text-white/55">
        상권 데이터가 부족한 구역은 위험이 낮은 것이 아니라 판단을 보류한 상태입니다.
      </p>
    </section>
  )
}

function verdictTone(level: IncheonAnalyzeResponse['risk']['level']) {
  if (level === 'VERY_HIGH') return '#E8400C'
  if (level === 'HIGH') return '#F06A1A'
  if (level === 'MEDIUM') return '#0B66FF'
  return '#1C9B5F'
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
  const tone = verdictTone(result.risk.level)

  return (
    <div className="space-y-5">
      {/* 분석 요약 배너 */}
      <section className="overflow-hidden border border-[#D7E1F0] bg-white shadow-[0_12px_30px_rgba(8,26,52,0.05)]">
        <div className="grid md:grid-cols-[1.25fr_1fr]">
          <div className="p-7 md:p-9">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#EEF5FF] px-3 py-1 text-xs font-black text-[#2F52D9]">
              <Sparkles className="h-4 w-4" strokeWidth={2} /> 분석 요약
            </span>
            <h2 className="mt-5 text-[34px] font-black leading-[1.12] tracking-[-0.03em] text-[#061B3A] md:text-[40px]">
              종합 위험 <span style={{ color: tone }}>{riskLevelText(result)}</span> 단계
            </h2>
            <p className="mt-4 max-w-[48ch] text-base font-semibold leading-7 text-[#53657E]">
              {summarySentence(result, topRows)}
            </p>
          </div>
          <div className="border-t border-[#E6EDF6] bg-[#F7FAFF] p-7 md:border-l md:border-t-0">
            <p className="text-xs font-black uppercase tracking-wide text-[#6B7A90]">가장 큰 위험 요인</p>
            <div className="mt-4 space-y-4">
              {topRows.map((row, index) => {
                const lvl = scoreLevel(row.score)
                return (
                  <div key={row.key}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-[#061B3A]">{index + 1}. {row.label}</span>
                      <span className="text-sm font-black" style={{ color: lvl.color }}>{row.score}</span>
                    </div>
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#E6EDF6]">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, row.score ?? 0)}%`, background: lvl.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 핵심 위험 요인 */}
      <section className="border border-[#D7E1F0] bg-white p-7 shadow-[0_12px_30px_rgba(8,26,52,0.04)] md:p-9">
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2 text-base font-black text-[#061B3A]">
            <FileText className="h-5 w-5 text-[#F06A1A]" strokeWidth={1.9} /> 핵심 위험 요인
          </span>
          <span className="text-xs font-bold text-[#9AA8BA]">막대가 길수록 위험</span>
        </div>
        <div className="mt-6 space-y-5">
          {rankedRows.map((row, index) => {
            const lvl = scoreLevel(row.score)
            const priority = topRows.some((topRow) => topRow.key === row.key)
            return (
              <div key={row.key} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-start gap-4">
                <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#F2F5F9] text-xs font-black text-[#53657E]">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-black text-[#061B3A]">{row.label}</span>
                    <span className={`px-2 py-0.5 text-[11px] font-black ${statusTone(lvl.text)}`}>{lvl.text}</span>
                    {priority && <span className="bg-[#FFF1E8] px-2 py-0.5 text-[11px] font-black text-[#F06A1A]">우선 확인</span>}
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#EDF2F8]">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, row.score ?? 0)}%`, background: lvl.color }} />
                  </div>
                  <p className="mt-2 text-xs font-semibold leading-5 text-[#6B7A90]">{row.body}</p>
                </div>
                <span className="text-2xl font-black tabular-nums" style={{ color: lvl.color }}>{row.score}</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* 생활권 해석 + 현장 체크리스트 */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="border border-[#D7E1F0] bg-white p-7 shadow-[0_12px_30px_rgba(8,26,52,0.04)] md:p-8">
          <span className="inline-flex items-center gap-2 text-base font-black text-[#061B3A]">
            <BookOpen className="h-5 w-5 text-[#2F52D9]" strokeWidth={1.9} /> 쉽게 읽는 생활권 해석
          </span>
          <div className="mt-5 space-y-3">
            {signals.map((signal) => (
              <div key={signal.label} className="flex gap-3 border border-[#E3EAF4] bg-[#FBFDFF] p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#0B66FF]" strokeWidth={1.8} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-black text-[#061B3A]">{signal.label}</p>
                    <span className={`shrink-0 px-2 py-0.5 text-[11px] font-black ${statusTone(signal.status)}`}>{signal.status}</span>
                  </div>
                  <p className="mt-1.5 text-sm font-semibold leading-6 text-[#53657E]">{signal.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="border border-[#D7E1F0] bg-white p-7 shadow-[0_12px_30px_rgba(8,26,52,0.04)] md:p-8">
          <span className="inline-flex items-center gap-2 text-base font-black text-[#061B3A]">
            <ClipboardCheck className="h-5 w-5 text-[#0B66FF]" strokeWidth={1.9} /> 계약 전 현장 체크리스트
          </span>
          <div className="mt-5 space-y-2.5">
            {fieldQuestions.map((question, index) => (
              <div key={question} className="flex items-start gap-3 border border-[#E3EAF4] bg-white p-3.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0B66FF] text-xs font-black text-white">
                  {index + 1}
                </span>
                <p className="text-sm font-bold leading-6 text-[#243653]">{question}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

type ErrorView = { title: string; description: string; action: string }

function getErrorView(
  status: number,
  data: { code?: string; error?: string; missingDatasets?: string[] }
): ErrorView {
  if (status === 503 && data.code === 'DATASET_NOT_READY') {
    return {
      title: '일부 데이터 준비 중',
      description: data.missingDatasets?.length
        ? `현재 ${data.missingDatasets.join(', ')} 데이터가 준비되지 않아 분석할 수 없습니다.`
        : '인천 지역 데이터를 최신화하고 있습니다.',
      action: '잠시 후 다시 시도해 주세요.',
    }
  }
  if (status === 422) {
    return {
      title: '인천 분석 범위를 벗어난 위치입니다',
      description: 'OpenRisk 인천은 현재 인천시 경계 안의 위치만 분석합니다.',
      action: '인천 내 주소를 다시 검색해 주세요.',
    }
  }
  if (status === 400) {
    return {
      title: '요청 값을 확인해 주세요',
      description: '좌표 또는 업종 값이 올바르지 않습니다.',
      action: '검색 화면에서 다시 선택해 주세요.',
    }
  }
  return {
    title: '분석 중 오류가 발생했습니다',
    description: data.error || '일시적인 오류일 수 있습니다.',
    action: '잠시 후 다시 시도해 주세요.',
  }
}

function ResultContent() {
  const searchParams = useSearchParams()
  const lat = Number(searchParams.get('lat') || '37.3897')
  const lng = Number(searchParams.get('lng') || '126.6454')
  const category = searchParams.get('category') || INCHEON_DEFAULT_CATEGORY
  const query = searchParams.get('query') || '인천 연수구 송도동'

  const [result, setResult] = useState<IncheonAnalyzeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorView, setErrorView] = useState<ErrorView | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)

  async function handleDownloadPdf() {
    if (!result || pdfLoading) return
    setPdfLoading(true)
    try {
      const { generateIncheonPdfClient } = await import('@/lib/incheon/generate-pdf-client')
      await generateIncheonPdfClient(result)
    } catch {
      window.alert('PDF 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setPdfLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    async function run() {
      setLoading(true)
      setErrorView(null)
      try {
        const response = await fetch('/api/incheon/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng, targetCategory: category }),
          signal: controller.signal,
        })
        const data = await response.json()
        if (!response.ok) {
          setResult(null)
          setErrorView(getErrorView(response.status, data))
          return
        }
        setResult(data)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setResult(null)
        setErrorView(getErrorView(0, {}))
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

          {errorView && !loading && (
            <div className="mt-7 border border-[#FFB999] bg-white p-8">
              <h1 className="text-2xl font-black">{errorView.title}</h1>
              <p className="mt-3 text-base font-semibold text-[#53657E]">{errorView.description}</p>
              <p className="mt-2 text-sm font-bold text-[#0B66FF]">{errorView.action}</p>
            </div>
          )}

          {result && !loading && (
            <>
              <div className="mt-5 flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={pdfLoading}
                  className="inline-flex items-center gap-2 border border-[#2D7BFF] bg-[#0B66FF] px-4 py-2 text-sm font-black text-white transition-colors hover:bg-[#0A57DB] disabled:opacity-60"
                >
                  <Download className="h-4 w-4" strokeWidth={2.2} />
                  {pdfLoading ? 'PDF 만드는 중…' : 'PDF 리포트 저장'}
                </button>
              </div>
              <div className="mt-3 grid flex-1 gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(430px,0.72fr)] lg:items-stretch">
                <RiskAnalysisMapCard center={mapCenter} radius={500} riskCells={result.riskMapCells} locationLabel={query} />
                {result.risk.insufficientData ? <InsufficientPanel result={result} /> : <RiskPanel result={result} />}
              </div>
            </>
          )}
        </div>
      </section>

      {result && !loading && (
        <section className="bg-white px-5 py-8 lg:px-8">
          <div className="mx-auto max-w-7xl space-y-7">
            {!result.risk.insufficientData && (
              <ResultDashboard result={result} rows={interpretationRows} signals={livingSignals} />
            )}
            <ConfidenceNotice result={result} />
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
