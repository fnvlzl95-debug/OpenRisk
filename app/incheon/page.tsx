import {
  BarChart3,
  CalendarClock,
  Database,
  Gauge,
  LocateFixed,
  Map,
  MapPin,
  PieChart,
  Route,
  ShieldCheck,
  Store,
  Target,
} from 'lucide-react'
import IncheonHeader from '@/components/incheon/IncheonHeader'
import IncheonFooter from '@/components/incheon/IncheonFooter'
import SearchPanel from '@/components/incheon/SearchPanel'
import RiskMapVisual from '@/components/incheon/RiskMapVisual'

const indicatorRows = [
  ['경쟁', 68, 'bg-[#FDBA3B]'],
  ['유입', 72, 'bg-[#2D8CFF]'],
  ['임대료', 55, 'bg-[#20C7E8]'],
  ['생존', 61, 'bg-[#50D19C]'],
  ['앵커', 74, 'bg-[#8B5CF6]'],
]

const featureCards = [
  {
    icon: Target,
    title: '500m 정밀 분석',
    body: '주변 상권을 세밀하게 분석합니다',
  },
  {
    icon: BarChart3,
    title: '5대 핵심 지표',
    body: '경쟁·유입·임대료·생존·앵커 분석',
  },
  {
    icon: ShieldCheck,
    title: '공공데이터 기반',
    body: '확인 가능한 데이터로 분석합니다',
  },
]

const steps = [
  {
    icon: MapPin,
    title: '위치 입력',
    body: '분석할 지역을 검색하세요',
  },
  {
    icon: Store,
    title: '업종 선택',
    body: '분석할 업종을 선택하세요',
  },
  {
    icon: PieChart,
    title: '결과 확인',
    body: '위험도를 한눈에 확인하세요',
  },
]

const trustItems = [
  {
    icon: Gauge,
    title: '직관적 점수',
    body: '0~100 점수로 쉽게 이해',
  },
  {
    icon: Map,
    title: '지도 기반 분석',
    body: '위치를 중심으로 한 분석',
  },
  {
    icon: CalendarClock,
    title: '최신 데이터 반영',
    body: '업데이트된 기준으로 분석',
  },
  {
    icon: Database,
    title: '한눈에 읽히는 결과',
    body: '복잡한 데이터를 쉽게 정리',
  },
]

