'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setIsLoading(true)
    // TODO: 실제 분석 API 연동
    // 임시로 결과 페이지로 이동
    router.push(`/result?query=${encodeURIComponent(query)}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-black">
      <main className="flex min-h-screen flex-col items-center justify-center px-4">
        {/* 로고/타이틀 */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-zinc-900 dark:text-white mb-4">
            오픈리스크
          </h1>
          <p className="text-lg md:text-xl text-zinc-600 dark:text-zinc-400">
            상권의 진짜 리스크를 번역합니다
          </p>
        </div>

        {/* 검색 폼 */}
        <form onSubmit={handleSearch} className="w-full max-w-xl">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="지역을 검색하세요 (예: 홍대입구역, 강남역)"
              className="w-full h-14 px-6 pr-32 text-lg rounded-full border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 transition-colors"
            />
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-10 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-600 text-white font-medium rounded-full transition-colors"
            >
              {isLoading ? '분석중...' : '분석하기'}
            </button>
          </div>
        </form>

        {/* 설명 */}
        <div className="mt-16 max-w-2xl text-center">
          <p className="text-zinc-500 dark:text-zinc-500 text-sm">
            서울 주요 상권의 리스크를 A/B/C/D 등급으로 분석합니다.
            <br />
            초보 창업자도 이해할 수 있는 해석과 행동 가이드를 제공합니다.
          </p>
        </div>

        {/* 등급 미리보기 */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl w-full">
          <GradeCard grade="A" name="주거" desc="Safe Zone" color="bg-green-500" />
          <GradeCard grade="B" name="혼합" desc="Gray Zone" color="bg-yellow-500" />
          <GradeCard grade="C" name="상업" desc="High Risk" color="bg-red-500" />
          <GradeCard grade="D" name="특수" desc="Special" color="bg-purple-500" />
        </div>
      </main>
    </div>
  )
}

function GradeCard({ grade, name, desc, color }: { grade: string; name: string; desc: string; color: string }) {
  return (
    <div className="p-4 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 text-center">
      <div className={`w-10 h-10 ${color} rounded-full flex items-center justify-center text-white font-bold mx-auto mb-2`}>
        {grade}
      </div>
      <div className="font-medium text-zinc-900 dark:text-white">{name}</div>
      <div className="text-xs text-zinc-500">{desc}</div>
    </div>
  )
}
