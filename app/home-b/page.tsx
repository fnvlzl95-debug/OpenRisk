'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import CategorySelector from '@/components/CategorySelector'
import { type BusinessCategory } from '@/lib/categories'

interface SearchSuggestion {
  id: string
  name: string
  district: string
  display: string
  lat?: number
  lng?: number
}

export default function HomeEditorial() {
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<BusinessCategory | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [showCategoryWarning, setShowCategoryWarning] = useState(false)
  const skipNextSearchRef = useRef(false)
  const searchContainerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // 자동완성 검색 (debounced)
  useEffect(() => {
    if (query.length < 1) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false
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

  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null)

  const selectSuggestion = (suggestion: SearchSuggestion & { lat?: number; lng?: number }) => {
    skipNextSearchRef.current = true
    setQuery(suggestion.name)
    if (suggestion.lat && suggestion.lng) {
      setSelectedCoords({ lat: suggestion.lat, lng: suggestion.lng })
    }
    setSuggestions([])
    setShowSuggestions(false)
    setSelectedIndex(-1)
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    if (!selectedCategory) {
      setShowCategoryWarning(true)
      setTimeout(() => setShowCategoryWarning(false), 3000)
      return
    }

    setIsLoading(true)

    let url = `/result-b?query=${encodeURIComponent(query)}&category=${selectedCategory}`
    if (selectedCoords) {
      url += `&lat=${selectedCoords.lat}&lng=${selectedCoords.lng}`
    }
    router.push(url)
  }

  const currentDate = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-black selection:bg-black/10">
      {/* Newspaper Header */}
      <header className="border-b-2 border-black">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-2 sm:py-3">
          {/* Top bar */}
          <div className="flex justify-between items-center text-[9px] sm:text-[10px] font-mono text-gray-500 mb-2">
            <span className="hidden sm:inline">{currentDate}</span>
            <span className="sm:hidden">{new Date().toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
            <div className="flex items-center gap-2 sm:gap-4">
              <span className="hidden sm:inline">VOL. 2026 NO. 001</span>
              <Link
                href="/select"
                className="px-2 py-1 border border-gray-300 hover:border-black hover:bg-black hover:text-white transition-colors"
              >
                SWITCH
              </Link>
            </div>
          </div>

          {/* Masthead */}
          <div className="text-center py-3 sm:py-4 border-t border-b border-gray-300">
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>
              OPEN RISK
            </h1>
            <p className="text-[9px] sm:text-xs font-mono text-gray-500 mt-1 tracking-[0.2em] sm:tracking-[0.3em]">
              COMMERCIAL DISTRICT RISK ANALYSIS
            </p>
          </div>

          {/* Tagline */}
          <div className="flex flex-wrap justify-center items-center gap-2 sm:gap-4 py-2 text-[11px] sm:text-xs text-gray-600">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-black rounded-full"></span>
              공공데이터 기반
            </span>
            <span className="text-gray-300 hidden sm:inline">|</span>
            <span>7대 지표 분석</span>
            <span className="text-gray-300 hidden sm:inline">|</span>
            <span>서울 · 경기 · 인천</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-6 sm:py-12">
        {/* Headline */}
        <div className="text-center mb-6 sm:mb-12">
          <p className="text-[10px] sm:text-sm font-mono text-gray-500 mb-1 sm:mb-2">EDITION 2026</p>
          <h2 className="text-xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-2 sm:mb-4" style={{ fontFamily: 'Georgia, serif' }}>
            창업 실패를 관리하다
          </h2>
          <p className="text-xs sm:text-base text-gray-600 max-w-lg mx-auto leading-relaxed">
            소상공인시장진흥공단 공식 데이터 기반<br />
            상권 리스크를 7대 지표로 정량화합니다
          </p>
        </div>

        {/* Search Section */}
        <div
          ref={searchContainerRef}
          className="max-w-2xl mx-auto mb-8 sm:mb-12"
          style={{ position: 'relative', zIndex: 100 }}
        >
          <form onSubmit={handleSearch} className="relative">
            {/* Search Box */}
            <div className="border-2 border-black bg-white">
              {/* Category Row */}
              <div className="border-b border-gray-200 p-2 sm:p-3">
                <div className="text-[9px] sm:text-[10px] font-mono text-gray-400 mb-1.5 sm:mb-2">CATEGORY</div>
                <CategorySelector
                  value={selectedCategory}
                  onChange={setSelectedCategory}
                  variant="editorial"
                />
              </div>

              {/* Search Input Row */}
              <div className="flex items-center">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setSelectedCoords(null)
                  }}
                  onFocus={() => { if(suggestions.length) setShowSuggestions(true) }}
                  onKeyDown={handleKeyDown}
                  placeholder="지역명 또는 주소 입력"
                  className="flex-1 px-3 sm:px-4 py-3 sm:py-4 text-base sm:text-lg outline-none placeholder:text-gray-300"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={isLoading || !query.trim()}
                  className="px-4 sm:px-6 py-3 sm:py-4 bg-black text-white text-sm sm:text-base font-bold hover:bg-gray-800 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span className="hidden sm:inline">분석중</span>
                    </span>
                  ) : (
                    <span>분석<span className="hidden sm:inline">하기</span></span>
                  )}
                </button>
              </div>
            </div>

            {/* Category Warning */}
            {showCategoryWarning && (
              <div className="mt-3 text-center">
                <span className="inline-block px-4 py-2 bg-red-50 border border-red-200 text-red-600 text-sm">
                  업종을 선택해주세요
                </span>
              </div>
            )}

            {/* Suggestions Dropdown */}
            {showSuggestions && (
              <div className="absolute left-0 right-0 bg-white border-2 border-black shadow-lg" style={{ zIndex: 9999, top: '100%', marginTop: '4px' }}>
                <div className="px-4 py-2 text-[10px] font-mono text-gray-400 border-b border-gray-200">
                  SUGGESTIONS
                </div>
                {suggestions.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectSuggestion(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full px-4 py-3 flex items-center justify-between text-left transition-colors ${
                      index === selectedIndex ? 'bg-gray-100' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-gray-500">{item.district}</div>
                    </div>
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </form>

          {/* Quick Tags */}
          <div className="mt-3 sm:mt-4 flex flex-wrap justify-center gap-1.5 sm:gap-2">
            {['홍대입구역', '성수동', '강남역', '이태원'].map((tag) => (
              <button
                key={tag}
                onClick={() => {
                  skipNextSearchRef.current = true
                  setQuery(tag)
                  setSelectedCoords(null)
                  fetch(`/api/search?q=${encodeURIComponent(tag)}`)
                    .then(res => res.json())
                    .then(data => {
                      setSuggestions(data)
                      setShowSuggestions(data.length > 0)
                      setSelectedIndex(-1)
                    })
                    .catch(console.error)
                }}
                className="px-2.5 sm:px-3 py-1 text-xs sm:text-sm border border-gray-300 hover:border-black hover:bg-black hover:text-white transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Info Columns - Newspaper Style */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 border-t-2 border-black pt-4 sm:pt-6">
          {/* Column 1 */}
          <div className="border-b md:border-b-0 md:border-r border-gray-200 pb-4 md:pb-0 pr-0 md:pr-6">
            <h3 className="text-[10px] sm:text-xs font-mono text-gray-500 mb-1.5 sm:mb-2">DATA SOURCE</h3>
            <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
              공공데이터 기반
            </p>
          </div>

          {/* Column 2 */}
          <div className="border-b md:border-b-0 md:border-r border-gray-200 pb-4 md:pb-0 pr-0 md:pr-6">
            <h3 className="text-[10px] sm:text-xs font-mono text-gray-500 mb-1.5 sm:mb-2">7 INDICATORS</h3>
            <div className="grid grid-cols-4 sm:grid-cols-2 gap-1 text-xs sm:text-sm">
              <span className="text-gray-600">경쟁밀도</span>
              <span className="text-gray-600">유동인구</span>
              <span className="text-gray-600">임대료</span>
              <span className="text-gray-600">폐업률</span>
              <span className="text-gray-600">앵커시설</span>
              <span className="text-gray-600">시간특성</span>
              <span className="text-gray-600">상권성격</span>
            </div>
          </div>

          {/* Column 3 */}
          <div>
            <h3 className="text-[10px] sm:text-xs font-mono text-gray-500 mb-1.5 sm:mb-2">AREA TYPES</h3>
            <div className="grid grid-cols-2 md:grid-cols-1 gap-1 text-xs sm:text-sm">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-gray-300"></span>
                <span>A 주거형</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-gray-400"></span>
                <span>B 혼합형</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-gray-600"></span>
                <span>C 상업형</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-black"></span>
                <span>D 특수형</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-8 sm:mt-12">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-gray-500">
            <div className="flex items-center gap-2 sm:gap-4">
              <span className="font-bold text-black">OPEN RISK</span>
              <span className="hidden sm:inline">공공데이터 기반 상권 분석</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <span>SEOUL DATA 2025.Q3</span>
              <span className="text-gray-300">|</span>
              <span>51 DISTRICTS</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
