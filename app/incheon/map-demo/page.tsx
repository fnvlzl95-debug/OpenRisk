import IncheonHeader from '@/components/incheon/IncheonHeader'
import IncheonFooter from '@/components/incheon/IncheonFooter'
import RiskAnalysisMapCard from '@/components/incheon/RiskAnalysisMapCard'
import { GANGNAM_TEHERAN_CENTER, gangnamTeheranMockRiskCells } from '@/lib/incheon/mock-risk-map'

export default function IncheonMapDemoPage() {
  return (
    <main className="min-h-screen bg-[#031B37] text-white">
      <IncheonHeader />
      <section className="px-5 py-8 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[#20C7E8]">Interactive Map Component</p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.03em] md:text-5xl">RiskAnalysisMapCard</h1>
            <p className="mt-4 max-w-3xl text-base font-semibold leading-7 text-white/72">
              OpenStreetMap 기반 다크 타일과 H3 셀을 사용한 상권 위험도 지도 카드 예시입니다. 실제 결과 페이지에서는
              분석 좌표와 서버에서 계산한 riskCells를 props로 전달하면 됩니다.
            </p>
          </div>

          <RiskAnalysisMapCard
            center={GANGNAM_TEHERAN_CENTER}
            radius={500}
            riskCells={gangnamTeheranMockRiskCells}
          />
        </div>
      </section>
      <IncheonFooter />
    </main>
  )
}
