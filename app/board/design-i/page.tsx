'use client'

import { useState, useEffect, Suspense, useRef } from 'react'
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
 * Design I: 2025 최신 UX 트렌드
 * - Bento Grid 느낌의 공지사항
 * - Glassmorphism 헤더
 * - Micro-interactions (호버, 클릭 피드백)
 * - Skeleton loading
 * - Floating Action Button
 * - 부드러운 스크롤 애니메이션
 * - 반응형 최적화
 */
function BoardContent() {
  const [posts, setPosts] = useState<Post[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const mainRef = useRef<HTMLElement>(null)

  // 스크롤 감지
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

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
        const res = await fetch(`/api/board/posts?page=${currentPage}`)
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
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))

    if (minutes < 1) return '방금'
    if (minutes < 60) return `${minutes}분 전`
    if (hours < 24) return `${hours}시간 전`
    if (hours < 48) return '어제'
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

  const notices = posts.filter(p => p.is_notice)
  const regularPosts = posts.filter(p => !p.is_notice)

  // Skeleton 로더
  const SkeletonCard = () => (
    <div className="p-4 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-16 h-4 bg-gray-200 rounded-full" />
        <div className="w-20 h-3 bg-gray-100 rounded-full" />
      </div>
      <div className="w-full h-5 bg-gray-200 rounded-lg mb-2" />
      <div className="w-3/4 h-4 bg-gray-100 rounded-lg mb-3" />
      <div className="flex gap-3">
        <div className="w-12 h-3 bg-gray-100 rounded-full" />
        <div className="w-12 h-3 bg-gray-100 rounded-full" />
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-black">
      {/* Glassmorphism Header */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-[#FAFAF8]/80 backdrop-blur-xl border-b border-gray-200/50 shadow-sm'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <Link
              href="/home-b"
              className="flex items-center gap-2 group"
            >
              <span className="text-lg font-black tracking-tight group-hover:tracking-normal transition-all duration-300">
                OPEN RISK
              </span>
              <span className={`text-[9px] font-mono text-gray-400 transition-all duration-300 ${
                scrolled ? 'opacity-0 w-0' : 'opacity-100'
              }`}>
                커뮤니티
              </span>
            </Link>
            <AuthButton />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="pt-16 pb-6 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="py-8">
            <span className="inline-block px-2 py-1 bg-black text-white text-[10px] font-mono mb-3 rounded-sm">
              COMMUNITY
            </span>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">
              자유게시판
            </h1>
            <p className="text-gray-500 text-sm">
              자유롭게 의견을 나누고 정보를 공유하세요
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main ref={mainRef} className="max-w-3xl mx-auto px-4 pb-24">
        {/* 공지사항 - Bento 스타일 */}
        {notices.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-mono text-gray-400 tracking-wider">PINNED</span>
            </div>
            <div className="grid gap-2">
              {notices.map((post) => (
                <Link
                  key={post.id}
                  href={`/board/${post.id}`}
                  className="group relative overflow-hidden bg-gradient-to-br from-gray-900 to-black text-white p-4 rounded-2xl hover:scale-[1.01] active:scale-[0.99] transition-all duration-200"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex-shrink-0 w-6 h-6 bg-white/10 rounded-lg flex items-center justify-center">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
                        </svg>
                      </span>
                      <span className="font-medium truncate">{post.title}</span>
                    </div>
                    <svg className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 게시글 목록 */}
        <div className="bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-sm">
          {/* 리스트 헤더 */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-[11px] font-mono text-gray-400">
              {pagination ? `총 ${pagination.total}개의 글` : '로딩 중...'}
            </span>
            <div className="flex items-center gap-1">
              <button className="px-2 py-1 text-[10px] font-medium text-gray-500 hover:text-black hover:bg-gray-100 rounded-md transition-colors">
                최신순
              </button>
              <button className="px-2 py-1 text-[10px] font-medium text-gray-400 hover:text-black hover:bg-gray-100 rounded-md transition-colors">
                인기순
              </button>
            </div>
          </div>

          {/* 로딩 스켈레톤 */}
          {loading ? (
            <div className="divide-y divide-gray-100">
              {[1, 2, 3, 4, 5].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : regularPosts.length === 0 && notices.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              </div>
              <p className="text-gray-500 mb-1">아직 게시글이 없어요</p>
              <p className="text-sm text-gray-400">첫 번째 글을 작성해보세요!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {regularPosts.map((post, idx) => (
                <Link
                  key={post.id}
                  href={`/board/${post.id}`}
                  className="block p-4 hover:bg-gray-50/80 active:bg-gray-100 transition-colors group"
                  style={{
                    animationDelay: `${idx * 50}ms`,
                    animation: 'fadeInUp 0.4s ease-out forwards'
                  }}
                >
                  {/* 메타 정보 */}
                  <div className="flex items-center gap-2 mb-2">
                    {post.author_is_admin && (
                      <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-semibold rounded-md">
                        관리자
                      </span>
                    )}
                    <span className="text-xs text-gray-500 font-medium">{post.author_nickname}</span>
                    <span className="text-gray-300">·</span>
                    <span className="text-xs text-gray-400">{formatDate(post.created_at)}</span>
                  </div>

                  {/* 제목 */}
                  <h3 className="font-semibold text-[15px] mb-1.5 group-hover:text-gray-600 transition-colors line-clamp-1">
                    {post.title}
                  </h3>

                  {/* 본문 미리보기 */}
                  <p className="text-sm text-gray-500 line-clamp-2 mb-3 leading-relaxed">
                    {post.content.replace(/<[^>]*>/g, '').substring(0, 120)}
                  </p>

                  {/* 하단 통계 */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span>{post.view_count}</span>
                    </div>
                    {post.comment_count > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span>{post.comment_count}</span>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-1 mt-6">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 active:scale-95 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            {pageNumbers.map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-9 h-9 rounded-xl text-sm font-medium transition-all active:scale-95 ${
                  currentPage === page
                    ? 'bg-black text-white shadow-lg shadow-black/20'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 active:scale-95 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </main>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <Link
          href={user ? "/board/write" : "/auth/login?next=/board/write"}
          className="flex items-center gap-2 px-5 py-3 bg-black text-white rounded-full shadow-xl shadow-black/30 hover:shadow-2xl hover:shadow-black/40 hover:scale-105 active:scale-95 transition-all duration-200 group"
        >
          <svg className="w-4 h-4 group-hover:rotate-90 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-sm font-semibold">글쓰기</span>
        </Link>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white/50">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center text-xs text-gray-400">
            <Link href="/home-b" className="font-bold text-black hover:text-gray-600 transition-colors">
              OPEN RISK
            </Link>
            <span className="font-mono">공공데이터 기반 상권 분석</span>
          </div>
        </div>
      </footer>

      {/* 애니메이션 스타일 */}
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}

export default function BoardPageDesignI() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
          <span className="text-xs text-gray-400 font-mono">로딩 중...</span>
        </div>
      </div>
    }>
      <BoardContent />
    </Suspense>
  )
}
