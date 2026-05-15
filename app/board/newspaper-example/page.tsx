'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Post {
  id: number
  title: string
  content: string
  is_notice: boolean
  view_count: number
  created_at: string
  author_nickname: string
  author_is_admin: boolean
  comment_count: number
}

const DEMO_BASE_TIME = new Date('2026-02-13T12:00:00+09:00').getTime()

const DEMO_POSTS: Post[] = [
  {
    id: 1,
    title: "강남역 상권 분석: 2024년 트렌드와 전망",
    content: "강남역 일대의 상권이 급격한 변화를 맞이하고 있습니다. 특히 테헤란로를 중심으로 한 IT 기업들의 입주가 늘어나면서 주변 상권의 구조가 크게 바뀌고 있습니다.",
    is_notice: true,
    view_count: 1247,
    created_at: new Date(DEMO_BASE_TIME).toISOString(),
    author_nickname: "편집국",
    author_is_admin: true,
    comment_count: 23
  },
  {
    id: 2,
    title: "소상공인을 위한 데이터 분석 가이드",
    content: "공공데이터를 활용한 상권 분석 방법론을 소개합니다. 초보자도 쉽게 따라할 수 있는 단계별 가이드를 통해 최적의 창업 입지를 찾아보세요.",
    is_notice: false,
    view_count: 856,
    created_at: new Date(DEMO_BASE_TIME - 3600000).toISOString(),
    author_nickname: "김상권",
    author_is_admin: false,
    comment_count: 15
  },
  {
    id: 3,
    title: "홍대 상권 변화의 숨은 이유",
    content: "최근 5년간 홍대 상권의 변화를 데이터로 분석했습니다. 젠트리피케이션의 영향과 새로운 기회를 함께 살펴봅니다.",
    is_notice: false,
    view_count: 634,
    created_at: new Date(DEMO_BASE_TIME - 7200000).toISOString(),
    author_nickname: "이창업",
    author_is_admin: false,
    comment_count: 8
  },
  {
    id: 4,
    title: "성수동 카페 창업 성공 사례",
    content: "성수동에서 카페를 시작한 창업자의 이야기. 데이터 분석을 통해 최적의 입지를 찾아낸 과정을 공유합니다.",
    is_notice: false,
    view_count: 492,
    created_at: new Date(DEMO_BASE_TIME - 10800000).toISOString(),
    author_nickname: "박카페",
    author_is_admin: false,
    comment_count: 12
  },
  {
    id: 5,
    title: "2026 상권 트렌드 예측",
    content: "올해 주목해야 할 상권 트렌드를 데이터로 미리 살펴봅니다. 전문가들의 인사이트를 함께 제공합니다.",
    is_notice: false,
    view_count: 423,
    created_at: new Date(DEMO_BASE_TIME - 14400000).toISOString(),
    author_nickname: "정분석",
    author_is_admin: false,
    comment_count: 7
  },
  {
    id: 6,
    title: "신촌 상권 재조명",
    content: "젊음의 거리로 알려진 신촌이 다시 주목받고 있습니다. 최신 데이터를 통해 변화의 조짐을 포착합니다.",
    is_notice: false,
    view_count: 381,
    created_at: new Date(DEMO_BASE_TIME - 18000000).toISOString(),
    author_nickname: "최트렌드",
    author_is_admin: false,
    comment_count: 5
  },
  {
    id: 7,
    title: "배달 앱 수수료와 소상공인",
    content: "배달 플랫폼 수수료가 소상공인에게 미치는 영향을 분석하고, 대안을 모색합니다.",
    is_notice: false,
    view_count: 298,
    created_at: new Date(DEMO_BASE_TIME - 21600000).toISOString(),
    author_nickname: "박소상",
    author_is_admin: false,
    comment_count: 11
  },
  {
    id: 8,
    title: "청담동 럭셔리 상권의 비밀",
    content: "청담동 명품 거리가 형성된 배경과 현재의 트렌드를 살펴봅니다.",
    is_notice: false,
    view_count: 267,
    created_at: new Date(DEMO_BASE_TIME - 25200000).toISOString(),
    author_nickname: "김럭셔리",
    author_is_admin: false,
    comment_count: 4
  }
]

/**
 * OPEN RISK 컨셉 게시판
 * - 신문/저널 느낌 + 현대적 감각
 * - 세리프 폰트로 신뢰감과 전문성
 * - 흑백 기조 + 포인트 컬러
 * - 명확한 정보 전달
 */
