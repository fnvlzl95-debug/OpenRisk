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

// 실제로 존재하는 목적지(랜딩 섹션 앵커)만 링크로 노출한다.
// 아직 구현되지 않은 항목(요금 안내·FAQ 등)은 표시하지 않는다.
const columns: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
  {
    title: '서비스',
    links: [{ label: '서비스 소개', href: '/incheon#service' }],
  },
  {
    title: '분석 방식',
    links: [
      { label: '분석 프로세스', href: '/incheon#method' },
      { label: '핵심 지표', href: '/incheon#method' },
    ],
  },
  {
    title: '데이터',
    links: [{ label: '데이터 출처', href: '/incheon#data' }],
  },
  {
    title: '문의',
    links: [{ label: '문의하기', href: '/incheon#contact' }],
  },
]

export default function IncheonFooter() {
  const year = new Date().getFullYear()

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

          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="text-sm font-black text-white">{column.title}</h3>
              <ul className="mt-4 space-y-3 text-sm font-semibold text-white/58">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="transition-colors hover:text-white">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="pt-5 text-center text-sm text-white/54">© {year} OpenRisk. All rights reserved.</p>
      </div>
    </footer>
  )
}
