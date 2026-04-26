'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Activity,
  ArrowRight,
  Building2,
  Bus,
  Coffee,
  GraduationCap,
  Hospital,
  Landmark,
  MapPin,
  Route,
  ShieldCheck,
  Store,
  Target,
  Train,
  Users,
  WalletCards,
} from 'lucide-react'
import IncheonHeader from '@/components/incheon/IncheonHeader'
import IncheonFooter from '@/components/incheon/IncheonFooter'
import SearchPanel from '@/components/incheon/SearchPanel'
import DataSourcePanel from '@/components/incheon/DataSourcePanel'
import RiskAnalysisMapCard from '@/components/incheon/RiskAnalysisMapCard'
import type { IncheonAnalyzeResponse } from '@/lib/incheon/types'
import { INCHEON_DEFAULT_CATEGORY } from '@/lib/incheon/constants'
import { createMockRiskCells } from '@/lib/incheon/mock-risk-map'

const metricConfig = [
  { key: 'competition', label: '경쟁', body: '같은 업종 경쟁 정도', icon: Users, color: '#FF8A1F' },
  { key: 'transit', label: '교통', body: '교통 접근 유입 신호', icon: Route, color: '#2D8CFF' },
  { key: 'cost', label: '임대료', body: '해당 권역 비용 부담', icon: Building2, color: '#20C7E8' },
  { key: 'survival', label: '생존', body: '업종 생존 가능성', icon: ShieldCheck, color: '#47C978' },
  { key: 'anchor', label: '앵커', body: '주변 앵커 시설 영향', icon: Store, color: '#8B5CF6' },
] as const

const interpretationCards = [
  {
    title: '경쟁이 조금 높아요',
    body: '반경 내 같은 업종이 다소 밀집해 있어 경쟁 강도가 높은 편입니다.',
    icon: Users,
    color: '#FF6B1D',
    tone: 'border-[#FFD4BF] bg-[#FFF8F4]',
  },
  {
    title: '교통 신호는 안정적이에요',
    body: '정류장과 역 접근성을 보면 고정 수요가 기대되는 구조입니다.',
    icon: Route,
    color: '#0B66FF',
    tone: 'border-[#CDE0FF] bg-[#F7FAFF]',
  },
  {
    title: '임대료는 보통이에요',
    body: '공식 통계상 비용 부담은 평균 수준으로 과도한 편은 아닙니다.',
    icon: Building2,
    color: '#16B8C8',
    tone: 'border-[#C9F0F5] bg-[#F6FEFF]',
  },
  {
    title: '앵커 영향은 보통이에요',
    body: '주변 시설이 유입에 도움이 되지만 영향은 평균 수준입니다.',
    icon: Store,
    color: '#7957F2',
    tone: 'border-[#DDD3FF] bg-[#FAF8FF]',
  },
]

const actionCards = [
  {
    title: '같은 업종 밀집도 확인',
    body: '반경을 넓혀 경쟁 업종 분포를 추가로 확인해보세요.',
    icon: Users,
  },
  {
    title: '주말 유입 추가 확인',
    body: '주말·저녁 시간대 유입을 확인해 실수요를 점검해보세요.',
    icon: Activity,
  },
  {
    title: '임대료 비교 후 결정',
    body: '인근 유사 상권과 임대료를 비교해 최종 판단을 내리세요.',
    icon: Building2,
  },
]

function riskLevelText(result: IncheonAnalyzeResponse | null) {
  if (!result) return ''
  if (result.risk.level === 'VERY_HIGH') return '위험'
  if (result.risk.level === 'HIGH') return '주의'
  if (result.risk.level === 'MEDIUM') return '주의'
  return '보통'
}

function scoreLevel(score: number | null) {
  if (score === null) return { text: '확인 필요', color: '#6B7A90', bars: 2, caption: '데이터 확보 전' }
  if (score >= 67) return { text: '높음', color: '#FF6B1D', bars: 8, caption: '상위 25% 수준' }
  if (score >= 45) return { text: '보통', color: '#0B66FF', bars: 6, caption: '상위 50% 수준' }
  return { text: '양호', color: '#25B866', bars: 5, caption: '상위 60% 수준' }
}

