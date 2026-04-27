import { Baby, Bus, Store, WalletCards } from 'lucide-react'
import type { IncheonAnalyzeResponse, IncheonMetricCard } from '@/lib/incheon/types'

const ITEMS: Array<{
  key: keyof IncheonAnalyzeResponse['lifeDNA']
  icon: typeof Baby
  tone: string
}> = [
  { key: 'educationFamily', icon: Baby, tone: 'bg-[#DDF9F7] text-[#00A99D]' },
  { key: 'transitAccess', icon: Bus, tone: 'bg-[#E9F1FF] text-[#0B66FF]' },
  { key: 'categoryDensity', icon: Store, tone: 'bg-[#F0ECFF] text-[#6F4BEF]' },
  { key: 'costPressure', icon: WalletCards, tone: 'bg-[#FFF0EA] text-[#F26A1B]' },
]

function levelText(metric: IncheonMetricCard) {
  if (metric.level === 'high') return '높음'
  if (metric.level === 'medium') return '보통'
  if (metric.level === 'low') return '낮음'
  return '정보 부족'
}

export default function LifeDnaStrip({ data }: { data: IncheonAnalyzeResponse['lifeDNA'] }) {
  return (
    <section className="border border-[#D7E1F0] bg-white p-4">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-lg font-black text-[#061B3A]">생활권 DNA</h2>
        <span className="bg-[#EFF5FC] px-2 py-1 text-xs font-bold text-[#6B7A90]">점수와 분리</span>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {ITEMS.map((item) => {
          const metric = data[item.key]
          const Icon = item.icon
          return (
            <div key={item.key} className="flex items-center gap-4 border border-[#D7E1F0] bg-white p-4">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center ${item.tone}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[#53657E]">{metric.label}</p>
                <p className="mt-1 text-base font-black text-[#061B3A]">{levelText(metric)}</p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
