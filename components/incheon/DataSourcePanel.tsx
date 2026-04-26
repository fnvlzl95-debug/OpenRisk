import { Database, ShieldCheck } from 'lucide-react'
import type { IncheonDataSource } from '@/lib/incheon/types'

export default function DataSourcePanel({ sources }: { sources: IncheonDataSource[] }) {
  const visible = sources.slice(0, 6)
  const readyCount = sources.filter((source) => source.status === 'ready' || source.status === 'local-candidate').length

  return (
    <section id="sources" className="border border-[#D7E1F0] bg-white p-5">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h2 className="text-xl font-black text-[#061B3A]">데이터 출처·신뢰도</h2>
          <p className="mt-2 text-sm leading-6 text-[#53657E]">
            분석 근거에는 무료 공공데이터만 사용하며, 각 지표의 기준 단위와 기준일을 함께 표시합니다.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-center md:grid-cols-3">
          <div className="border border-[#D7E1F0] px-4 py-3">
            <p className="text-xs font-bold text-[#6B7A90]">출처 수</p>
            <p className="mt-1 text-lg font-black text-[#061B3A]">{sources.length}개</p>
          </div>
          <div className="border border-[#D7E1F0] px-4 py-3">
            <p className="text-xs font-bold text-[#6B7A90]">확보 후보</p>
            <p className="mt-1 text-lg font-black text-[#061B3A]">{readyCount}개</p>
          </div>
          <div className="border border-[#D7E1F0] px-4 py-3">
            <p className="text-xs font-bold text-[#6B7A90]">정책</p>
            <p className="mt-1 text-lg font-black text-[#00A99D]">공공</p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {visible.map((source) => (
          <a
            key={source.sourceId}
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 border border-[#D7E1F0] bg-[#FBFDFF] p-4"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#EFF5FC] text-[#0B66FF]">
              {source.scoringUse ? <Database className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-[#061B3A]">{source.name}</p>
              <p className="mt-1 truncate text-xs font-semibold text-[#6B7A90]">{source.provider}</p>
            </div>
          </a>
        ))}
      </div>

      <p className="mt-4 text-xs leading-6 text-[#6B7A90]">
        주소 검색이나 선택형 요약 기능은 사용자 편의를 위한 보조 기능이며, 분석 결과와 근거 데이터에는 포함되지 않습니다.
      </p>
    </section>
  )
}
