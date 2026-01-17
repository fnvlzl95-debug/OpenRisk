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
 * Design G: 스플릿 레이아웃
 * - 좌측 고정 사이드바
 * - 우측 콘텐츠 영역
 * - 모바일에서는 일반 레이아웃
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
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours < 24) {
      if (hours < 1) return '방금'
      return `${hours}h`
    }
    return date.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })
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
      {/* 모바일 헤더 */}
      <header className="md:hidden border-b-2 border-black sticky top-0 bg-[#FAFAF8] z-50">
        <div className="px-4 py-3 flex justify-between items-center">
          <Link href="/home-b">
            <span className="text-lg font-black">OPEN RISK</span>
          </Link>
          <AuthButton />
        </div>
      </header>

      <div className="flex">
        {/* 좌측 사이드바 - 데스크톱 */}
        <aside className="hidden md:flex flex-col w-64 min-h-screen border-r-2 border-black bg-[#FAFAF8] sticky top-0">
          <div className="p-6 border-b border-gray-200">
            <Link href="/home-b">
              <h1 className="text-2xl font-black tracking-tight">OPEN RISK</h1>
              <span className="text-[9px] font-mono text-gray-400">COMMUNITY</span>
            </Link>
          </div>

          <div className="p-6 flex-1">
            <h2 className="text-xl font-bold mb-2">자유게시판</h2>
            <p className="text-xs text-gray-500 mb-6">자유롭게 의견을 나눠보세요</p>

            <Link
              href={user ? "/board/write" : "/auth/login?next=/board/write"}
              className="block w-full py-3 bg-black text-white text-center text-sm font-bold hover:bg-gray-800 transition-colors"
            >
              글쓰기
            </Link>

            <div className="mt-8">
              <AuthButton />
            </div>
          </div>

          <div className="p-6 border-t border-gray-200 text-[10px] text-gray-400 font-mono">
            공공데이터 기반 상권 분석
          </div>
        </aside>

        {/* 우측 콘텐츠 */}
        <main className="flex-1 min-w-0">
          {/* 모바일 타이틀 */}
          <div className="md:hidden px-4 py-4 border-b border-gray-200 flex justify-between items-center">
            <h1 className="font-bold">자유게시판</h1>
            <Link
              href={user ? "/board/write" : "/auth/login?next=/board/write"}
              className="px-3 py-1.5 bg-black text-white text-xs font-bold"
            >
              글쓰기
            </Link>
          </div>

          {/* 공지사항 */}
          {notices.length > 0 && (
            <div className="border-b-2 border-black">
              {notices.map((post) => (
                <Link
                  key={post.id}
                  href={`/board/${post.id}`}
                  className="flex items-center gap-3 px-4 md:px-6 py-3 bg-black text-white hover:bg-gray-900 transition-colors"
                >
                  <span className="text-[9px] font-mono opacity-60">NOTICE</span>
                  <span className="font-medium truncate">{post.title}</span>
                </Link>
              ))}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
            </div>
          ) : regularPosts.length === 0 && notices.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              게시글이 없습니다
            </div>
          ) : (
            <div>
              {regularPosts.map((post) => (
                <Link
                  key={post.id}
                  href={`/board/${post.id}`}
                  className="block border-b border-gray-100 hover:bg-white transition-colors"
                >
                  <div className="px-4 md:px-6 py-4">
                    {/* 제목 */}
                    <div className="flex items-center gap-2 mb-2">
                      {post.author_is_admin && (
                        <span className="px-1.5 py-0.5 border border-black text-[8px] font-bold">관리자</span>
                      )}
                      <h3 className="font-semibold truncate flex-1">
                        {post.title}
                        {post.comment_count > 0 && (
                          <span className="text-gray-400 font-normal ml-1">[{post.comment_count}]</span>
                        )}
                      </h3>
                    </div>

                    {/* 본문 미리보기 */}
                    <p className="text-sm text-gray-500 line-clamp-1 mb-2">
                      {post.content.replace(/<[^>]*>/g, '').substring(0, 100)}
                    </p>

                    {/* 메타 */}
                    <div className="flex items-center gap-3 text-[10px] text-gray-400 font-mono">
                      <span className="text-gray-600">{post.author_nickname}</span>
                      <span>{formatDate(post.created_at)}</span>
                      <span>조회 {post.view_count}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-1 py-8 border-t border-gray-200">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 text-xs border border-black disabled:opacity-30 hover:bg-black hover:text-white transition-colors"
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
                className="px-3 py-2 text-xs border border-black disabled:opacity-30 hover:bg-black hover:text-white transition-colors"
              >
                다음
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default function BoardPageDesignG() {
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
