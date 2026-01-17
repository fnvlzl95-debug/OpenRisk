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
 * Design C: 컴팩트 테이블 스타일 (홈페이지 컨셉)
 * - 기존 테이블 레이아웃 유지하되 더 세련되게
 * - 행 호버 효과
 * - 공지사항 상단 하이라이트
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
      {/* Header */}
      <header className="border-b-2 border-black sticky top-0 bg-[#FAFAF8] z-50">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <Link href="/home-b" className="flex items-center gap-2">
              <span className="text-lg font-black">OPEN RISK</span>
              <span className="text-[9px] font-mono text-gray-400 border border-gray-300 px-1.5 py-0.5">COMMUNITY</span>
            </Link>
            <AuthButton />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* 타이틀 바 */}
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-300">
          <h1 className="text-lg font-bold">자유게시판</h1>
          <Link
            href={user ? "/board/write" : "/auth/login?next=/board/write"}
            className="px-3 py-1.5 bg-black text-white text-xs font-bold hover:bg-gray-800 transition-colors"
          >
            글쓰기
          </Link>
        </div>

        {/* 테이블 */}
        <div className="border-2 border-black bg-white">
          {/* 테이블 헤더 */}
          <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2 bg-black text-white text-[10px] font-mono">
            <div className="col-span-7">TITLE</div>
            <div className="col-span-2 text-center">AUTHOR</div>
            <div className="col-span-1 text-center">VIEW</div>
            <div className="col-span-2 text-right">DATE</div>
          </div>

          {loading ? (
            <div className="px-4 py-16 text-center">
              <div className="w-5 h-5 border-2 border-gray-300 border-t-black rounded-full animate-spin mx-auto" />
              <p className="mt-3 text-xs text-gray-400 font-mono">LOADING...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="px-4 py-16 text-center text-gray-400 text-sm">
              게시글이 없습니다
            </div>
          ) : (
            <>
              {/* 공지사항 */}
              {notices.map((post) => (
                <Link
                  key={post.id}
                  href={`/board/${post.id}`}
                  className="block border-b border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  {/* 모바일 */}
                  <div className="sm:hidden px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 bg-black text-white text-[8px] font-bold">공지</span>
                      <span className="font-medium text-sm truncate flex-1">{post.title}</span>
                    </div>
                  </div>
                  {/* 데스크톱 */}
                  <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2.5 items-center">
                    <div className="col-span-7 flex items-center gap-2">
                      <span className="px-1.5 py-0.5 bg-black text-white text-[9px] font-bold">공지</span>
                      <span className="font-medium truncate">{post.title}</span>
                    </div>
                    <div className="col-span-2 text-center text-xs text-gray-500 truncate">{post.author_nickname}</div>
                    <div className="col-span-1 text-center text-xs text-gray-400">{post.view_count}</div>
                    <div className="col-span-2 text-right text-xs text-gray-400 font-mono">{formatDate(post.created_at)}</div>
                  </div>
                </Link>
              ))}

              {/* 일반 게시글 */}
              {regularPosts.map((post) => (
                <Link
                  key={post.id}
                  href={`/board/${post.id}`}
                  className="block border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors"
                >
                  {/* 모바일 */}
                  <div className="sm:hidden px-3 py-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      {post.author_is_admin && (
                        <span className="px-1 py-0.5 border border-black text-[8px]">관리자</span>
                      )}
                      <h3 className="font-medium text-sm truncate flex-1">
                        {post.title}
                        {post.comment_count > 0 && (
                          <span className="text-gray-400 ml-1">[{post.comment_count}]</span>
                        )}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                      <span>{post.author_nickname}</span>
                      <span>·</span>
                      <span>{post.view_count}</span>
                      <span>·</span>
                      <span>{formatDate(post.created_at)}</span>
                    </div>
                  </div>
                  {/* 데스크톱 */}
                  <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2.5 items-center">
                    <div className="col-span-7 flex items-center gap-2 min-w-0">
                      {post.author_is_admin && (
                        <span className="flex-shrink-0 px-1.5 py-0.5 border border-black text-[9px]">관리자</span>
                      )}
                      <span className="truncate">
                        {post.title}
                        {post.comment_count > 0 && (
                          <span className="text-gray-400 ml-1 text-sm">[{post.comment_count}]</span>
                        )}
                      </span>
                    </div>
                    <div className="col-span-2 text-center text-xs text-gray-500 truncate">{post.author_nickname}</div>
                    <div className="col-span-1 text-center text-xs text-gray-400">{post.view_count}</div>
                    <div className="col-span-2 text-right text-xs text-gray-400 font-mono">{formatDate(post.created_at)}</div>
                  </div>
                </Link>
              ))}
            </>
          )}
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-1 mt-6">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2 py-1.5 text-xs border border-black disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black hover:text-white transition-colors"
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
              className="px-2 py-1.5 text-xs border border-black disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black hover:text-white transition-colors"
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

export default function BoardPageDesignC() {
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
