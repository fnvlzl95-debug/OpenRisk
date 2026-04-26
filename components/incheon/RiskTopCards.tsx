import type { IncheonRiskCard } from '@/lib/incheon/types'

export default function RiskTopCards({ cards }: { cards: IncheonRiskCard[] }) {
  return (
    <section>
      <h2 className="mb-4 text-xl font-black text-[#061B3A]">주요 리스크 TOP 3</h2>
      <div className="grid gap-4 lg:grid-cols-3">
        {cards.map((card) => (
          <article key={card.rank} className="border border-[#D7E1F0] bg-white p-5 shadow-sm">
            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#0B66FF] text-lg font-black text-white">
                {card.rank}
              </div>
              <div>
                <h3 className="font-black text-[#061B3A]">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#53657E]">{card.body}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {card.evidenceBadges.map((badge) => (
                    <span key={badge} className="bg-[#EFF5FC] px-3 py-1 text-xs font-bold text-[#0B66FF]">
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
