import Image from 'next/image'

function FooterLogo() {
  return (
    <div className="inline-flex items-center">
      <Image
        src="/incheon/openrisk-incheon-footer-logo.png"
        alt="오픈리스크"
        width={740}
        height={156}
        unoptimized
        className="h-11 w-auto"
      />
    </div>
  )
}

const columns = [
  ['서비스', '서비스 소개', '이용 가이드', '요금 안내'],
  ['분석 방식', '분석 프로세스', '핵심 지표', '정확도 및 한계'],
  ['데이터', '데이터 출처', '업데이트 현황', '데이터 품질'],
  ['문의', '자주 묻는 질문', '문의하기'],
]

export default function IncheonFooter() {
  return (
    <footer id="contact" className="bg-[#031B37] text-white">
      <div className="mx-auto max-w-7xl px-5 py-9 lg:px-8">
        <div className="grid gap-10 border-b border-white/10 pb-9 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          <div>
            <FooterLogo />
            <p className="mt-4 max-w-xs text-sm leading-7 text-white/64">
              인천 공공데이터 기반 상권 리스크 분석 서비스
            </p>
          </div>

          {columns.map(([title, ...items]) => (
            <div key={title}>
              <h3 className="text-sm font-black text-white">{title}</h3>
              <ul className="mt-4 space-y-3 text-sm font-semibold text-white/58">
                {items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="pt-5 text-center text-sm text-white/54">© 2024 OpenRisk. All rights reserved.</p>
      </div>
    </footer>
  )
}
