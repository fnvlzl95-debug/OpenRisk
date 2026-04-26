import Link from 'next/link'

function Mark() {
  return (
    <div className="relative h-9 w-9 shrink-0">
      <div className="absolute left-1 top-1 h-4 w-4 bg-[#1B65F2] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]" />
      <div className="absolute right-1 top-1 h-4 w-4 bg-[#F4B32D] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]" />
      <div className="absolute bottom-1 left-1/2 h-4 w-4 -translate-x-1/2 bg-[#E8EEF7] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]" />
      <div className="absolute inset-[10px] bg-[#0F57D6]" />
    </div>
  )
}

export default function IncheonHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#D9E2F0] bg-white/96 text-[#081A34] shadow-[0_1px_0_rgba(8,26,52,0.04)] backdrop-blur">
      <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link href="/incheon" className="flex items-center gap-3" aria-label="OpenRisk 홈">
          <Mark />
          <span className="text-2xl font-black tracking-[-0.02em]">OpenRisk</span>
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
