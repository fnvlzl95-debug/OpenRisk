import { BarChart3, Check, ShieldCheck } from 'lucide-react'
import RiskMapVisual from './RiskMapVisual'

export default function HeroDashboardMock() {
  return (
    <div className="bg-white p-4 shadow-[0_24px_70px_rgba(2,15,36,0.34)]">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="border border-[#D7E1F0] p-4">
          <p className="text-sm font-bold text-[#53657E]">리스크 점수</p>
          <div className="mt-3 flex items-end gap-1 text-[#061B3A]">
            <span className="text-4xl font-black">62</span>
            <span className="pb-1 text-sm">/100</span>
          </div>
          <p className="mt-2 text-sm font-bold text-[#F26A1B]">보통</p>
          <div className="mt-4 h-16 border-[10px] border-[#E3EAF2] border-t-[#F26A1B] border-r-[#F26A1B]" />
        </div>
        <div className="border border-[#D7E1F0] p-4">
          <p className="text-sm font-bold text-[#53657E]">생활권 DNA</p>
          <p className="mt-4 text-lg font-black text-[#061B3A]">직장인 + 가족형</p>
          <div className="mt-4 space-y-3 text-sm text-[#53657E]">
            <div>
              <span>직장인 비중 46%</span>
              <div className="mt-2 h-2 bg-[#E5EDF6]">
                <div className="h-2 w-[46%] bg-[#0B66FF]" />
              </div>
            </div>
            <div>
              <span>가족형 32%</span>
              <div className="mt-2 h-2 bg-[#E5EDF6]">
                <div className="h-2 w-[32%] bg-[#20C7E8]" />
              </div>
            </div>
          </div>
        </div>
        <div className="border border-[#D7E1F0] p-4">
          <p className="text-sm font-bold text-[#53657E]">데이터 신뢰도</p>
          <div className="mt-3 flex items-start justify-between">
            <div>
              <span className="text-4xl font-black text-[#061B3A]">89</span>
              <span className="text-lg font-bold text-[#061B3A]">%</span>
              <p className="mt-2 text-sm font-bold text-[#00A99D]">높음</p>
            </div>
            <div className="flex h-16 w-16 items-center justify-center bg-[#DDF9F7] text-[#00A99D]">
              <ShieldCheck className="h-10 w-10" />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[1.35fr_1fr]">
        <RiskMapVisual variant="mini" showLegend={false} showRadiusLabel={false} />
        <div className="grid gap-3">
          <div className="border border-[#D7E1F0] p-4">
            <p className="text-sm font-bold text-[#061B3A]">상권 규모 추이</p>
            <svg viewBox="0 0 220 84" className="mt-4 h-20 w-full">
              <polyline
                fill="none"
                points="4,60 38,42 72,50 106,34 140,46 174,28 216,40"
                stroke="#0B66FF"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="border border-[#D7E1F0] p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-[#061B3A]">유동인구 시간대 분포</p>
              <BarChart3 className="h-4 w-4 text-[#0B66FF]" />
            </div>
            <div className="mt-5 flex h-20 items-end gap-3">
              {[22, 44, 62, 78, 56, 48, 64].map((height, index) => (
                <div key={index} className="flex-1 bg-[#0B66FF]" style={{ height: `${height}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 bg-[#F3F8FE] px-4 py-3 text-sm font-semibold text-[#53657E]">
        <Check className="h-4 w-4 text-[#00A99D]" />
        분석 근거는 공공데이터 출처와 함께 표시됩니다.
      </div>
    </div>
  )
}
