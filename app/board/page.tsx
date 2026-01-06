'use client'

import { useState } from 'react'
import Link from 'next/link'

// 더미 데이터 (나중에 API로 교체)
const DUMMY_POSTS = [
  {
    id: 1,
    title: '오픈리스크 서비스 이용 안내',
    content: '오픈리스크는 공공데이터 기반 창업 리스크 분석 서비스입니다.',
    is_notice: true,
    view_count: 1234,
    created_at: '2026-01-06T10:00:00Z',
    author: { nickname: '관리자', is_admin: true },
    comment_count: 12,
  },
  {
    id: 2,
    title: '데이터 업데이트 공지 (2026년 1월)',
    content: '2025년 10월 기준 소상공인 데이터로 업데이트되었습니다.',
    is_notice: true,
    view_count: 892,
    created_at: '2026-01-05T09:00:00Z',
    author: { nickname: '관리자', is_admin: true },
    comment_count: 5,
  },
  {
    id: 3,
    title: '강남역 카페 창업 분석 결과 공유합니다',
    content: '강남역 근처 카페 창업을 고민 중인데 분석 결과가 꽤 충격적이었어요.',
    is_notice: false,
    view_count: 456,
    created_at: '2026-01-06T08:30:00Z',
    author: { nickname: '예비창업자', is_admin: false },
    comment_count: 23,
  },
  {
    id: 4,
    title: '홍대 vs 합정 어디가 나을까요?',
    content: '음식점 창업 준비 중인데요, 두 지역 비교 분석 해보신 분 계신가요?',
    is_notice: false,
    view_count: 234,
    created_at: '2026-01-05T15:20:00Z',
    author: { nickname: '맛집사장', is_admin: false },
    comment_count: 8,
  },
  {
    id: 5,
    title: '분석 결과 해석 방법 문의드립니다',
    content: '리스크 점수가 65점이 나왔는데 이게 높은 건가요 낮은 건가요?',
    is_notice: false,
    view_count: 178,
    created_at: '2026-01-04T11:00:00Z',
    author: { nickname: '초보창업', is_admin: false },
    comment_count: 15,
  },
  {
    id: 6,
    title: '실제 창업 후기 - 분석 결과와 비교',
    content: '작년에 오픈리스크로 분석하고 창업했는데 6개월 지난 후기 공유합니다.',
    is_notice: false,
    view_count: 567,
    created_at: '2026-01-03T14:00:00Z',
    author: { nickname: '카페사장님', is_admin: false },
    comment_count: 42,
  },
]

