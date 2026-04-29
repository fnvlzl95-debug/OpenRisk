import Image from 'next/image'
import Link from 'next/link'

export default function IncheonHeader() {
  return (
    <header className="sticky top-0 z-[3000] border-b border-[#D9E2F0] bg-white/96 text-[#081A34] shadow-[0_1px_0_rgba(8,26,52,0.04)] backdrop-blur">
      <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link href="/incheon" className="flex h-14 items-center" aria-label="오픈리스크 홈">
          <Image
            src="/incheon/openrisk-incheon-header-logo-clean.png"
            alt="오픈리스크"
            width={740}
            height={156}
            priority
            unoptimized
            className="h-12 w-auto"
          />
        </Link>

        <nav className="hidden items-center gap-12 text-[15px] font-bold text-[#0D1D35] md:flex">
          <a className="transition-colors hover:text-[#0B66FF]" href="/incheon#service">
            서비스
          </a>
          <a className="transition-colors hover:text-[#0B66FF]" href="/incheon#method">
            분석 방식
          </a>
          <a className="transition-colors hover:text-[#0B66FF]" href="/incheon#data">
            데이터
          </a>
          <a className="transition-colors hover:text-[#0B66FF]" href="/incheon#contact">
            문의
          </a>
        </nav>

        <div className="flex items-center gap-4">
          <a className="hidden text-[15px] font-bold text-[#0D1D35] transition-colors hover:text-[#0B66FF] sm:block" href="/incheon#contact">
            로그인
          </a>
          <Link
            href="/incheon/result?lat=37.3897&lng=126.6454&category=cafe&query=%EC%9D%B8%EC%B2%9C%20%EC%97%B0%EC%88%98%EA%B5%AC%20%EC%86%A1%EB%8F%84%EB%8F%99"
            className="bg-[#0B66FF] px-5 py-3 text-sm font-black text-white shadow-[0_10px_22px_rgba(11,102,255,0.24)] transition-transform active:scale-[0.98]"
          >
            분석 시작
          </Link>
        </div>
      </div>
    </header>
  )
}