function RiskPanel({ result }: { result: IncheonAnalyzeResponse }) {
  const rows = metricConfig.map((item) => {
    const score = result.risk.scoreBreakdown[item.key]
    return { ...item, score }
  })

  return (
    <section className="border border-[#3845A0] bg-[#06112A]/92 p-8 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
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
        보통보다 조금 높은 편입니다.
      </p>

      <div className="mt-7 space-y-5">
        {rows.map((row) => {
          const score = row.score ?? 0
          const Icon = row.icon
          return (
            <div key={row.key} className="grid grid-cols-[42px_70px_1fr_40px] items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center bg-white/8">
                <Icon className="h-5 w-5" style={{ color: row.color }} />
              </span>
              <span className="text-lg font-black">{row.label}</span>
              <span className="h-4 overflow-hidden bg-white/10">
                <span className="block h-full" style={{ width: `${score}%`, backgroundColor: row.color }} />
              </span>
              <span className="text-right text-lg font-black">{row.score ?? '-'}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function MetricCard({
  label,
  body,
  score,
  icon: Icon,
  color,
}: {
  label: string
  body: string
  score: number | null
  icon: typeof Users
  color: string
}) {
  const level = scoreLevel(score)
  return (
    <article className="bg-white p-6 shadow-[0_12px_34px_rgba(8,26,52,0.14)] ring-1 ring-[#DDE7F4]">
      <Icon className="h-8 w-8" style={{ color }} strokeWidth={1.8} />
      <h3 className="mt-4 text-2xl font-black text-[#081A34]">{label}</h3>
      <p className="mt-2 text-base font-semibold text-[#4E607A]">{body}</p>
      <p className="mt-6 text-xl font-black" style={{ color: level.color }}>
        {level.text}
      </p>
      <div className="mt-4 flex gap-2">
        {Array.from({ length: 10 }).map((_, index) => (
          <span
            key={index}
            className="h-6 flex-1"
            style={{ backgroundColor: index < level.bars ? color : '#E4EAF2' }}
          />
        ))}
      </div>
      <p className="mt-4 text-sm font-semibold text-[#5C6E87]">{level.caption}</p>
    </article>
  )
}

function ResultContent() {
  const searchParams = useSearchParams()
  const lat = Number(searchParams.get('lat') || '37.3897')
  const lng = Number(searchParams.get('lng') || '126.6454')
  const category = searchParams.get('category') || INCHEON_DEFAULT_CATEGORY

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
          body: JSON.stringify({ lat, lng, targetCategory: category, demoMode: true }),
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

  const summaryCards = useMemo(() => {
    if (!result) return []
    return [
      ['위험도', result.risk.score, riskLevelText(result), ShieldCheck],
      ['반경', '500m', '', Target],
      ['업종', result.category.name, '', Coffee],
      ['분석 기준', '최신 데이터', '', Activity],
    ] as const
  }, [result])
  const mapCenter = useMemo(() => ({ lat, lng }), [lat, lng])
  const mapRiskCells = useMemo(() => createMockRiskCells({ lat, lng }), [lat, lng])

  return (
    <main className="min-h-screen bg-white text-[#081A34]">
      <IncheonHeader />

      <section className="bg-[#031B37] px-5 py-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SearchPanel compact />

          {loading && (
            <div className="mt-7 grid gap-6 lg:grid-cols-[1.1fr_0.86fr]">
              <div className="min-h-[420px] animate-pulse border border-[#155396] bg-[#072A54]" />
              <div className="min-h-[420px] animate-pulse border border-[#155396] bg-[#06112A]" />
            </div>
          )}

          {error && (
            <div className="mt-7 border border-[#FFB999] bg-white p-8">
              <h1 className="text-2xl font-black">분석을 완료하지 못했습니다</h1>
              <p className="mt-3 text-base font-semibold text-[#53657E]">{error}</p>
            </div>
          )}

          {result && !loading && (
            <>
              <div className="mt-7 grid gap-7 lg:grid-cols-[1.12fr_0.88fr]">
                <RiskAnalysisMapCard center={mapCenter} radius={500} riskCells={mapRiskCells} />
                <RiskPanel result={result} />
              </div>

              <div className="mt-7 grid gap-3 lg:grid-cols-5">
                {metricConfig.map((item) => (
                  <MetricCard
                    key={item.key}
                    label={item.label}
                    body={item.body}
                    score={result.risk.scoreBreakdown[item.key]}
                    icon={item.icon}
                    color={item.color}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {result && !loading && (
        <section className="bg-white px-5 py-8 lg:px-8">
          <div className="mx-auto max-w-7xl space-y-8">
            <section>
              <h2 className="text-3xl font-black tracking-[-0.02em]">핵심 해석</h2>
              <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                {interpretationCards.map((card) => {
                  const Icon = card.icon
                  return (
                    <article key={card.title} className={`border p-6 ${card.tone}`}>
                      <Icon className="h-8 w-8" style={{ color: card.color }} strokeWidth={1.8} />
                      <h3 className="mt-4 text-xl font-black" style={{ color: card.color }}>
                        {card.title}
                      </h3>
                      <p className="mt-4 text-base font-semibold leading-7 text-[#243653]">{card.body}</p>
                    </article>
                  )
                })}
              </div>
            </section>

            <section>
              <h2 className="text-3xl font-black tracking-[-0.02em]">다음 확인 액션</h2>
              <div className="mt-6 grid gap-5 lg:grid-cols-3">
                {actionCards.map((card) => {
                  const Icon = card.icon
                  return (
                    <article key={card.title} className="flex items-center justify-between gap-5 bg-white p-6 shadow-[0_12px_34px_rgba(8,26,52,0.1)] ring-1 ring-[#DDE7F4]">
                      <div className="flex items-center gap-5">
                        <Icon className="h-12 w-12 shrink-0 text-[#0B66FF]" strokeWidth={1.7} />
                        <div>
                          <h3 className="text-lg font-black">{card.title}</h3>
                          <p className="mt-2 text-sm font-semibold leading-6 text-[#53657E]">{card.body}</p>
                        </div>
                      </div>
                      <ArrowRight className="h-7 w-7 shrink-0 text-[#0B66FF]" />
                    </article>
                  )
                })}
              </div>
            </section>

            <section>
              <h2 className="text-3xl font-black tracking-[-0.02em]">현재 위치 요약</h2>
              <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                {summaryCards.map(([title, value, badge, Icon]) => (
                  <article key={title} className="flex items-center gap-5 bg-white p-6 shadow-[0_12px_34px_rgba(8,26,52,0.08)] ring-1 ring-[#DDE7F4]">
                    <Icon className="h-11 w-11 shrink-0 text-[#0B66FF]" strokeWidth={1.7} />
                    <div>
                      <p className="text-sm font-black text-[#6B7A90]">{title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-3">
                        <span className="text-3xl font-black text-[#0B2450]">{value}</span>
                        {badge && <span className="bg-[#FF6B1D] px-3 py-1 text-sm font-black text-white">{badge}</span>}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="overflow-hidden bg-[#052552] p-8 text-white shadow-[0_18px_50px_rgba(5,37,82,0.22)]">
              <div className="grid items-center gap-8 md:grid-cols-[1fr_auto_240px]">
                <div>
                  <h2 className="text-3xl font-black tracking-[-0.02em]">다른 위치도 비교해보세요</h2>
                  <p className="mt-4 text-lg font-semibold text-white/78">여러 위치를 비교하면 더 좋은 판단을 내릴 수 있습니다.</p>
                </div>
                <a
                  href="/incheon"
                  className="inline-flex h-16 items-center justify-center bg-[linear-gradient(180deg,#FF9E2C,#FF5B1D)] px-12 text-xl font-black text-white shadow-[0_16px_36px_rgba(255,103,28,0.22)] transition-transform active:scale-[0.98]"
                >
                  새 위치 분석
                </a>
                <div className="relative hidden h-28 md:block">
                  <div className="absolute right-5 top-0 h-24 w-24 rounded-full border-2 border-[#20D6F4]/70" />
                  <div className="absolute right-9 top-6 flex h-14 w-14 items-center justify-center rounded-full bg-[#0B66FF]">
                    <MapPin className="h-9 w-9 text-white" />
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="mb-5 text-3xl font-black tracking-[-0.02em]">교통·앵커 시설</h2>
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                {[
                  [GraduationCap, '학교', '초·중·고 접근'],
                  [Hospital, '병원', '의료 시설 접근'],
                  [Bus, '버스정류장', '승하차 데이터'],
                  [Train, '지하철역', '역별 수송인원'],
                  [Landmark, '상점가', '공공 앵커 후보'],
                  [WalletCards, '비용', '임대·공실 참고'],
                ].map(([Icon, title, body]) => {
                  const TypedIcon = Icon as typeof GraduationCap
                  return (
                    <article key={title as string} className="bg-white p-5 shadow-[0_10px_30px_rgba(8,26,52,0.08)] ring-1 ring-[#DDE7F4]">
                      <TypedIcon className="h-9 w-9 text-[#0B66FF]" strokeWidth={1.7} />
                      <h3 className="mt-4 text-lg font-black">{title as string}</h3>
                      <p className="mt-2 text-sm font-semibold text-[#53657E]">{body as string}</p>
                    </article>
                  )
                })}
              </div>
            </section>

            <section>
              <h2 className="mb-5 text-3xl font-black tracking-[-0.02em]">현장 확인 질문</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {result.cards.fieldChecks.map((question, index) => (
                  <article key={question} className="bg-white p-5 shadow-[0_10px_30px_rgba(8,26,52,0.08)] ring-1 ring-[#DDE7F4]">
                    <span className="flex h-9 w-9 items-center justify-center bg-[#0B66FF] text-lg font-black text-white">
                      {index + 1}
                    </span>
                    <p className="mt-4 text-base font-black leading-7 text-[#10203D]">{question}</p>
                  </article>
                ))}
              </div>
            </section>

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
