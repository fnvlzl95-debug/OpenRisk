'use client'

import { FormEvent, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, ChevronDown, Coffee, LocateFixed, MapPin, RefreshCw, Search, Target } from 'lucide-react'
import { CATEGORY_LIST, type BusinessCategory } from '@/lib/categories'
import { INCHEON_DEMO_LOCATIONS, INCHEON_DEFAULT_CATEGORY } from '@/lib/incheon/constants'

const PLACE_ALIASES: Array<{ keywords: string[]; key: keyof typeof INCHEON_DEMO_LOCATIONS }> = [
  { keywords: ['송도', '송도동', '연수구'], key: 'songdo' },
  { keywords: ['부평', '부평역'], key: 'bupyeong' },
  { keywords: ['구월', '구월동'], key: 'guwol' },
  { keywords: ['청라'], key: 'cheongna' },
  { keywords: ['검단'], key: 'geomdan' },
  { keywords: ['영종'], key: 'yeongjong' },
  { keywords: ['주안', '주안역'], key: 'juan' },
  { keywords: ['남동공단', '남동산단'], key: 'namdong' },
]

function resolvePlace(query: string) {
  const normalized = query.replace(/\s/g, '').toLowerCase()
  const matched = PLACE_ALIASES.find((item) =>
    item.keywords.some((keyword) => normalized.includes(keyword.replace(/\s/g, '').toLowerCase()))
  )
  return INCHEON_DEMO_LOCATIONS[matched?.key ?? 'songdo']
}

export default function SearchPanel({ compact = false }: { compact?: boolean }) {
  const router = useRouter()
  const [query, setQuery] = useState('인천 연수구 송도동')
  const [category, setCategory] = useState<BusinessCategory>(INCHEON_DEFAULT_CATEGORY)

  const quickLinks = useMemo(() => ['인천 연수구 송도동', '부평역 카페', '구월동 음식점'], [])

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const place = resolvePlace(query)
    const params = new URLSearchParams({
      lat: String(place.lat),
      lng: String(place.lng),
      category,
      query: query.trim() || place.label,
    })
    router.push(`/incheon/result?${params.toString()}`)
  }

  if (compact) {
    return (
      <form
        onSubmit={onSubmit}
        className="grid gap-4 border border-[#155396] bg-[#061B3A]/92 p-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] md:grid-cols-[1.1fr_0.72fr_0.52fr_auto]"
      >
        <label className="flex min-w-0 items-center gap-4 border-[#244B78] md:border-r md:pr-7">
          <MapPin className="h-9 w-9 shrink-0 text-[#20D6F4]" />
          <span className="min-w-0">
            <span className="block text-sm font-bold text-white/62">검색 위치</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="mt-1 w-full min-w-0 bg-transparent text-lg font-black text-white outline-none"
              aria-label="검색 위치"
            />
          </span>
        </label>

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
            <span className="mt-1 block text-lg font-black">500m</span>
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
        <label className="space-y-2">
          <span className="block text-sm font-black">위치</span>
          <span className="flex h-14 items-center gap-3 border border-[#D4DFEE] px-4">
            <Search className="h-5 w-5 text-[#7C8AA1]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-[#30405A] outline-none"
              placeholder="예: 인천 연수구 송도동"
            />
          </span>
        </label>

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
            <select className="min-w-0 flex-1 bg-transparent text-sm font-bold text-[#30405A] outline-none" defaultValue="500m">
              <option>500m</option>
            </select>
            <ChevronDown className="h-4 w-4 text-[#7C8AA1]" />
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
          <button key={item} type="button" onClick={() => setQuery(item)} className="transition-colors hover:text-[#0B66FF]">
            {item}
          </button>
        ))}
      </div>
    </form>
  )
}