export default function BoardPage() {
  const [currentPage, setCurrentPage] = useState(1)
  // 더미 로그인 상태 (나중에 실제 인증으로 교체)
  const isLoggedIn = false

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))

    if (hours < 24) {
      return `${hours}시간 전`
    }
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-black">
      {/* Header */}
      <header className="border-b-2 border-black sticky top-0 bg-[#FAFAF8] z-50">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3">
          <div className="flex justify-between items-center">
            <Link href="/home-b" className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-lg sm:text-xl font-black">OPEN RISK</span>
              <span className="text-[9px] sm:text-[10px] font-mono text-gray-500">BOARD</span>
            </Link>

            {/* 로그인 버튼 */}
            {isLoggedIn ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-xs sm:text-sm text-gray-600">닉네임</span>
                <button className="text-xs sm:text-sm text-gray-500 hover:text-black">
                  로그아웃
                </button>
              </div>
            ) : (
              <button className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 bg-[#FEE500] text-[#3C1E1E] text-xs sm:text-sm font-medium rounded hover:bg-[#FDD835] transition-colors">
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3C6.48 3 2 6.58 2 11c0 2.83 1.89 5.29 4.68 6.68-.15.53-.51 1.83-.59 2.11-.09.33.12.33.26.24.1-.07 1.62-1.07 2.28-1.5.45.07.91.1 1.37.1 5.52 0 10-3.58 10-8S17.52 3 12 3z"/>
                </svg>
                <span className="hidden xs:inline">카카오 </span>로그인
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* 페이지 타이틀 + 글쓰기 버튼 */}
        <div className="flex justify-between items-center mb-3 sm:mb-4">
          <h1 className="text-base sm:text-lg font-bold">게시판</h1>
          {isLoggedIn ? (
            <Link
              href="/board/write"
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-black text-white text-xs sm:text-sm font-bold hover:bg-gray-800 transition-colors"
            >
              글쓰기
            </Link>
          ) : (
            <button
              onClick={() => alert('로그인이 필요합니다.')}
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-200 text-gray-500 text-xs sm:text-sm font-bold cursor-not-allowed"
            >
              글쓰기
            </button>
          )}
        </div>

        {/* 게시글 목록 */}
        <div className="border-2 border-black bg-white">
          {/* 테이블 헤더 */}
          <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2 border-b-2 border-black bg-gray-50 text-[10px] font-mono text-gray-500">
            <div className="col-span-7">제목</div>
            <div className="col-span-2 text-center">작성자</div>
            <div className="col-span-1 text-center">조회</div>
            <div className="col-span-2 text-right">날짜</div>
          </div>

          {/* 게시글 목록 */}
          {DUMMY_POSTS.map((post) => (
            <Link
              key={post.id}
              href={`/board/${post.id}`}
              className="block border-b border-gray-200 last:border-b-0 hover:bg-gray-50 transition-colors"
            >
              {/* 모바일 레이아웃 */}
              <div className="sm:hidden px-3 py-2.5 active:bg-gray-100">
                <div className="flex items-center gap-1.5 mb-1">
                  {post.is_notice && (
                    <span className="px-1.5 py-0.5 bg-black text-white text-[8px] font-bold">
                      공지
                    </span>
                  )}
                  {post.author.is_admin && !post.is_notice && (
                    <span className="px-1.5 py-0.5 border border-black text-[8px]">
                      관리자
                    </span>
                  )}
                </div>
                <h3 className="font-medium text-[13px] line-clamp-2 mb-1 leading-snug">
                  {post.title}
                  {post.comment_count > 0 && (
                    <span className="ml-1 text-blue-500 text-[11px]">[{post.comment_count}]</span>
                  )}
                </h3>
                <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                  <span>{post.author.nickname}</span>
                  <span>·</span>
                  <span>조회 {post.view_count}</span>
                  <span>·</span>
                  <span>{formatDate(post.created_at)}</span>
                </div>
              </div>

              {/* 데스크톱 레이아웃 */}
              <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-3 items-center">
                <div className="col-span-7 flex items-center gap-2 min-w-0">
                  {post.is_notice && (
                    <span className="flex-shrink-0 px-1.5 py-0.5 bg-black text-white text-[9px] font-bold">
                      공지
                    </span>
                  )}
                  {post.author.is_admin && !post.is_notice && (
                    <span className="flex-shrink-0 px-1.5 py-0.5 border border-black text-[9px]">
                      관리자
                    </span>
                  )}
                  <span className="truncate text-sm">
                    {post.title}
                    {post.comment_count > 0 && (
                      <span className="ml-1 text-blue-500 text-xs">[{post.comment_count}]</span>
                    )}
                  </span>
                </div>
                <div className="col-span-2 text-center text-xs text-gray-600 truncate">
                  {post.author.nickname}
                </div>
                <div className="col-span-1 text-center text-xs text-gray-400">
                  {post.view_count}
                </div>
                <div className="col-span-2 text-right text-xs text-gray-400">
                  {formatDate(post.created_at)}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* 페이지네이션 */}
        <div className="flex justify-center items-center gap-0.5 sm:gap-1 mt-4 sm:mt-6">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-2 sm:px-3 py-1.5 border border-gray-300 text-xs sm:text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 active:bg-gray-200"
          >
            이전
          </button>
          {[1, 2, 3, 4, 5].map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`w-7 h-7 sm:w-8 sm:h-8 text-xs sm:text-sm font-medium ${
                currentPage === page
                  ? 'bg-black text-white'
                  : 'border border-gray-300 hover:bg-gray-100 active:bg-gray-200'
              }`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage((p) => p + 1)}
            className="px-2 sm:px-3 py-1.5 border border-gray-300 text-xs sm:text-sm hover:bg-gray-100 active:bg-gray-200"
          >
            다음
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-6 sm:mt-8">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex justify-between items-center text-[9px] sm:text-[10px] text-gray-500">
            <Link href="/home-b" className="font-bold text-black hover:underline">
              OPEN RISK
            </Link>
            <span>공공데이터 기반 상권 분석</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
