'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface SearchSuggestion {
  id: string
  name: string
  district: string
  display: string
}

const GRADE_DATA = [
  { grade: 'A', label: '주거형', desc: '안정적 단골 기반', className: 'grade-a' },
  { grade: 'B', label: '혼합형', desc: '시간대별 전략 필요', className: 'grade-b' },
  { grade: 'C', label: '상업형', desc: '고위험 고수익', className: 'grade-c' },
  { grade: 'D', label: '특수형', desc: '전문 분석 필요', className: 'grade-d' },
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
    // 자동으로 검색 실행
    setIsLoading(true)
    router.push(`/result?query=${encodeURIComponent(suggestion.name)}`)
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setIsLoading(true)
    router.push(`/result?query=${encodeURIComponent(query)}`)
  }

  return (
    <div className="min-h-screen grid-bg">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50" style={{ background: 'rgba(10,10,12,0.8)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-mono text-title" style={{ color: 'var(--text-primary)' }}>OpenRisk</div>
            <span className="tag">BETA</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--grade-a)' }} />
            <span className="text-caption" style={{ color: 'var(--text-tertiary)' }}>서울시 공공데이터</span>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="pt-24 sm:pt-32 pb-16 sm:pb-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          {/* Hero Content */}
          <div className="text-center mb-10 sm:mb-16 animate-fade-up">
            <h1 className="text-display mb-4 sm:mb-6" style={{ color: 'var(--text-primary)' }}>
              오픈리스크
            </h1>
            <p className="text-body max-w-md mx-auto px-4" style={{ color: 'var(--text-secondary)' }}>
              서울시 상권의 리스크를 데이터로 분석합니다.<br />
              초보 창업자를 위한 객관적인 상권 진단 서비스.
            </p>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-8 animate-fade-up delay-1">
            <div ref={searchContainerRef} className="relative">
              <div className="search-container p-2 flex items-center gap-3">
                <div className="pl-3" style={{ color: 'var(--text-muted)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                  placeholder="지역명 또는 주소 입력"
                  className="search-input flex-1 h-12"
                  autoComplete="off"
                />

                <button
                  type="submit"
                  disabled={isLoading || !query.trim()}
                  className="btn-primary"
                >
                  {isLoading ? (
                    <>
                      <svg className="spinner w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 2v4m0 12v4m10-10h-4M6 12H2"/>
                      </svg>
                      분석 중
                    </>
                  ) : (
                    '분석하기'
                  )}
                </button>
              </div>

              {/* 자동완성 드롭다운 */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden z-50 shadow-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                  {suggestions.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectSuggestion(item)}
                      className="w-full px-4 py-3 flex items-center gap-3 text-left transition-colors"
                      style={{
                        background: index === selectedIndex ? 'var(--bg-surface)' : 'transparent',
                        borderBottom: index < suggestions.length - 1 ? '1px solid var(--border-subtle)' : 'none'
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                        <circle cx="12" cy="10" r="3"/>
                      </svg>
                      <div className="flex-1 min-w-0">
                        <div className="text-body truncate" style={{ color: 'var(--text-primary)' }}>{item.name}</div>
                        <div className="text-caption truncate" style={{ color: 'var(--text-tertiary)' }}>{item.district}</div>
                      </div>
                      {index === selectedIndex && (
                        <span className="text-caption" style={{ color: 'var(--text-muted)' }}>Enter ↵</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </form>

          {/* Example Tags */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-12 sm:mb-20 animate-fade-up delay-2">
            <span className="text-caption" style={{ color: 'var(--text-muted)' }}>예시:</span>
            {EXAMPLE_AREAS.map((area) => (
              <button
                key={area}
                type="button"
                onClick={() => setQuery(area)}
                className="tag cursor-pointer transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
              >
                {area}
              </button>
            ))}
          </div>

          {/* Grade Cards */}
          <div className="animate-fade-up delay-3">
            <div className="text-center mb-6 sm:mb-8">
              <span className="text-label" style={{ color: 'var(--text-muted)' }}>리스크 등급 체계</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {GRADE_DATA.map((item, i) => (
                <div
                  key={item.grade}
                  className={`card p-4 sm:p-6 text-center animate-fade-up delay-${i + 3}`}
                >
                  <div className={`grade-badge grade-badge-sm ${item.className} mx-auto mb-3 sm:mb-4`}>
                    {item.grade}
                  </div>
                  <div className="text-title mb-1" style={{ color: 'var(--text-primary)' }}>
                    {item.label}
                  </div>
                  <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
                    {item.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats Preview */}
          <div className="mt-12 sm:mt-20 grid grid-cols-3 gap-px rounded-lg overflow-hidden animate-fade-up delay-5" style={{ background: 'var(--border-subtle)' }}>
            <div className="p-4 sm:p-6 text-center" style={{ background: 'var(--bg-surface)' }}>
              <div className="stat-block items-center">
                <span className="stat-label">분석 가능 상권</span>
                <span className="stat-value">51<span className="stat-unit">개</span></span>
              </div>
            </div>
            <div className="p-4 sm:p-6 text-center" style={{ background: 'var(--bg-surface)' }}>
              <div className="stat-block items-center">
                <span className="stat-label">데이터 기준</span>
                <span className="stat-value text-data-sm">2025.3Q</span>
              </div>
            </div>
            <div className="p-4 sm:p-6 text-center" style={{ background: 'var(--bg-surface)' }}>
              <div className="stat-block items-center">
                <span className="stat-label">분석 신뢰도</span>
                <span className="stat-value">85<span className="stat-unit">%</span></span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 text-center" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <p className="text-caption" style={{ color: 'var(--text-muted)' }}>
          OpenRisk &middot; 초보 창업자를 위한 상권 분석 서비스
        </p>
      </footer>
    </div>
  )
}
