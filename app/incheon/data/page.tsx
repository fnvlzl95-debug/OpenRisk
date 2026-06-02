import fs from 'fs'
import path from 'path'
import Link from 'next/link'
import { Database, ShieldCheck, ExternalLink, CalendarClock, CheckCircle2, AlertTriangle } from 'lucide-react'
import IncheonHeader from '@/components/incheon/IncheonHeader'
import IncheonFooter from '@/components/incheon/IncheonFooter'
import { getIncheonPublicDataSources } from '@/lib/incheon/source-policy'

export const metadata = {
  title: '데이터 출처·품질 | 오픈리스크 인천',
  description: '오픈리스크 인천이 사용하는 공공데이터 출처, 기준일, 데이터 품질을 투명하게 공개합니다.',
}

type DataHealth = {
  generatedAt?: string
  datasets?: Record<string, { cells?: number; totalStores?: number; busStopCount?: number; busRidershipTotal?: number; subwayRidershipTotal?: number; schoolCount?: number; studentCountTotal?: number; childcareCount?: number; regions?: number; centerCellCount?: number; dataPeriod?: string | null; status?: string; issues?: string[] }>
  flags?: { subwayDegraded?: boolean; studentDegraded?: boolean }
}

function loadHealth(): DataHealth | null {
  try {
    const file = path.join(process.cwd(), 'data', 'openrisk-incheon', 'processed', 'data-health', 'data-health.json')
    if (!fs.existsSync(file)) return null
    return JSON.parse(fs.readFileSync(file, 'utf8')) as DataHealth
  } catch {
    return null
  }
}

function num(value: number | undefined): string {
  return (value ?? 0).toLocaleString('ko-KR')
}

const statusLabel: Record<string, { text: string; tone: string }> = {
  ready: { text: '확보', tone: 'bg-[#ECFDF3] text-[#1C9B5F]' },
  'local-candidate': { text: '확보', tone: 'bg-[#ECFDF3] text-[#1C9B5F]' },
  planned: { text: '예정', tone: 'bg-[#F2F5F9] text-[#6B7A90]' },
  blocked: { text: '보류', tone: 'bg-[#FFF1E8] text-[#F06A1A]' },
  manual: { text: '수동', tone: 'bg-[#EEF5FF] text-[#0B66FF]' },
}