function HeroRiskPanel() {
  return (
    <aside className="relative hidden w-[350px] border border-[#3845A0] bg-[#06112A]/90 p-8 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] lg:block">
      <h2 className="text-center text-2xl font-black">예상 위험도</h2>
      <div className="mt-4 flex items-center justify-center gap-4">
        <span className="bg-[linear-gradient(180deg,#FFB14A,#FF651F)] bg-clip-text text-7xl font-black leading-none text-transparent">67</span>
        <span className="border border-[#FF8A1F] bg-[#2B1B09] px-4 py-2 text-xl font-black text-[#FFB14A]">
          주의
        </span>
      </div>

      <div className="mt-7">
        <div className="relative h-2 bg-[linear-gradient(90deg,#47D78D_0%,#47D78D_24%,#2D8CFF_24%,#2D8CFF_50%,#FDBA3B_50%,#FDBA3B_74%,#FF4B4B_74%,#FF4B4B_100%)]">
          <span className="absolute left-[66%] top-1/2 h-6 w-6 -translate-y-1/2 border-4 border-white bg-[#FF8A1F]" />
        </div>
        <div className="mt-4 grid grid-cols-4 text-center text-sm font-black text-white/80">
          <span>안전</span>
          <span>보통</span>
          <span className="text-[#FFB14A]">주의</span>
          <span>위험</span>
        </div>
      </div>

      <div className="mt-8 border-t border-white/12 pt-7">
        <h3 className="text-lg font-black">5대 핵심 지표</h3>
        <div className="mt-5 space-y-5">
          {indicatorRows.map(([label, value, color]) => (
            <div key={label as string} className="grid grid-cols-[62px_1fr_34px] items-center gap-3">
              <span className="text-base font-black text-white/86">{label as string}</span>
              <span className="h-3 overflow-hidden bg-white/10">
                <span className={`block h-full ${color as string}`} style={{ width: `${value}%` }} />
              </span>
              <span className="text-right text-base font-black">{value as number}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}

export default function IncheonHomePage() {
  return (
    <main className="min-h-screen bg-white text-[#081A34]">
      <IncheonHeader />

      <section className="relative overflow-hidden bg-[#031B37] text-white">
        <RiskMapVisual variant="hero" showLegend={false} showRadiusLabel={false} />
        <div className="relative mx-auto max-w-7xl px-5 pb-12 pt-20 lg:px-8 lg:pb-14 lg:pt-24">
          <div className="grid gap-10 lg:grid-cols-[1fr_370px]">
            <div className="max-w-3xl">
              <h1 className="text-[44px] font-black leading-[1.12] tracking-[-0.03em] md:text-[66px]">
                입지 판단을
                <br />
                데이터로 <span className="text-[#1F7AFF]">더 선명하게</span>
              </h1>
              <p className="mt-7 text-xl font-semibold leading-9 text-white/86">
                위치와 업종만 입력하면
                <br />
                상권 위험도를 빠르게 분석합니다.
              </p>

              <div className="mt-9 max-w-[690px]">
                <SearchPanel />
              </div>
            </div>

            <HeroRiskPanel />
          </div>

          <div id="service" className="mt-12 grid gap-4 lg:grid-cols-3">
            {featureCards.map((item) => {
              const Icon = item.icon
              return (
                <article
                  key={item.title}
                  className="flex items-center gap-6 border border-[#1B5B9C] bg-[#072A54]/78 p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                >
                  <Icon className="h-16 w-16 shrink-0 text-[#20D6F4]" strokeWidth={1.7} />
                  <div>
                    <h2 className="text-2xl font-black">{item.title}</h2>
                    <p className="mt-2 text-sm font-semibold text-white/72">{item.body}</p>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section id="method" className="bg-white px-5 py-12 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-4xl font-black tracking-[-0.03em]">
            <span className="text-[#0B66FF]">3단계</span>로 바로 확인
          </h2>
          <div className="mt-9 grid items-center gap-7 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
            {steps.map((step, index) => {
              const Icon = step.icon
              return (
                <div key={step.title} className="contents">
                  <article className="relative bg-white p-9 text-center shadow-[0_18px_42px_rgba(8,26,52,0.12)] ring-1 ring-[#E1E8F2]">
                    <span className="absolute left-6 top-6 flex h-9 w-9 items-center justify-center bg-[#0B4AB8] text-lg font-black text-white">
                      {index + 1}
                    </span>
                    <Icon className="mx-auto h-20 w-20 text-[#0B66FF]" strokeWidth={1.8} />
                    <h3 className="mt-7 text-2xl font-black">{step.title}</h3>
                    <p className="mt-3 text-base font-semibold text-[#5A6B83]">{step.body}</p>
                  </article>
                  {index < steps.length - 1 && <Route className="hidden h-10 w-10 text-[#0B66FF] md:block" strokeWidth={2.5} />}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section id="data" className="border-t border-[#E6EDF6] bg-white px-5 py-12 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center text-4xl font-black tracking-[-0.03em]">왜 신뢰할 수 있을까요?</h2>
          <div className="mt-9 grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
            {trustItems.map((item) => {
              const Icon = item.icon
              return (
                <article key={item.title} className="bg-white p-8 text-center shadow-[0_12px_34px_rgba(8,26,52,0.08)] ring-1 ring-[#E1E8F2]">
                  <Icon className="mx-auto h-16 w-16 text-[#0B66FF]" strokeWidth={1.7} />
                  <h3 className="mt-6 text-xl font-black">{item.title}</h3>
                  <p className="mt-3 text-sm font-semibold text-[#6B7A90]">{item.body}</p>
                </article>
              )
            })}
          </div>

          <div className="mt-10 overflow-hidden bg-[#052552] p-8 text-white shadow-[0_18px_50px_rgba(5,37,82,0.22)]">
            <div className="grid items-center gap-8 md:grid-cols-[1fr_auto_260px]">
              <div>
                <h2 className="text-3xl font-black tracking-[-0.02em]">지금 우리 동네를 분석해보세요</h2>
                <p className="mt-4 text-lg font-semibold text-white/78">상권의 기회와 위험을 더 빠르게 파악하세요</p>
              </div>
              <a
                href="/incheon/result?lat=37.3897&lng=126.6454&category=cafe&query=%EC%9D%B8%EC%B2%9C%20%EC%97%B0%EC%88%98%EA%B5%AC%20%EC%86%A1%EB%8F%84%EB%8F%99"
                className="inline-flex h-16 items-center justify-center bg-[linear-gradient(180deg,#FF9E2C,#FF5B1D)] px-12 text-xl font-black text-white shadow-[0_16px_36px_rgba(255,103,28,0.22)] transition-transform active:scale-[0.98]"
              >
                무료로 시작하기
              </a>
              <div className="relative hidden h-32 md:block">
                <div className="absolute right-4 top-0 h-28 w-28 rounded-full border-2 border-[#20D6F4]/70" />
                <div className="absolute right-10 top-7 flex h-16 w-16 items-center justify-center rounded-full bg-[#0B66FF]">
                  <LocateFixed className="h-10 w-10 text-white" />
                </div>
                <div className="absolute bottom-0 right-0 h-16 w-56 bg-[radial-gradient(circle,rgba(32,214,244,0.42),transparent_70%)]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <IncheonFooter />
    </main>
  )
}
