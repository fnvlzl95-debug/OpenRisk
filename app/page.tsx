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
  { grade: 'A', label: '주거형', color: 'from-emerald-400 to-emerald-600' },
  { grade: 'B', label: '혼합형', color: 'from-blue-400 to-blue-600' },
  { grade: 'C', label: '상업형', color: 'from-amber-400 to-amber-600' },
  { grade: 'D', label: '특수형', color: 'from-rose-400 to-rose-600' },
]

export default function Home() {
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const searchContainerRef = useRef<HTMLDivElement>(null)
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
        setIsFocused(false)
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
    // 검색창에 값만 입력 (자동 이동 안함)
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setIsLoading(true)
    router.push(`/result?query=${encodeURIComponent(query)}`)
  }

  return (
    <div className="relative min-h-screen bg-[#050505] text-white overflow-hidden selection:bg-blue-500/30">
      {/* Background Gradient Spotlights */}
      <div className="fixed top-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Navbar */}
      <nav className="fixed top-0 w-full p-4 sm:p-6 flex justify-between items-center z-50">
        <div className="font-bold text-lg sm:text-xl tracking-tighter flex items-center gap-2">
          <div className="w-2.5 sm:w-3 h-2.5 sm:h-3 bg-white rounded-full" />
          OpenRisk
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/select"
            className="text-[10px] sm:text-xs font-mono text-white/40 hover:text-white transition-colors px-2 sm:px-3 py-1 rounded-full border border-white/10 hover:border-white/30"
          >
            SWITCH
          </Link>
          <div className="hidden sm:block text-xs font-mono opacity-50 border border-white/20 px-3 py-1 rounded-full">
            SEOUL DATA 2025.Q3
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 pt-20 pb-10">
        <div className="relative flex flex-col items-center justify-center min-h-[80vh] px-4 w-full max-w-4xl mx-auto transition-all duration-700">

          {/* Hero Text */}
          <div className={`text-center transition-all duration-500 ${isFocused ? 'opacity-40 scale-95 blur-sm' : 'opacity-100'}`}>
            <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-3 sm:mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
              창업 실패를<br />관리하다.
            </h1>
            <p className="text-sm sm:text-lg text-white/40 font-light mb-8 sm:mb-12">
              공공데이터 기반 창업 리스크 지표 분석
            </p>
          </div>

          {/* Search Section */}
          <div
            ref={searchContainerRef}
            className={`w-full max-w-2xl transition-all duration-500 ease-out ${isFocused ? 'scale-105' : 'scale-100'}`}
            style={{ zIndex: 100, position: 'relative' }}
          >
            <form onSubmit={handleSearch} className="relative group">
              {/* Input Glow Effect */}
              <div className={`absolute -inset-1 rounded-2xl bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 opacity-0 transition duration-500 blur-lg group-hover:opacity-30 ${isFocused ? 'opacity-50' : ''}`} />

              {/* Input Field */}
              <div className="relative flex items-center bg-[#111] border border-white/10 rounded-xl sm:rounded-2xl p-1.5 sm:p-2 shadow-2xl">
                <div className="pl-3 sm:pl-4 pr-1 sm:pr-2 text-white/40">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => { setIsFocused(true); if(suggestions.length) setShowSuggestions(true); }}
                  onKeyDown={handleKeyDown}
                  placeholder="지역명, 지하철역 입력..."
                  className="w-full bg-transparent h-10 sm:h-14 text-base sm:text-xl outline-none placeholder:text-white/20 text-white font-medium"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={isLoading || !query.trim()}
                  className="px-4 sm:px-6 py-2 sm:py-3 bg-white text-black text-sm sm:text-base font-bold rounded-lg sm:rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                >
                  {isLoading ? (
                    <>
                      <div className="w-3 sm:w-4 h-3 sm:h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                      <span className="hidden sm:inline">분석중</span>
                    </>
                  ) : (
                    '분석'
                  )}
                </button>
              </div>

              {/* Suggestions Dropdown */}
              {showSuggestions && (
                <div className="absolute top-full left-0 right-0 mt-2 sm:mt-4 bg-[#111]/90 backdrop-blur-xl border border-white/10 rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl" style={{ zIndex: 9999 }}>
                  <div className="px-3 sm:px-4 py-2 sm:py-3 text-[10px] sm:text-xs font-mono text-white/30 border-b border-white/5 flex justify-between">
                    <span>SUGGESTIONS</span>
                    <span className="hidden sm:inline">ENTER to Select</span>
                  </div>
                  {suggestions.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectSuggestion(item)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`w-full px-3 sm:px-5 py-3 sm:py-4 flex items-center justify-between text-left transition-all ${
                        index === selectedIndex ? 'bg-white/10' : 'hover:bg-white/5'
                      }`}
                    >
                      <div>
                        <div className="text-sm sm:text-base text-white font-medium">{item.name}</div>
                        <div className="text-xs sm:text-sm text-white/40">{item.district}</div>
                      </div>
                      <svg className={`w-3 sm:w-4 h-3 sm:h-4 text-white/40 transform transition-transform ${index === selectedIndex ? 'translate-x-1 text-white' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ))}
                </div>
              )}
            </form>

            {/* Quick Tags */}
            {!showSuggestions && (
              <div className={`mt-4 sm:mt-6 flex flex-wrap justify-center gap-1.5 sm:gap-2 transition-opacity duration-500 ${isFocused ? 'opacity-0' : 'opacity-100'}`}>
                {['홍대입구역', '성수동', '강남역', '이태원'].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => { setQuery(tag); }}
                    className="px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-medium bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 text-white/60 hover:text-white transition-all"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer Stats / Legend */}
          <div className={`absolute bottom-6 sm:bottom-10 left-0 right-0 px-4 sm:px-6 transition-all duration-700 ${isFocused ? 'translate-y-20 opacity-0' : 'translate-y-0 opacity-100'}`}>
            <div className="max-w-4xl mx-auto border-t border-white/10 pt-4 sm:pt-6 flex flex-col md:flex-row justify-between items-center gap-3 sm:gap-4 text-xs sm:text-sm text-white/40">
              <div className="flex flex-wrap justify-center gap-3 sm:gap-6">
                {GRADE_DATA.map((g) => (
                  <div key={g.grade} className="flex items-center gap-1.5 sm:gap-2">
                    <div className={`w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-gradient-to-r ${g.color}`} />
                    <span className="font-mono text-[10px] sm:text-xs text-white/70">{g.label}</span>
                  </div>
                ))}
              </div>
              <div className="font-mono text-[10px] sm:text-xs">
                <span className="text-white">51</span> AREAS
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