export default function IncheonDataPage() {
  const health = loadHealth()
  const sources = getIncheonPublicDataSources()
  const ds = health?.datasets ?? {}
  const baseDateText = health?.generatedAt ? new Date(health.generatedAt).toLocaleDateString('ko-KR') : '—'

  const stat = [
    { label: '점포', cells: ds.stores?.cells, lines: [`총 점포 ${num(ds.stores?.totalStores)}곳`, `기준 ${ds.stores?.dataPeriod ?? '—'}`] },
    { label: '교통', cells: ds.transit?.cells, lines: [`버스정류장 ${num(ds.transit?.busStopCount)}곳`, `지하철 월평균 ${num(ds.transit?.subwayRidershipTotal)}명`] },
    { label: '교육·가족', cells: ds.education?.cells, lines: [`학교 ${num(ds.education?.schoolCount)}곳 · 학생 ${num(ds.education?.studentCountTotal)}명`, `어린이집 ${num(ds.education?.childcareCount)}곳`] },
    { label: '비용', cells: ds.cost?.regions, lines: [`권역 ${num(ds.cost?.regions)}개`, `기준 ${ds.cost?.dataPeriod ?? '2025Q4'}`], unit: '권역' },
  ]

  const freshness = [
    { name: '점포 (소상공인 상가정보)', period: ds.stores?.dataPeriod },
    { name: '교통 (버스·지하철)', period: ds.transit?.dataPeriod },
    { name: '교육·가족 (학교·어린이집)', period: ds.education?.dataPeriod },
    { name: '반경 통계', period: ds.radiusStats ? '원천 데이터 기반 산출' : null },
  ]

  const degraded: string[] = []
  if (health?.flags?.subwayDegraded) degraded.push('지하철 승하차 데이터가 현재 점수에 반영되지 않습니다.')
  if (health?.flags?.studentDegraded) degraded.push('학생수 데이터가 현재 점수에 반영되지 않습니다.')

  const scoringSources = sources.filter((s) => s.scoringUse)
  const referenceSources = sources.filter((s) => !s.scoringUse)

  return (
    <main className="min-h-screen bg-white text-[#081A34]">
      <IncheonHeader />

      <section className="bg-[#031B37] px-5 py-14 text-white lg:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-black text-[#5AA2FF]">데이터 투명성</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.03em] md:text-5xl">데이터 출처 · 품질</h1>
          <p className="mt-5 max-w-2xl text-lg font-semibold leading-8 text-white/80">
            오픈리스크 인천의 위험도 점수는 <b className="text-white">신뢰할 수 있는 공공데이터만</b>으로 계산됩니다.
            어떤 데이터를 어디서, 언제 기준으로 쓰는지 그대로 공개합니다.
          </p>
          <div className="mt-7 inline-flex items-center gap-2 border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-white/80">
            <CalendarClock className="h-4 w-4" /> 데이터 갱신 기준일 {baseDateText}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stat.map((s) => (
            <div key={s.label} className="border border-[#D7E1F0] bg-white p-6 shadow-[0_12px_30px_rgba(8,26,52,0.04)]">
              <p className="text-sm font-black text-[#0B66FF]">{s.label}</p>
              <p className="mt-2 text-3xl font-black tracking-[-0.02em]">
                {num(s.cells)}
                <span className="ml-1 text-sm font-bold text-[#6B7A90]">{s.unit ?? 'H3 셀'}</span>
              </p>
              <div className="mt-3 space-y-1">
                {s.lines.map((line) => (
                  <p key={line} className="text-xs font-semibold text-[#53657E]">{line}</p>
                ))}
              </div>
            </div>
          ))}
        </div>

        {degraded.length > 0 && (
          <div className="mt-6 flex gap-3 border border-[#FFD9BF] bg-[#FFF8F3] p-5">
            <AlertTriangle className="h-5 w-5 shrink-0 text-[#F06A1A]" />
            <div>
              <p className="text-sm font-black text-[#C2570C]">현재 제한적으로 반영되는 데이터</p>
              <ul className="mt-2 space-y-1 text-sm font-semibold text-[#7A5230]">
                {degraded.map((d) => <li key={d}>· {d}</li>)}
              </ul>
            </div>
          </div>
        )}

        <div id="freshness" className="mt-12 scroll-mt-24">
          <h2 className="text-2xl font-black tracking-[-0.02em]">데이터 기준일</h2>
          <div className="mt-4 divide-y divide-[#EDF2F8] border-y border-[#D7E1F0]">
            {freshness.map((f) => (
              <div key={f.name} className="flex items-center justify-between py-3">
                <span className="text-sm font-bold text-[#33445E]">{f.name}</span>
                <span className="text-sm font-black text-[#061B3A]">{f.period ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12">
          <h2 className="text-2xl font-black tracking-[-0.02em]">점수에 반영되는 출처</h2>
          <p className="mt-2 text-sm font-semibold text-[#6B7A90]">위험도 0~100 산정에 직접 사용되는 공공데이터입니다.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {scoringSources.map((s) => <SourceCard key={s.sourceId} source={s} scoring />)}
          </div>
        </div>

        <div className="mt-12">
          <h2 className="text-2xl font-black tracking-[-0.02em]">참고·보조 데이터</h2>
          <p className="mt-2 text-sm font-semibold text-[#6B7A90]">해석을 돕거나 지도 보정에만 사용하며, 점수 산식에는 포함하지 않습니다.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {referenceSources.map((s) => <SourceCard key={s.sourceId} source={s} />)}
          </div>
        </div>

        <div className="mt-12 border border-[#D7E1F0] bg-[#F8FBFF] p-6 text-sm font-semibold leading-7 text-[#53657E]">
          모든 지표는 공공데이터 기반 추정치이며 실제와 차이가 있을 수 있습니다. 비용은 권역(구·역세권) 단위 참고값이고,
          일부 지표는 데이터 공백이 있을 수 있습니다. 본 분석은 참고 자료이며 창업·투자 결정의 최종 근거로 사용할 수 없습니다.
        </div>

        <div className="mt-8 flex justify-center">
          <Link href="/incheon" className="bg-[#0B66FF] px-6 py-3 text-sm font-black text-white transition-transform active:scale-[0.98]">
            분석 시작하기
          </Link>
        </div>
      </section>

      <IncheonFooter />
    </main>
  )
}

function SourceCard({ source, scoring = false }: { source: ReturnType<typeof getIncheonPublicDataSources>[number]; scoring?: boolean }) {
  const status = statusLabel[source.status] ?? statusLabel.planned
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer"
      className="group flex flex-col gap-3 border border-[#D7E1F0] bg-white p-5 transition-colors hover:bg-[#FBFDFF]"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-[#EFF5FC] text-[#0B66FF]">
          {scoring ? <Database className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black leading-snug text-[#061B3A]">{source.name}</p>
          <p className="mt-1 text-xs font-semibold text-[#6B7A90]">{source.provider}</p>
        </div>
        <ExternalLink className="h-4 w-4 shrink-0 text-[#9AA8BA] transition-colors group-hover:text-[#0B66FF]" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`px-2 py-0.5 text-[11px] font-black ${scoring ? 'bg-[#EEF5FF] text-[#0B66FF]' : 'bg-[#F2F5F9] text-[#6B7A90]'}`}>
          {scoring ? '점수 반영' : '참고'}
        </span>
        <span className={`px-2 py-0.5 text-[11px] font-black ${status.tone}`}>
          <CheckCircle2 className="mr-1 inline h-3 w-3" />{status.text}
        </span>
        <span className="text-[11px] font-bold text-[#8A98AC]">갱신 {source.updateCycle}</span>
        <span className="text-[11px] font-bold text-[#8A98AC]">· {source.license}</span>
      </div>
    </a>
  )
}
