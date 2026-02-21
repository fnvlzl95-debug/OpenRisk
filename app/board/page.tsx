'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import AuthButton from '@/components/board/AuthButton'

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

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

/**
 * 미니멀 리스트 디자인 (모바일 최적화)
 * - 깔끔한 타이포그래피 중심
 * - 시간순 타임라인 느낌
 * - 좌측 날짜 표시 (PC)
 * - 모바일 터치 최적화
 */
function BoardContent() {
  const [posts, setPosts] = useState<Post[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<{ id: string } | null>(null)

  useEffect(() => {
    const checkUser = async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    checkUser()
  }, [])

  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/board/posts?page=${currentPage}&type=open`)
        const data = await res.json()
        if (res.ok) {
          setPosts(data.posts || [])
          setPagination(data.pagination)
        }
      } catch (error) {
        console.error('Failed to fetch posts:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchPosts()
  }, [currentPage])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours < 24) {
      if (hours < 1) return '방금'
      return `${hours}h`
    }
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d`
    return date.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })
  }

  const formatFullDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
  }

  const totalPages = pagination?.totalPages || 1
  const pageNumbers = Array.from(
    { length: Math.min(5, totalPages) },
    (_, i) => {
      const start = Math.max(1, currentPage - 2)
      const end = Math.min(totalPages, start + 4)
      const adjustedStart = Math.max(1, end - 4)
      return adjustedStart + i
    }
  ).filter(p => p <= totalPages)

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-4xl lg:max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex justify-between items-center">
            <Link href="/home-b" className="group">
              <span className="text-lg sm:text-xl font-black tracking-tight text-gray-900 group-hover:text-gray-600 transition-colors">
                OPEN RISK
              </span>
            </Link>
            <AuthButton />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-4xl lg:max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 타이틀 영역 - 모바일에서 컴팩트하게 */}
        <div className="py-6 sm:py-12 border-b border-gray-100">
          <div className="flex justify-between items-center sm:items-start mb-4 sm:mb-6">
            <div>
              <p className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-widest mb-1 sm:mb-2">Community</p>
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">오픈톡</h1>
            </div>
            <Link
              href={user ? "/board/write" : "/auth/login?next=/board/write"}
              className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-gray-900 rounded-full hover:bg-gray-700 active:bg-gray-800 transition-colors"
            >
              글쓰기
            </Link>
          </div>

          {/* 탭 네비게이션 */}
          <div className="flex gap-2 sm:gap-4">
            <div className="px-4 py-2 text-sm font-bold text-gray-900 border-b-2 border-gray-900">
              오픈톡
            </div>
            <Link
              href="/board/info"
              className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
            >
              정보톡
            </Link>
          </div>
        </div>

        {/* 게시글 목록 */}
        {loading ? (
          <div className="py-16 sm:py-20 text-center">
            <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-400">불러오는 중...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="py-16 sm:py-20 text-center">
            <p className="text-gray-400 mb-1">아직 게시글이 없습니다</p>
            <p className="text-sm text-gray-300">첫 번째 글의 주인공이 되어보세요</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/board/${post.id}`}
                className="group block py-4 sm:py-5 lg:py-5 -mx-4 sm:-mx-2 px-4 sm:px-2 hover:bg-gray-50 active:bg-gray-100 transition-colors sm:rounded-lg"
              >
                <article className="flex gap-4 sm:gap-6 lg:gap-6">
                  {/* 좌측: 날짜 (PC only) */}
                  <div className="hidden md:block w-16 lg:w-18 flex-shrink-0 pt-0.5">
                    <time className="text-xs lg:text-sm font-mono text-gray-300 group-hover:text-gray-400 transition-colors">
                      {formatFullDate(post.created_at)}
                    </time>
                  </div>

                  {/* 우측: 콘텐츠 */}
                  <div className="flex-1 min-w-0">
                    {/* 뱃지 + 날짜 (모바일) */}
                    <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                      {post.is_notice && (
                        <span className="px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] lg:text-xs font-bold text-orange-600 bg-orange-50 rounded-full">
                          NOTICE
                        </span>
                      )}
                      {post.author_is_admin && !post.is_notice && (
                        <span className="px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] lg:text-xs font-medium text-blue-600 bg-blue-50 rounded-full">
                          ADMIN
                        </span>
                      )}
                      {/* 모바일에서 날짜 표시 */}
                      <span className="md:hidden text-[10px] text-gray-300">
                        {formatDate(post.created_at)}
                      </span>
                    </div>

                    {/* 제목 */}
                    <h2 className="text-base sm:text-lg lg:text-lg font-semibold text-gray-900 group-hover:text-gray-600 transition-colors mb-1 line-clamp-2 sm:line-clamp-1">
                      {post.title}
                      {post.comment_count > 0 && (
                        <span className="ml-1.5 sm:ml-2 text-xs sm:text-sm font-normal text-blue-500">
                          [{post.comment_count}]
                        </span>
                      )}
                    </h2>

                    {/* 본문 미리보기 */}
                    <p className="text-xs sm:text-sm lg:text-sm text-gray-400 line-clamp-1 mb-2 sm:mb-2">
                      {post.content
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/<[^>]*>/g, '')
                        .replace(/&amp;/g, '&')
                        .replace(/&quot;/g, '"')
                        .replace(/&#39;/g, "'")
                        .replace(/\n+/g, ' ')
                        .substring(0, 100)}
                    </p>

                    {/* 메타 정보 */}
                    <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-gray-400">
                      <span className="font-medium truncate max-w-[80px] sm:max-w-none">{post.author_nickname}</span>
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        {post.view_count}
                      </span>
                    </div>
                  </div>

                  {/* 모바일 화살표 인디케이터 */}
                  <div className="flex items-center sm:hidden">
                    <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-1 lg:gap-2 py-8 sm:py-12 border-t border-gray-100 mt-4 sm:mt-6">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 min-w-[44px] min-h-[44px] lg:min-w-[48px] lg:min-h-[48px] text-xs lg:text-sm text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed hover:text-gray-600 active:text-gray-800 transition-colors flex items-center justify-center"
            >
              ←
            </button>

            <div className="flex items-center gap-0.5 sm:gap-1 lg:gap-2 mx-2 sm:mx-4">
              {pageNumbers.map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`min-w-[40px] min-h-[40px] lg:min-w-[44px] lg:min-h-[44px] text-xs lg:text-sm font-medium rounded-full transition-all flex items-center justify-center ${
                    currentPage === page
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 min-w-[44px] min-h-[44px] lg:min-w-[48px] lg:min-h-[48px] text-xs lg:text-sm text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed hover:text-gray-600 active:text-gray-800 transition-colors flex items-center justify-center"
            >
              →
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 mt-auto">
        <div className="max-w-4xl lg:max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-4 text-[10px] sm:text-xs lg:text-sm text-gray-300">
            <Link href="/home-b" className="font-black text-gray-400 hover:text-gray-600 transition-colors">
              OPEN RISK
            </Link>
            <p>공공데이터 기반 상권 분석</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default function BoardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-400">불러오는 중...</p>
        </div>
      </div>
    }>
      <BoardContent />
    </Suspense>
  )
}
