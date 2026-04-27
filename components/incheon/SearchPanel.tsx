'use client'

import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, ChevronDown, Coffee, LocateFixed, MapPin, RefreshCw, Search, Target } from 'lucide-react'
import { CATEGORY_LIST, type BusinessCategory } from '@/lib/categories'
import { INCHEON_BOUNDS, INCHEON_DEMO_LOCATIONS, INCHEON_DEFAULT_CATEGORY } from '@/lib/incheon/constants'

type LocationKey = keyof typeof INCHEON_DEMO_LOCATIONS

type SearchSuggestion = {
  id: string
  name: string
  district: string
  display: string
  lat: number
  lng: number
  source: 'local' | 'kakao'
}

type SearchPanelProps = {
  compact?: boolean
  initialQuery?: string
  initialCategory?: string
}

type RemoteSearchSuggestion = Omit<SearchSuggestion, 'source'> & {
  source: 'kakao'
}

const PLACE_ALIASES: Array<{ keywords: string[]; key: LocationKey }> = [
  { keywords: ['송도', '송도동', '연수구', '센트럴파크'], key: 'songdo' },
  { keywords: ['부평', '부평역'], key: 'bupyeong' },
  { keywords: ['구월', '구월동', '인천시청', '예술회관'], key: 'guwol' },
  { keywords: ['청라', '청라동'], key: 'cheongna' },
  { keywords: ['검단', '검단신도시'], key: 'geomdan' },
  { keywords: ['영종', '영종도', '운서'], key: 'yeongjong' },
  { keywords: ['주안', '주안역'], key: 'juan' },
  { keywords: ['남동공단', '남동산단'], key: 'namdong' },
]

const QUICK_LINKS: Array<{ label: string; key: LocationKey; category: BusinessCategory }> = [
  { label: '송도동 카페', key: 'songdo', category: 'cafe' },
  { label: '부평역 카페', key: 'bupyeong', category: 'cafe' },
  { label: '구월동 한식', key: 'guwol', category: 'restaurant_korean' },
]

function normalizeText(value: string) {
  return value.replace(/\s/g, '').toLowerCase()
}

function sanitizeCategory(value?: string): BusinessCategory {
  return CATEGORY_LIST.some((item) => item.key === value) ? (value as BusinessCategory) : INCHEON_DEFAULT_CATEGORY
}

function makeLocalSuggestion(key: LocationKey): SearchSuggestion {
  const location = INCHEON_DEMO_LOCATIONS[key]
  return {
    id: `local-${key}`,
    name: location.label,
    district: location.label.split(' ').slice(0, 2).join(' '),
    display: location.label,
    lat: location.lat,
    lng: location.lng,
    source: 'local',
  }
}

function isInAnalysisBounds(suggestion: Pick<SearchSuggestion, 'lat' | 'lng'>) {
  return (
    suggestion.lat >= INCHEON_BOUNDS.latMin &&
    suggestion.lat <= INCHEON_BOUNDS.latMax &&
    suggestion.lng >= INCHEON_BOUNDS.lngMin &&
    suggestion.lng <= INCHEON_BOUNDS.lngMax
  )
}

function getLocalSuggestions(query: string, limit = 5) {
  const normalized = query.replace(/\s/g, '').toLowerCase()
  const scored = PLACE_ALIASES.map((item, index) => {
    const suggestion = makeLocalSuggestion(item.key)
    const fields = [suggestion.display, suggestion.name, suggestion.district, ...item.keywords].map(normalizeText)
    let score = 0

    if (!normalized) {
      score = PLACE_ALIASES.length - index
    } else if (fields.some((field) => field === normalized)) {
      score = 100
    } else if (fields.some((field) => field.startsWith(normalized) || normalized.startsWith(field))) {
      score = 80
    } else if (fields.some((field) => field.includes(normalized) || normalized.includes(field))) {
      score = 60
    }

    return { suggestion, score }
  })

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.suggestion)
}