export default function NewspaperBoardExample() {
  const [posts] = useState<Post[]>(DEMO_POSTS)

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))

    if (hours < 24) {
      if (hours < 1) return '방금'
      return `${hours}시간 전`
    }
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}일 전`
    return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
      {/* 헤더 */}
      <header className="border-b-2 border-gray-900 bg-white sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
          <div className="flex items-center justify-between">
            <Link href="/home-b" className="group">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900">
                OPEN RISK
              </h1>
              <p className="text-[10px] sm:text-xs tracking-[0.2em] text-gray-500 uppercase mt-0.5">
                Commercial District Journal
              </p>
            </Link>
            <Link
              href="/board/write"
              className="px-5 sm:px-6 py-2 text-sm font-bold bg-gray-900 text-white hover:bg-gray-800 transition-colors"
            >
              글쓰기
            </Link>
          </div>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* 타이틀 섹션 */}
        <div className="mb-10 sm:mb-12 pb-6 border-b-2 border-gray-900">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs text-gray-500 mb-2 tracking-widest uppercase">Community Board</p>
              <h2 className="text-3xl sm:text-4xl font-black text-gray-900">자유게시판</h2>
            </div>
            <p className="text-sm text-gray-500">{posts.length}개의 글</p>
          </div>
        </div>

        {/* 게시글 리스트 - 인터랙티브 */}
        <div className="space-y-0">
          {posts.map((post) => (
            <article
              key={post.id}
              className="border-b border-gray-200 last:border-b-0 py-6 sm:py-7 -mx-4 px-4 sm:-mx-6 sm:px-6 group relative"
            >
              {/* 왼쪽 인디케이터 바 */}
              <div className="absolute left-0 top-6 bottom-6 w-1 bg-gray-900 transform scale-y-0 group-hover:scale-y-100 transition-transform duration-300 origin-top"></div>

              <Link href={`/board/${post.id}`} className="block">
                {/* 메타 정보 */}
                <div className="flex items-center gap-3 mb-3 transform group-hover:translate-x-2 transition-transform duration-300">
                  {post.is_notice && (
                    <span className="px-2.5 py-1 bg-gray-900 text-white text-[10px] font-bold tracking-wider uppercase shadow-sm">
                      Notice
                    </span>
                  )}
                  {post.author_is_admin && !post.is_notice && (
                    <span className="px-2.5 py-1 border-2 border-gray-900 text-gray-900 text-[10px] font-bold tracking-wider uppercase">
                      Admin
                    </span>
                  )}
                  <span className="text-sm text-gray-600 font-medium group-hover:text-gray-900 transition-colors">{post.author_nickname}</span>
                  <span className="text-gray-300">·</span>
                  <time className="text-sm text-gray-500 group-hover:text-gray-700 transition-colors">{formatDate(post.created_at)}</time>
                </div>

                {/* 제목 - 신문 헤드라인 스타일 */}
                <h3 className="text-xl sm:text-2xl lg:text-3xl font-black text-gray-900 mb-3 leading-tight group-hover:text-gray-600 transition-all duration-300 transform group-hover:translate-x-2">
                  {post.title}
                </h3>

                {/* 본문 미리보기 */}
                <p className="text-base sm:text-lg text-gray-700 leading-relaxed mb-4 line-clamp-2 group-hover:text-gray-900 transition-all duration-300 transform group-hover:translate-x-2" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  {post.content}
                </p>

                {/* 하단 정보 */}
                <div className="flex items-center justify-between text-sm text-gray-500 transform group-hover:translate-x-2 transition-all duration-300">
                  <div className="flex items-center gap-5">
                    <span className="flex items-center gap-2 group-hover:text-gray-900 transition-colors">
                      <svg className="w-4 h-4 transform group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span className="font-medium">{post.view_count.toLocaleString()}</span>
                    </span>
                    {post.comment_count > 0 && (
                      <span className="flex items-center gap-2 text-gray-900 font-semibold group-hover:text-gray-900 transition-colors">
                        <svg className="w-4 h-4 transform group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span>{post.comment_count}</span>
                      </span>
                    )}
                  </div>
                  <span className="text-gray-900 font-bold flex items-center gap-2 group-hover:gap-3 transition-all">
                    Read more
                    <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                </div>
              </Link>
            </article>
          ))}
        </div>

        {/* 페이지네이션 - 인터랙티브 */}
        <div className="flex justify-center items-center gap-2 mt-12 sm:mt-16 pt-10 border-t-2 border-gray-900">
          <button className="w-12 h-12 flex items-center justify-center border-2 border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white hover:scale-110 active:scale-95 transition-all duration-200 font-bold">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button className="w-12 h-12 flex items-center justify-center bg-gray-900 text-white font-bold hover:scale-110 active:scale-95 transition-all duration-200 shadow-lg">
            1
          </button>
          <button className="w-12 h-12 flex items-center justify-center border-2 border-gray-300 text-gray-600 hover:border-gray-900 hover:text-gray-900 hover:scale-110 active:scale-95 transition-all duration-200 font-bold">
            2
          </button>
          <button className="w-12 h-12 flex items-center justify-center border-2 border-gray-300 text-gray-600 hover:border-gray-900 hover:text-gray-900 hover:scale-110 active:scale-95 transition-all duration-200 font-bold">
            3
          </button>
          <button className="w-12 h-12 flex items-center justify-center border-2 border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white hover:scale-110 active:scale-95 transition-all duration-200 font-bold">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="border-t-2 border-gray-900 bg-white mt-20 py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-xs tracking-widest text-gray-600 uppercase mb-1">
              © 2026 Open Risk Journal
            </p>
            <p className="text-xs text-gray-500">
              Commercial District Intelligence · Data-Driven Insights
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
