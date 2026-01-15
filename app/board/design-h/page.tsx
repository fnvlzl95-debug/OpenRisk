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
 * Design H: 아코디언/확장형 리스트
 * - 심플한 한 줄 리스트
 * - 호버 시 화살표 표시
 * - 극도로 미니멀
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
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d`
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
      {/* Header */}
      <header className="border-b-2 border-black">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex justify-between items-start">
            <div>
              <Link href="/home-b" className="block mb-4">
                <span className="text-3xl font-black tracking-tighter">OPEN RISK</span>
              </Link>
              <h1 className="text-lg font-bold">자유게시판</h1>
              <span className="text-[10px] font-mono text-gray-400">FREE BOARD</span>
            </div>
            <div className="flex flex-col items-end gap-3">
              <AuthButton />
              <Link
                href={user ? "/board/write" : "/auth/login?next=/board/write"}
                className="px-4 py-2 bg-black text-white text-sm font-bold hover:bg-gray-800 transition-colors"
              >
                글쓰기
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-2xl mx-auto">
        {/* 공지사항 */}
        {notices.length > 0 && (
          <div className="border-b-2 border-black">
            {notices.map((post) => (
              <Link
                key={post.id}
                href={`/board/${post.id}`}
                className="flex items-center justify-between px-4 py-4 bg-black text-white hover:bg-gray-900 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[9px] font-mono border border-white px-1.5 py-0.5 flex-shrink-0">공지</span>
                  <span className="font-medium truncate">{post.title}</span>
                </div>
                <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
          </div>
        ) : regularPosts.length === 0 && notices.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-sm">
            게시글이 없습니다
          </div>
        ) : (
          <div>
            {regularPosts.map((post) => (
              <Link
                key={post.id}
                href={`/board/${post.id}`}
                className="flex items-center justify-between px-4 py-4 border-b border-gray-200 hover:bg-white transition-colors group"
              >
                <div className="flex-1 min-w-0 mr-4">
                  {/* 첫 줄: 제목 */}
                  <div className="flex items-center gap-2 mb-1">
                    {post.is_notice && (
                      <span className="px-1.5 py-0.5 bg-black text-white text-[8px] font-bold flex-shrink-0">공지</span>
                    )}
                    {post.author_is_admin && !post.is_notice && (
                      <span className="px-1.5 py-0.5 border border-black text-[8px] font-bold flex-shrink-0">관리자</span>
                    )}
                    <h3 className="font-medium truncate">
                      {post.title}
                    </h3>
                    {post.comment_count > 0 && (
                      <span className="text-xs text-gray-400 flex-shrink-0">{post.comment_count}</span>
                    )}
                  </div>
                  {/* 둘째 줄: 메타 */}
                  <div className="flex items-center gap-2 text-[10px] text-gray-400 font-mono">
                    <span className="text-gray-500">{post.author_nickname}</span>
                    <span>·</span>
                    <span>{formatDate(post.created_at)}</span>
                    <span>·</span>
                    <span>{post.view_count}</span>
                  </div>
                </div>

                {/* 화살표 */}
                <svg className="w-4 h-4 text-gray-300 group-hover:text-black transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 py-8">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-8 h-8 border border-black text-xs disabled:opacity-30 hover:bg-black hover:text-white transition-colors"
            >
              ←
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
              className="w-8 h-8 border border-black text-xs disabled:opacity-30 hover:bg-black hover:text-white transition-colors"
            >
              →
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t-2 border-black mt-8">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center text-[10px] text-gray-400">
            <Link href="/home-b" className="font-black text-black text-sm">OPEN RISK</Link>
            <span className="font-mono">공공데이터 기반 상권 분석</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default function BoardPageDesignH() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
      </div>
    }>
      <BoardContent />
    </Suspense>
  )
}