function resolveLocalSuggestion(query: string) {
  return getLocalSuggestions(query, 1)[0] ?? null
}

function mergeSuggestions(suggestions: SearchSuggestion[]) {
  const seen = new Set<string>()
  const merged: SearchSuggestion[] = []

  for (const suggestion of suggestions) {
    const key = `${Math.round(suggestion.lat * 10000)}:${Math.round(suggestion.lng * 10000)}`
    const textKey = normalizeText(suggestion.display)
    if (seen.has(key) || seen.has(textKey)) {
      continue
    }
    seen.add(key)
    seen.add(textKey)
    merged.push(suggestion)
  }

  return merged
}

function findExactSuggestion(query: string, suggestions: SearchSuggestion[]) {
  const normalized = normalizeText(query)
  return suggestions.find((suggestion) => {
    return normalizeText(suggestion.display) === normalized || normalizeText(suggestion.name) === normalized
  })
}

export default function SearchPanel({
  compact = false,
  initialQuery = '인천 연수구 송도동',
  initialCategory = INCHEON_DEFAULT_CATEGORY,
}: SearchPanelProps) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)
  const [category, setCategory] = useState<BusinessCategory>(() => sanitizeCategory(initialCategory))
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>(() => getLocalSuggestions(initialQuery || '', 5))
  const [selectedSuggestion, setSelectedSuggestion] = useState<SearchSuggestion | null>(() =>
    resolveLocalSuggestion(initialQuery)
  )
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [searching, setSearching] = useState(false)
  const [searchStatus, setSearchStatus] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const inputId = compact ? 'incheon-compact-search' : 'incheon-search'
  const listboxId = `${inputId}-suggestions`

  const quickLinks = useMemo(() => QUICK_LINKS, [])

  useEffect(() => {
    setQuery(initialQuery)
    setSelectedSuggestion(resolveLocalSuggestion(initialQuery))
    setCategory(sanitizeCategory(initialCategory))
    setValidationError(null)
  }, [initialQuery, initialCategory])

  useEffect(() => {
    const trimmed = query.trim()
    const localSuggestions = getLocalSuggestions(trimmed, trimmed ? 5 : 4)
    setSuggestions(localSuggestions)
    setHighlightedIndex(0)
    setSearchStatus(null)

    if (trimmed.length < 2) {
      setSearching(false)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setSearching(true)
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}&region=incheon`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('검색 요청 실패')
        }

        const remoteResults = ((await response.json()) as RemoteSearchSuggestion[])
          .filter(isInAnalysisBounds)
          .map((item) => ({ ...item, source: 'kakao' as const }))

        const merged = mergeSuggestions([...localSuggestions, ...remoteResults]).slice(0, 7)
        setSuggestions(merged)
        setSearchStatus(
          merged.length > 0 ? null : '검색 결과가 없습니다. 인천 본토의 주소나 장소명을 더 구체적으로 입력하세요.'
        )
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return
        }
        setSearchStatus(
          localSuggestions.length > 0
            ? '외부 장소 검색을 불러오지 못해 기본 후보만 표시합니다.'
            : '검색을 불러오지 못했습니다. 잠시 후 다시 입력해 주세요.'
        )
      } finally {
        setSearching(false)
      }
    }, 220)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [query])

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const place = selectedSuggestion ?? findExactSuggestion(query, suggestions)

    if (!place) {
      setValidationError('자동완성 목록에서 분석할 위치를 선택해 주세요.')
      setShowSuggestions(true)
      return
    }

    if (!isInAnalysisBounds(place)) {
      setValidationError('현재 MVP는 인천 본토 분석 범위 안의 위치만 지원합니다.')
      setShowSuggestions(true)
      return
    }

    const params = new URLSearchParams({
      lat: String(place.lat),
      lng: String(place.lng),
      category,
      radius: '500',
      query: query.trim() || place.display,
    })
    router.push(`/incheon/result?${params.toString()}`)
  }

  const selectSuggestion = (suggestion: SearchSuggestion) => {
    setSelectedSuggestion(suggestion)
    setQuery(suggestion.display)
    setShowSuggestions(false)
    setValidationError(null)
  }

  const handleQueryChange = (value: string) => {
    setQuery(value)
    setSelectedSuggestion(null)
    setValidationError(null)
    setShowSuggestions(true)
  }

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) {
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightedIndex((index) => Math.min(index + 1, Math.max(suggestions.length - 1, 0)))
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedIndex((index) => Math.max(index - 1, 0))
    }

    if (event.key === 'Enter' && suggestions[highlightedIndex]) {
      event.preventDefault()
      selectSuggestion(suggestions[highlightedIndex])
    }

    if (event.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  const renderSuggestionList = (dark = false) => {
    if (!showSuggestions) {
      return null
    }

    return (
      <div
        id={listboxId}
        role="listbox"
        className={[
          'absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden border shadow-[0_18px_42px_rgba(4,21,47,0.18)]',
          dark ? 'border-[#1D5A98] bg-[#061B3A] text-white' : 'border-[#D4DFEE] bg-white text-[#081A34]',
        ].join(' ')}
      >
        {suggestions.map((suggestion, index) => (
          <button
            key={suggestion.id}
            type="button"
            role="option"
            aria-selected={index === highlightedIndex}
            onMouseDown={(event) => {
              event.preventDefault()
              selectSuggestion(suggestion)
            }}
            onMouseEnter={() => setHighlightedIndex(index)}
            className={[
              'grid w-full grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 text-left transition-colors',
              dark
                ? index === highlightedIndex
                  ? 'bg-white/10'
                  : 'hover:bg-white/8'
                : index === highlightedIndex
                  ? 'bg-[#EEF5FF]'
                  : 'hover:bg-[#F7FAFF]',
            ].join(' ')}
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-black">{suggestion.display}</span>
              <span className={['mt-0.5 block truncate text-xs font-bold', dark ? 'text-white/55' : 'text-[#6B7A90]'].join(' ')}>
                {suggestion.district || '인천'} 기준 후보
              </span>
            </span>
            <span
              className={[
                'shrink-0 border px-2 py-1 text-[11px] font-black',
                dark ? 'border-white/15 text-white/70' : 'border-[#D4DFEE] text-[#56708F]',
              ].join(' ')}
            >
              {suggestion.source === 'local' ? '기본' : '검색'}
            </span>
          </button>
        ))}

        {(searching || searchStatus) && (
          <p className={['border-t px-4 py-3 text-xs font-bold', dark ? 'border-white/10 text-white/60' : 'border-[#E7EEF7] text-[#6B7A90]'].join(' ')}>
            {searching ? '검색 후보를 확인하는 중입니다.' : searchStatus}
          </p>
        )}
      </div>
    )
  }

  if (compact) {
    return (
      <form
        onSubmit={onSubmit}
        className="grid gap-4 border border-[#155396] bg-[#061B3A]/92 p-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] md:grid-cols-[1.1fr_0.72fr_0.52fr_auto]"
      >
        <div className="relative flex min-w-0 items-center gap-4 border-[#244B78] md:border-r md:pr-7">
          <MapPin className="h-9 w-9 shrink-0 text-[#20D6F4]" />
          <div className="min-w-0 flex-1">
            <label htmlFor={inputId} className="block text-sm font-bold text-white/62">
              검색 위치
            </label>
            <input
              id={inputId}
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => window.setTimeout(() => setShowSuggestions(false), 120)}
              onKeyDown={handleSearchKeyDown}
              role="combobox"
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-expanded={showSuggestions}
              className="mt-1 w-full min-w-0 bg-transparent text-lg font-black text-white outline-none"
              aria-label="검색 위치"
            />
            {validationError && <p className="mt-2 text-xs font-bold text-[#FFB999]">{validationError}</p>}
          </div>
          {renderSuggestionList(true)}
        </div>

        <label className="flex min-w-0 items-center gap-4 border-[#244B78] md:border-r md:pr-7">
          <Coffee className="h-9 w-9 shrink-0 text-[#20D6F4]" />
          <span className="min-w-0">
            <span className="block text-sm font-bold text-white/62">업종</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as BusinessCategory)}
              className="mt-1 w-full min-w-0 bg-[#061B3A] text-lg font-black text-white outline-none"
              aria-label="업종"
            >
              {CATEGORY_LIST.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.name}
                </option>
              ))}
            </select>
          </span>
        </label>

        <div className="flex items-center gap-4">
          <Target className="h-9 w-9 shrink-0 text-[#20D6F4]" />
          <span>
            <span className="block text-sm font-bold text-white/62">반경</span>
            <span className="mt-1 block text-lg font-black">500m 고정</span>
          </span>
        </div>

        <button className="inline-flex min-h-12 items-center justify-center gap-3 border border-white/20 px-6 text-base font-black text-white transition-colors hover:bg-white/8 active:scale-[0.98]">
          <RefreshCw className="h-5 w-5" />
          다시 검색
        </button>
      </form>
    )
  }

  return (
    <form
      onSubmit={onSubmit}
      className="border border-[#B9D8FF] bg-white p-6 text-[#081A34] shadow-[0_24px_70px_rgba(4,21,47,0.28)]"
    >
      <div className="grid gap-4 md:grid-cols-[1fr_0.62fr_0.46fr]">
        <div className="relative space-y-2">
          <label htmlFor={inputId} className="block text-sm font-black">
            위치
          </label>
          <span className="flex h-14 items-center gap-3 border border-[#D4DFEE] px-4">
            <Search className="h-5 w-5 text-[#7C8AA1]" />
            <input
              id={inputId}
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => window.setTimeout(() => setShowSuggestions(false), 120)}
              onKeyDown={handleSearchKeyDown}
              role="combobox"
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-expanded={showSuggestions}
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-[#30405A] outline-none"
              placeholder="예: 인천 연수구 송도동"
            />
          </span>
          {renderSuggestionList()}
          {validationError && <p className="text-xs font-bold text-[#E65022]">{validationError}</p>}
        </div>

        <label className="space-y-2">
          <span className="block text-sm font-black">업종</span>
          <span className="flex h-14 items-center gap-3 border border-[#D4DFEE] px-4">
            <Building2 className="h-5 w-5 text-[#7C8AA1]" />
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as BusinessCategory)}
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-[#30405A] outline-none"
            >
              {CATEGORY_LIST.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.name}
                </option>
              ))}
            </select>
            <ChevronDown className="h-4 w-4 text-[#7C8AA1]" />
          </span>
        </label>

        <label className="space-y-2">
          <span className="block text-sm font-black">반경</span>
          <span className="flex h-14 items-center gap-3 border border-[#D4DFEE] px-4">
            <LocateFixed className="h-5 w-5 text-[#7C8AA1]" />
            <span className="min-w-0 flex-1 text-sm font-bold text-[#30405A]">500m 고정</span>
          </span>
        </label>
      </div>

      <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <button className="h-16 bg-[linear-gradient(180deg,#FF9E2C,#FF5B1D)] px-12 text-xl font-black text-white shadow-[0_16px_36px_rgba(255,103,28,0.28)] transition-transform active:scale-[0.98] md:min-w-[330px]">
          위험도 분석 시작
        </button>
        <p className="flex items-center gap-2 text-sm font-bold text-[#1D57B8]">
          <span className="flex h-6 w-6 items-center justify-center border border-[#1D57B8]/30">
            <MapPin className="h-4 w-4" />
          </span>
          회원가입 없이 바로 확인 가능
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-bold text-[#6B7A90]">
        {quickLinks.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              const suggestion = makeLocalSuggestion(item.key)
              setCategory(item.category)
              selectSuggestion(suggestion)
            }}
            className="transition-colors hover:text-[#0B66FF]"
          >
            {item.label}
          </button>
        ))}
      </div>
    </form>
  )
}
