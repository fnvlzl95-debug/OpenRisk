import { Database, ShieldCheck } from 'lucide-react'
import type { IncheonDataSource } from '@/lib/incheon/types'

export default function DataSourcePanel({ sources }: { sources: IncheonDataSource[] }) {
  const visible = sources.slice(0, 8)
  const hiddenCount = Math.max(0, sources.length - visible.length)
  const readyCount = sources.filter((source) => source.status === 'ready' || source.status === 'local-candidate').length

  return (
    <section id="sources" className="border-y border-[#D7E1F0] bg-white">
      <div className="grid gap-0 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="border-b border-[#D7E1F0] p-6 lg:border-b-0 lg:border-r lg:p-8">
          <p className="text-sm font-black text-[#0B66FF]">출처·한계</p>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.02em] text-[#061B3A]">공공데이터 기준</h2>
          <p className="mt-4 text-sm font-semibold leading-6 text-[#53657E]">
            주소 검색과 요약은 이해를 돕기 위한 기능이며, 실제 위험도 점수는 신뢰할 수 있는 공공데이터만으로 계산됩니다.
          </p>
        </div>

        <div className="p-6 lg:p-8">
          <div className="grid gap-3 text-center sm:grid-cols-3">
            <div className="border border-[#D7E1F0] px-4 py-3">
              <p className="text-xs font-bold text-[#6B7A90]">출처 수</p>
              <p className="mt-1 text-lg font-black text-[#061B3A]">{sources.length}개</p>
            </div>
            <div className="border border-[#D7E1F0] px-4 py-3">
              <p className="text-xs font-bold text-[#6B7A90]">확보 상태</p>
              <p className="mt-1 text-lg font-black text-[#061B3A]">{readyCount}개</p>
            </div>
            <div className="border border-[#D7E1F0] px-4 py-3">
              <p className="text-xs font-bold text-[#6B7A90]">정책</p>
              <p className="mt-1 text-lg font-black text-[#0B66FF]">공공</p>
            </div>
          </div>

          <div className="mt-6 divide-y divide-[#EDF2F8] border-y border-[#D7E1F0]">
            {visible.map((source) => (
              <a
                key={source.sourceId}
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="grid gap-3 py-3 transition-colors hover:bg-[#FBFDFF] md:grid-cols-[32px_minmax(0,1fr)_120px] md:items-center"
              >
                <span className="flex h-8 w-8 items-center justify-center bg-[#EFF5FC] text-[#0B66FF]">
                  {source.scoringUse ? <Database className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black text-[#061B3A]">{source.name}</span>
                  <span className="mt-1 block truncate text-xs font-semibold text-[#6B7A90]">{source.provider}</span>
                </span>
                <span className="text-xs font-black text-[#6B7A90] md:text-right">
                  {source.scoringUse ? '점수 반영' : '참고'}
                </span>
              </a>
            ))}
          </div>

          {hiddenCount > 0 && (
            <p className="mt-3 text-xs font-semibold text-[#6B7A90]">상세 분석에 활용된 {hiddenCount}개의 추가 데이터가 있습니다.</p>
          )}
        </div>
      </div>
    </section>
  )
}
