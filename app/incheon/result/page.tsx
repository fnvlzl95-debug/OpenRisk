'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  BarChart3,
  Building2,
  Calendar,
  ChevronDown,
  ClipboardCheck,
  Database,
  Download,
  FileText,
  Route,
  Share2,
  Shield,
  ShieldCheck,
  Store,
  TrendingUp,
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

function riskSignal(score: number | null) {
  const band = riskBand(score)
  if (band === 'high') return '높음'
  if (band === 'medium') return '보통'
  if (band === 'low') return '낮음'
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

function scoreLevel(score: number | null) {
  if (score === null) return { text: '정보 부족', color: '#6B7A90', bars: 2, caption: '직접 확인' }
  const bars = Math.round(score / 10)
  if (score >= 67) return { text: '높음', color: '#FF6B1D', bars, caption: '우선 확인' }
  if (score >= 45) return { text: '보통', color: '#0B66FF', bars, caption: '조건 점검' }
  return { text: '낮음', color: '#25B866', bars, caption: '상대적으로 낮음' }
}

function RiskPanel({ result }: { result: IncheonAnalyzeResponse }) {
  const gaugeScore = result.risk.score ?? 0

  return (
    <section className="flex h-full flex-col justify-center border border-[#3845A0] bg-[#06112A]/92 p-8 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <h2 className="text-center text-2xl font-black">예상 위험도</h2>
      <div className="mt-6 flex items-center justify-center gap-5">
        <span className="bg-[linear-gradient(180deg,#FFB14A,#FF651F)] bg-clip-text text-8xl font-black leading-none text-transparent">
          {result.risk.score ?? '—'}
        </span>
        <span className="border border-[#FF8A1F] bg-[#2B1B09] px-5 py-3 text-2xl font-black text-[#FFB14A]">
          {riskLevelText(result)}
        </span>
      </div>

      <div className="mt-5 flex items-center justify-center gap-2 text-sm font-bold">
        <span className="bg-white/10 px-3 py-1 text-white/78">신뢰도 {confidenceLabel(result.risk.confidence ?? 'medium')}</span>
        {result.risk.degradedMetrics.length > 0 && (
          <span className="bg-[#3a2a12] px-3 py-1 text-[#FFC780]">일부 데이터 제한</span>
        )}
      </div>

      <div className="mt-8">
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

      <p className="mt-8 border-t border-white/12 pt-6 text-center text-sm font-semibold leading-6 text-white/64">
        0~100 종합 위험 점수입니다. 높을수록 위험하며,<br className="hidden sm:block" /> 세부 지표는 아래 진단 결과에서 확인하세요.
      </p>
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

function severityChip(score: number | null): { text: string; cls: string } {
  if (score === null) return { text: '정보 부족', cls: 'bg-[#F1F4F8] text-[#6B7A90]' }
  if (score >= 67) return { text: '높음', cls: 'bg-[#FFF1E8] text-[#EF6A12]' }
  if (score >= 45) return { text: '보통', cls: 'bg-[#EAF2FF] text-[#0B66FF]' }
  return { text: '낮음', cls: 'bg-[#EAFBF1] text-[#1C9B5F]' }
}

function actionChip(score: number | null): { text: string; cls: string } {
  if (score === null) return { text: '데이터 확인', cls: 'bg-[#F1F4F8] text-[#6B7A90]' }
  if (score >= 67) return { text: '우선 확인', cls: 'bg-[#FFF1E8] text-[#EF6A12]' }
  if (score >= 45) return { text: '확인 권장', cls: 'bg-[#EAF2FF] text-[#0B66FF]' }
  return { text: '양호', cls: 'bg-[#EAFBF1] text-[#1C9B5F]' }
}

function lifeChip(level: IncheonAnalyzeResponse['lifeDNA']['educationFamily']['level']): { text: string; cls: string } {
  if (level === 'high') return { text: '양호', cls: 'bg-[#EAFBF1] text-[#1C9B5F]' }
  if (level === 'medium') return { text: '보통', cls: 'bg-[#EAF2FF] text-[#0B66FF]' }
  if (level === 'low') return { text: '낮음', cls: 'bg-[#F1F4F8] text-[#6B7A90]' }
  return { text: '정보 부족', cls: 'bg-[#F1F4F8] text-[#6B7A90]' }
}

const confChip: Record<string, string> = {
  높음: 'bg-[#EAFBF1] text-[#1C9B5F]',
  중간: 'bg-[#EAF2FF] text-[#0B66FF]',
  낮음: 'bg-[#FFF1E8] text-[#EF6A12]',
}

function ResultDashboard({
  result,
  rows,
}: {
  result: IncheonAnalyzeResponse
  rows: ReturnType<typeof buildInterpretationRows>
}) {
  const [showAllSources, setShowAllSources] = useState(false)
  const tone = verdictTone(result.risk.level)
  const conf = confidenceLabel(result.risk.confidence ?? 'medium')

  // 지표 카드(글랜스용) — 점수에 반영되는 4개
  const metricCards = metricConfig.map((item) => {
    const score = result.risk.scoreBreakdown[item.key]
    const excluded = result.risk.excludedMetrics.includes(item.key)
    const degraded = result.risk.degradedMetrics.includes(item.key)
    const state = deriveMetricState(score, { excluded, degraded, confidence: result.risk.confidence })
    return { ...item, score, state }
  })
  // 핵심 위험 요인(왜+조치) — 상위 3개로 우선순위화
  const rankedRows = [...rows].filter((row) => row.score !== null).sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
  const topRows = rankedRows.slice(0, 3)
  const fieldQuestions = [...result.cards.fieldChecks, '점포 전면 가시성, 간판 노출, 주차·배달 여건을 체크하세요.'].slice(0, 5)
  const baseDate = result.auxiliary?.datasetGeneratedAt
    ? new Date(result.auxiliary.datasetGeneratedAt).toLocaleDateString('ko-KR')
    : '—'

  const survival = result.risk.survival
  const costAvailable = result.risk.scoreBreakdown.cost !== null
  const related = [
    { icon: ShieldCheck, title: '생활권 특성', chip: lifeChip(result.lifeDNA.educationFamily.level), body: result.lifeDNA.educationFamily.summary },
    { icon: Share2, title: '복합 위험 신호', chip: severityChip(survival.score), body: '경쟁·비용·접근성을 조합한 참고 신호입니다. 종합 점수에는 반영하지 않습니다.' },
    { icon: TrendingUp, title: '비용 데이터', chip: costAvailable ? { text: '확보', cls: 'bg-[#EAFBF1] text-[#1C9B5F]' } : { text: '정보 수집 중', cls: 'bg-[#F1F4F8] text-[#6B7A90]' }, body: result.lifeDNA.costPressure.summary },
    { icon: Database, title: '데이터 신뢰도', chip: { text: conf, cls: confChip[conf] ?? confChip['중간'] }, body: `공공데이터 ${result.sources.length}종을 기준으로 신뢰도를 산정했습니다.` },
  ]

  const stats = [
    { icon: ShieldCheck, label: '데이터 신뢰도', value: conf },
    { icon: FileText, label: '참고자료 수', value: `${result.sources.length}건` },
    { icon: BarChart3, label: '수집 지표 수', value: `${metricCards.length + 1}개` },
    { icon: ClipboardCheck, label: '적용 진단 기준', value: `${metricCards.filter((m) => m.score !== null).length}개` },
  ]

  const visibleSources = showAllSources ? result.sources : result.sources.slice(0, 6)

  return (
    <div className="border border-[#E3EAF4] bg-[#FBFCFE] p-5 shadow-[0_18px_50px_rgba(8,26,52,0.06)] md:p-7">
      {/* 헤더 바 */}
      <div className="flex items-center justify-between gap-4 pb-5">
        <div className="flex items-center gap-2.5">
          <Shield className="h-6 w-6 text-[#0B66FF]" strokeWidth={2} fill="#0B66FF" fillOpacity={0.12} />
          <h2 className="text-xl font-black tracking-[-0.02em] text-[#0E1F38] md:text-2xl">종합 위험 진단 결과</h2>
        </div>
        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#6B7A90]">
          <Calendar className="h-4 w-4" /> 기준일 {baseDate}
        </span>
      </div>

      <div className="space-y-4">
        {/* Hero: 종합 단계 + 지표 카드 */}
        <section className="grid gap-4 lg:grid-cols-[1.05fr_1.35fr]">
          <div className="relative flex items-center gap-6 overflow-hidden rounded-2xl border border-[#FCE3CF] bg-[linear-gradient(135deg,#FFF6EE,#FFFBF7)] p-7">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-[#FFE7D3]">
              <AlertTriangle className="h-12 w-12" style={{ color: tone }} strokeWidth={2} />
            </div>
            <div>
              <p className="text-base font-black text-[#3A4A63]">종합 위험</p>
              <p className="mt-1 text-[40px] font-black leading-none tracking-[-0.03em]" style={{ color: tone }}>
                {riskLevelText(result)} 단계
              </p>
              <p className="mt-3 max-w-[34ch] text-sm font-semibold leading-6 text-[#5A6B83]">
                {summarySentence(result, topRows)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {metricCards.map((m) => {
              const lvl = scoreLevel(m.score)
              const tag = metricStateTag(m.state)
              const Icon = m.icon
              return (
                <div key={m.key} className="rounded-2xl border border-[#E3EAF4] bg-white p-5 shadow-[0_8px_22px_rgba(8,26,52,0.04)]">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md" style={{ backgroundColor: `${m.color}1A` }}>
                      <Icon className="h-4 w-4" style={{ color: m.color }} strokeWidth={2} />
                    </span>
                    <span className="text-sm font-black text-[#0E1F38]">{m.label}</span>
                  </div>
                  <p className="mt-3 text-[32px] font-black leading-none tabular-nums" style={{ color: lvl.color }}>
                    {metricScoreText(m.state)}
                    {tag && <span className="ml-2 align-middle text-xs font-bold text-[#9AA8BA]">{tag}</span>}
                  </p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#EDF2F8]">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, m.score ?? 0)}%`, background: lvl.color }} />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[10px] font-bold text-[#AEB9C8]">
                    <span>0</span>
                    <span>100</span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* 핵심 위험 요인 + 현장 체크리스트 */}
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#E3EAF4] bg-white p-6 shadow-[0_8px_22px_rgba(8,26,52,0.04)]">
            <span className="inline-flex items-center gap-2 text-base font-black text-[#0E1F38]">
              <BarChart3 className="h-5 w-5 text-[#F06A1A]" strokeWidth={2} /> 핵심 위험 요인
            </span>
            <div className="mt-5 space-y-3">
              {topRows.map((row, index) => {
                const sev = severityChip(row.score)
                const act = actionChip(row.score)
                const Icon = metricConfig.find((m) => m.key === row.key)?.icon ?? Store
                return (
                  <div key={row.key} className="flex gap-3 rounded-xl border border-[#EDF2F8] p-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FF6B1D] text-xs font-black text-white">
                      {index + 1}
                    </span>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#F4F7FB]">
                      <Icon className="h-4 w-4 text-[#53657E]" strokeWidth={2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-[#0E1F38]">{row.label}</span>
                        <span className={`px-2 py-0.5 text-[11px] font-black ${act.cls}`}>{act.text}</span>
                      </div>
                      <p className="mt-1 text-xs font-semibold leading-5 text-[#6B7A90]">{row.body}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-black tabular-nums" style={{ color: severityChip(row.score).text === '높음' ? '#EF6A12' : '#0E1F38' }}>{row.score}<span className="text-xs">점</span></p>
                      <span className={`mt-1 inline-block px-2 py-0.5 text-[11px] font-black ${sev.cls}`}>{sev.text}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-[#E3EAF4] bg-white p-6 shadow-[0_8px_22px_rgba(8,26,52,0.04)]">
            <span className="inline-flex items-center gap-2 text-base font-black text-[#0E1F38]">
              <ClipboardCheck className="h-5 w-5 text-[#0B66FF]" strokeWidth={2} /> 계약 전 현장 체크리스트
            </span>
            <div className="mt-5 space-y-2.5">
              {fieldQuestions.map((question, index) => (
                <div key={question} className="flex items-start gap-3 rounded-xl border border-[#EDF2F8] p-3.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#EAF2FF] text-xs font-black text-[#0B66FF]">
                    {index + 1}
                  </span>
                  <p className="text-sm font-semibold leading-6 text-[#33445E]">{question}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 관련 분석 + 진단 지표 통계 */}
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#E3EAF4] bg-white p-6 shadow-[0_8px_22px_rgba(8,26,52,0.04)]">
            <span className="inline-flex items-center gap-2 text-base font-black text-[#0E1F38]">
              <Share2 className="h-5 w-5 text-[#0B66FF]" strokeWidth={2} /> 관련 분석
            </span>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {related.map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.title}>
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#EFF5FC]">
                        <Icon className="h-4 w-4 text-[#0B66FF]" strokeWidth={2} />
                      </span>
                      <span className="text-sm font-black text-[#0E1F38]">{item.title}</span>
                    </div>
                    <span className={`mt-2 inline-block px-2 py-0.5 text-[11px] font-black ${item.chip.cls}`}>{item.chip.text}</span>
                    <p className="mt-2 text-xs font-semibold leading-5 text-[#6B7A90]">{item.body}</p>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-[#E3EAF4] bg-white p-6 shadow-[0_8px_22px_rgba(8,26,52,0.04)]">
            <span className="inline-flex items-center gap-2 text-base font-black text-[#0E1F38]">
              <ShieldCheck className="h-5 w-5 text-[#0B66FF]" strokeWidth={2} /> 진단 지표 요약
            </span>
            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {stats.map((s) => {
                const Icon = s.icon
                return (
                  <div key={s.label} className="text-center">
                    <Icon className="mx-auto h-7 w-7 text-[#0B66FF]" strokeWidth={1.8} />
                    <p className="mt-2 text-xs font-bold text-[#6B7A90]">{s.label}</p>
                    <p className="mt-1 text-lg font-black text-[#0E1F38]">{s.value}</p>
                  </div>
                )
              })}
            </div>
            {(result.risk.confidenceReasons ?? []).length > 0 && (
              <ul className="mt-5 space-y-1.5 border-t border-[#EDF2F8] pt-4">
                {(result.risk.confidenceReasons ?? []).map((reason) => (
                  <li key={reason} className="flex gap-2 text-xs font-semibold leading-5 text-[#6B7A90]">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#AEB9C8]" />{reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* 데이터 · 기준 · 참고자료 */}
        <section className="rounded-2xl border border-[#E3EAF4] bg-white p-6 shadow-[0_8px_22px_rgba(8,26,52,0.04)]">
          <div className="grid gap-6 md:grid-cols-[230px_minmax(0,1fr)]">
            <div>
              <span className="inline-flex items-center gap-2 text-base font-black text-[#0E1F38]">
                <Database className="h-5 w-5 text-[#0B66FF]" strokeWidth={2} /> 데이터 · 기준 · 참고자료
              </span>
              <p className="mt-3 text-sm font-semibold leading-6 text-[#6B7A90]">
                본 진단은 아래 공공데이터를 기준으로 분석되었습니다.{' '}
                <Link href="/incheon/data" className="font-black text-[#0B66FF] hover:underline">전체 데이터 보기 →</Link>
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between border-b border-[#E3EAF4] pb-2 text-xs font-black text-[#8A98AC]">
                <span>참고자료 목록</span>
                <span>출처 유형</span>
              </div>
              <div className="divide-y divide-[#EDF2F8]">
                {visibleSources.map((source) => (
                  <a key={source.sourceId} href={source.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-[#FBFDFF]">
                    <span className="flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-[#9AA8BA]" strokeWidth={1.8} />
                      <span className="truncate text-sm font-semibold text-[#33445E]">{source.name}</span>
                    </span>
                    <span className="shrink-0 text-xs font-bold text-[#8A98AC]">{source.scoringUse ? '공공 데이터 · 점수 반영' : '공공 데이터 · 참고'}</span>
                  </a>
                ))}
              </div>
              {result.sources.length > 6 && (
                <button
                  type="button"
                  onClick={() => setShowAllSources((prev) => !prev)}
                  className="mt-3 flex w-full items-center justify-center gap-1 text-sm font-bold text-[#0B66FF]"
                >
                  {showAllSources ? '접기' : '더 보기'}
                  <ChevronDown className={`h-4 w-4 transition-transform ${showAllSources ? 'rotate-180' : ''}`} strokeWidth={2.4} />
                </button>
              )}
            </div>
          </div>
        </section>

        <p className="pt-1 text-center text-xs font-semibold text-[#9AA8BA]">
          상기 분석과 진단은 {baseDate} 기준 공공데이터로 수행되었습니다. 본 결과는 참고 자료이며 창업·투자 결정의 최종 근거로 사용할 수 없습니다.
        </p>
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
            {result.risk.insufficientData ? (
              <>
                <ConfidenceNotice result={result} />
                <DataSourcePanel sources={result.sources} />
              </>
            ) : (
              <ResultDashboard result={result} rows={interpretationRows} />
            )}
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
