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
 * Design E: 타임라인 스타일 (홈페이지 컨셉)
 * - 좌측 날짜/시간 표시
 * - 수직 타임라인 라인
 * - 깔끔한 리스트
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
    return {
      date: date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
      time: date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
    }
  }

  const formatRelative = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours < 1) return '방금'
    if (hours < 24) return `${hours}시간 전`
    return formatDate(dateString).date
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

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-black">
      {/* Header */}
      <header className="border-b-2 border-black sticky top-0 bg-[#FAFAF8] z-50">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <Link href="/home-b">
              <span className="text-xl font-black tracking-tight">OPEN RISK</span>
            </Link>
            <AuthButton />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* 타이틀 */}
        <div className="flex justify-between items-center mb-8 pb-4 border-b-2 border-black">
          <div>
            <h1 className="text-2xl font-black tracking-tight">자유게시판</h1>
            <span className="text-[10px] font-mono text-gray-400">COMMUNITY TIMELINE</span>
          </div>
          <Link
            href={user ? "/board/write" : "/auth/login?next=/board/write"}
            className="px-4 py-2 bg-black text-white text-sm font-bold hover:bg-gray-800 transition-colors"
          >
            글쓰기
          </Link>
        </div>

        {/* 공지사항 */}
        {notices.length > 0 && (
          <div className="mb-8 bg-black text-white p-4">
            <span className="text-[10px] font-mono text-gray-400 mb-2 block">NOTICE</span>
            {notices.map((post) => (
              <Link
                key={post.id}
                href={`/board/${post.id}`}
                className="block hover:underline font-medium"
              >
                {post.title}
              </Link>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
            <p className="mt-4 text-xs text-gray-400 font-mono">LOADING...</p>
          </div>
        ) : regularPosts.length === 0 && notices.length === 0 ? (
          <div className="text-center py-20 border-2 border-black bg-white">
            <p className="text-gray-500 mb-2">아직 게시글이 없습니다</p>
            <p className="text-sm text-gray-400">첫 번째 글을 작성해보세요!</p>
          </div>
        ) : (
          <div className="relative">
            {/* 타임라인 라인 */}
            <div className="absolute left-[52px] top-0 bottom-0 w-px bg-gray-200 hidden sm:block" />

            {/* 게시글 목록 */}
            <div className="space-y-0">
              {regularPosts.map((post, idx) => {
                const dateInfo = formatDate(post.created_at)
                return (
                  <Link
                    key={post.id}
                    href={`/board/${post.id}`}
                    className="block group"
                  >
                    <div className="flex gap-4 py-4 border-b border-gray-100 hover:bg-white transition-colors -mx-4 px-4">
                      {/* 좌측: 날짜 */}
                      <div className="hidden sm:flex flex-col items-end w-12 flex-shrink-0 pt-1">
                        <span className="text-[10px] font-mono text-gray-400">{dateInfo.date}</span>
                        <span className="text-[9px] font-mono text-gray-300">{dateInfo.time}</span>
                      </div>

                      {/* 타임라인 점 */}
                      <div className="hidden sm:flex items-start pt-2">
                        <div className="w-2 h-2 bg-black rounded-full relative z-10" />
                      </div>

                      {/* 우측: 콘텐츠 */}
                      <div className="flex-1 min-w-0">
                        {/* 뱃지 + 제목 */}
                        <div className="flex items-start gap-2 mb-1">
                          {post.author_is_admin && (
                            <span className="flex-shrink-0 px-1.5 py-0.5 border border-black text-[8px] font-bold">관리자</span>
                          )}
                          <h3 className="font-semibold group-hover:underline line-clamp-1 flex-1">
                            {post.title}
                            {post.comment_count > 0 && (
                              <span className="text-gray-400 font-normal ml-1">[{post.comment_count}]</span>
                            )}
                          </h3>
                        </div>

                        {/* 본문 미리보기 */}
                        <p className="text-sm text-gray-500 line-clamp-1 mb-2">
                          {post.content.replace(/<[^>]*>/g, '').substring(0, 80)}
                        </p>

                        {/* 메타 정보 */}
                        <div className="flex items-center gap-3 text-[10px] text-gray-400">
                          <span className="font-medium text-gray-600">{post.author_nickname}</span>
                          <span className="sm:hidden">{formatRelative(post.created_at)}</span>
                          <span>조회 {post.view_count}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-1 mt-8 pt-4 border-t border-gray-200">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 text-xs border border-black disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black hover:text-white transition-colors"
            >
              이전
            </button>
            {pageNumbers.map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 text-xs font-medium transition-colors ${
                  currentPage === page
                    ? 'bg-black text-white'
                    : 'border border-gray-300 hover:border-black'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 text-xs border border-black disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black hover:text-white transition-colors"
            >
              다음
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-8">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center text-[10px] text-gray-400">
            <Link href="/home-b" className="font-bold text-black">OPEN RISK</Link>
            <span>공공데이터 기반 상권 분석</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default function BoardPageDesignE() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
      </div>
    }>
      <BoardContent />
    </Suspense>
  )
}
