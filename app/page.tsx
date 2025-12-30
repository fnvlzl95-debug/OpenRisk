'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface SearchSuggestion {
  id: string
  name: string
  district: string
  display: string
}

const GRADE_DATA = [
  { grade: 'A', label: '주거형', desc: '안정적 단골 기반', className: 'grade-a', color: '#10b981' },
  { grade: 'B', label: '혼합형', desc: '시간대별 전략 필요', className: 'grade-b', color: '#f59e0b' },
  { grade: 'C', label: '상업형', desc: '고위험 고수익', className: 'grade-c', color: '#ef4444' },
  { grade: 'D', label: '특수형', desc: '전문 분석 필요', className: 'grade-d', color: '#8b5cf6' },
]

const EXAMPLE_AREAS = ['홍대입구역', '강남역', '성수동', '이태원']

export default function Home() {
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // 자동완성 검색 (debounced)
  useEffect(() => {
    if (query.length < 1) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        setSuggestions(data)
        setShowSuggestions(data.length > 0)
        setSelectedIndex(-1)
      } catch (error) {
        console.error('Search error:', error)
        setSuggestions([])
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [query])

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 키보드 네비게이션
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
        break
      case 'Enter':
        if (selectedIndex >= 0) {
          e.preventDefault()
          selectSuggestion(suggestions[selectedIndex])
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        setSelectedIndex(-1)
        break
    }
  }

  const selectSuggestion = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.name)
    setShowSuggestions(false)
    setSelectedIndex(-1)
    // 검색창에 값만 입력하고 포커스 유지
    inputRef.current?.focus()
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setIsLoading(true)
    router.push(`/result?query=${encodeURIComponent(query)}`)
  }

  return (
    <div className="min-h-screen bg-[#09090b]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#09090b]/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-12 sm:h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="text-lg sm:text-xl font-bold tracking-tight text-white">OpenRisk</div>
            <span className="px-2 py-0.5 text-[10px] sm:text-xs font-medium rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">BETA</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/select"
              className="text-xs sm:text-sm px-3 py-1.5 rounded-lg transition-all text-zinc-500 hover:text-white border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/50"
            >
              스킨 변경
            </Link>
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-2 h-2 rounded-full animate-pulse bg-emerald-500" />
              <span className="text-xs text-zinc-500">서울시 공공데이터</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="pt-16 sm:pt-20 pb-8 sm:pb-12 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          {/* Hero Content */}
          <div className="text-center mb-6 sm:mb-10 animate-fade-up">
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-2 sm:mb-4 text-white">
              오픈리스크
            </h1>
            <p className="text-sm sm:text-base md:text-lg max-w-lg mx-auto text-zinc-400 leading-relaxed">
              서울시 상권의 리스크를 데이터로 분석합니다.<br className="hidden sm:block" />
              초보 창업자를 위한 <span className="text-white font-medium">객관적인 상권 진단</span> 서비스.
            </p>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-6 sm:mb-8 animate-fade-up delay-1 relative" style={{ zIndex: 100 }}>
            <div ref={searchContainerRef} className="relative">
              <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-zinc-900 border border-zinc-800 focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all shadow-2xl shadow-black/50">
                <div className="pl-2 sm:pl-3 text-zinc-500">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                  </svg>
                </div>

                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  placeholder="지역명 또는 주소 입력..."
                  className="flex-1 h-11 sm:h-14 bg-transparent text-base sm:text-lg text-white placeholder:text-zinc-600 outline-none"
                  autoComplete="off"
                />

                <button
                  type="submit"
                  disabled={isLoading || !query.trim()}
                  className="px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-lg sm:rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm sm:text-base font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 2v4m0 12v4m10-10h-4M6 12H2"/>
                      </svg>
                      <span className="hidden sm:inline">분석 중</span>
                    </>
                  ) : (
                    '분석하기'
                  )}
                </button>
              </div>

              {/* 자동완성 드롭다운 */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 sm:mt-3 rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl bg-zinc-900 border border-zinc-800" style={{ zIndex: 9999 }}>
                  {suggestions.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectSuggestion(item)}
                      className={`w-full px-4 py-3 sm:py-4 flex items-center gap-3 text-left transition-all ${
                        index === selectedIndex ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
                      } ${index < suggestions.length - 1 ? 'border-b border-zinc-800' : ''}`}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <svg className="w-4 h-4 text-zinc-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                        <circle cx="12" cy="10" r="3"/>
                      </svg>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm sm:text-base text-white font-medium truncate">{item.name}</div>
                        <div className="text-xs sm:text-sm text-zinc-500 truncate">{item.district}</div>
                      </div>
                      {index === selectedIndex && (
                        <span className="text-xs text-zinc-600 hidden sm:block">Enter ↵</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </form>

          {/* Example Tags */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-10 sm:mb-12 animate-fade-up delay-2">
            <span className="text-xs sm:text-sm text-zinc-600">예시:</span>
            {EXAMPLE_AREAS.map((area) => (
              <button
                key={area}
                type="button"
                onClick={() => setQuery(area)}
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 hover:bg-zinc-800 transition-all cursor-pointer"
              >
                {area}
              </button>
            ))}
          </div>

          {/* Grade Cards */}
          <div className="animate-fade-up delay-3">
            <div className="text-center mb-4 sm:mb-6">
              <span className="text-xs sm:text-sm font-medium tracking-widest uppercase text-zinc-600">리스크 등급 체계</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
              {GRADE_DATA.map((item, i) => (
                <div
                  key={item.grade}
                  className={`p-3 sm:p-6 text-center rounded-xl sm:rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 transition-all animate-fade-up delay-${i + 3}`}
                >
                  <div
                    className="w-10 h-10 sm:w-14 sm:h-14 mx-auto mb-2 sm:mb-3 rounded-lg sm:rounded-xl flex items-center justify-center text-lg sm:text-2xl font-bold text-white"
                    style={{ background: `linear-gradient(135deg, ${item.color}, ${item.color}99)`, boxShadow: `0 6px 24px ${item.color}33` }}
                  >
                    {item.grade}
                  </div>
                  <div className="text-sm sm:text-base font-semibold text-white mb-0.5">
                    {item.label}
                  </div>
                  <div className="text-[10px] sm:text-xs text-zinc-500">
                    {item.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats Preview */}
          <div className="mt-10 sm:mt-16 grid grid-cols-3 gap-2 sm:gap-3 animate-fade-up delay-5">
            <div className="p-3 sm:p-6 text-center rounded-xl sm:rounded-2xl bg-zinc-900/80 border border-zinc-800">
              <div className="text-[10px] sm:text-sm font-medium tracking-wider uppercase text-zinc-600 mb-1 sm:mb-2">분석 가능</div>
              <div className="text-xl sm:text-3xl font-bold text-white">51<span className="text-sm sm:text-lg text-zinc-500 ml-0.5">개</span></div>
            </div>
            <div className="p-3 sm:p-6 text-center rounded-xl sm:rounded-2xl bg-zinc-900/80 border border-zinc-800">
              <div className="text-[10px] sm:text-sm font-medium tracking-wider uppercase text-zinc-600 mb-1 sm:mb-2">데이터 기준</div>
              <div className="text-xl sm:text-3xl font-bold text-white">2025<span className="text-sm sm:text-lg text-zinc-500">.3Q</span></div>
            </div>
            <div className="p-3 sm:p-6 text-center rounded-xl sm:rounded-2xl bg-zinc-900/80 border border-zinc-800">
              <div className="text-[10px] sm:text-sm font-medium tracking-wider uppercase text-zinc-600 mb-1 sm:mb-2">커버리지</div>
              <div className="text-xl sm:text-3xl font-bold text-blue-400">85<span className="text-sm sm:text-lg text-zinc-500">%</span></div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 sm:py-10 text-center border-t border-zinc-900">
        <p className="text-xs sm:text-sm text-zinc-600">
          OpenRisk &middot; 초보 창업자를 위한 상권 분석 서비스
        </p>
      </footer>
    </div>
  )
}
