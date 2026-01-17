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
 * Design A: 에디토리얼/신문 스타일 (홈페이지 컨셉 통일)
 * - #FAFAF8 배경
 * - 검은 테두리, 모노스페이스 라벨
 * - 공지사항 상단 고정
 * - 카드형 게시글 목록
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
      if (hours < 1) return '방금 전'
      return `${hours}시간 전`
    }
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

  const currentDate = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-black selection:bg-black/10">
      {/* Header - 신문 스타일 */}
      <header className="border-b-2 border-black sticky top-0 bg-[#FAFAF8] z-50">
        <div className="max-w-4xl mx-auto px-4 py-3">
          {/* Top bar */}
          <div className="flex justify-between items-center text-[10px] font-mono text-gray-500 mb-2">
            <span>{currentDate}</span>
            <span>COMMUNITY</span>
          </div>
          {/* Masthead */}
          <div className="flex justify-between items-center py-2 border-t border-b border-gray-300">
            <Link href="/home-b" className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">OPEN RISK</h1>
              <span className="text-[10px] font-mono text-gray-500 hidden sm:inline">커뮤니티</span>
            </Link>
            <AuthButton />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* 타이틀 + 글쓰기 */}
        <div className="flex justify-between items-end mb-6 border-b-2 border-black pb-4">
          <div>
            <span className="text-[10px] font-mono text-gray-400 block mb-1">BULLETIN BOARD</span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">자유게시판</h2>
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
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-1.5 h-1.5 bg-black rounded-full"></span>
              <span className="text-[10px] font-mono text-gray-500 tracking-wider">NOTICE</span>
            </div>
            <div className="border-2 border-black bg-white">
              {notices.map((post, idx) => (
                <Link
                  key={post.id}
                  href={`/board/${post.id}`}
                  className={`block px-4 py-3 hover:bg-gray-50 transition-colors ${idx !== notices.length - 1 ? 'border-b border-gray-200' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 bg-black text-white text-[9px] font-bold">공지</span>
                    <span className="font-medium flex-1 truncate">{post.title}</span>
                    <span className="text-xs text-gray-400 font-mono">{formatDate(post.created_at)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 게시글 목록 */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 border-2 border-black bg-white">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
            <p className="mt-4 text-sm text-gray-400 font-mono">LOADING...</p>
          </div>
        ) : regularPosts.length === 0 && notices.length === 0 ? (
          <div className="text-center py-20 border-2 border-black bg-white">
            <p className="text-gray-500 mb-2">아직 게시글이 없습니다</p>
            <p className="text-sm text-gray-400">첫 번째 글을 작성해보세요!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {regularPosts.map((post) => (
              <Link
                key={post.id}
                href={`/board/${post.id}`}
                className="block border-2 border-black bg-white hover:bg-gray-50 transition-colors group"
              >
                <div className="p-4">
                  {/* 상단: 제목 */}
                  <div className="flex items-start gap-2 mb-2">
                    {post.author_is_admin && (
                      <span className="flex-shrink-0 px-1.5 py-0.5 border border-black text-[9px] font-bold">관리자</span>
                    )}
                    <h3 className="font-semibold text-lg group-hover:underline flex-1 line-clamp-1">
                      {post.title}
                      {post.comment_count > 0 && (
                        <span className="ml-2 text-sm font-normal text-gray-500">[{post.comment_count}]</span>
                      )}
                    </h3>
                  </div>
                  {/* 본문 미리보기 */}
                  <p className="text-sm text-gray-500 line-clamp-1 mb-3">
                    {post.content.replace(/<[^>]*>/g, '').substring(0, 100)}
                  </p>
                  {/* 하단: 메타 정보 */}
                  <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-600">{post.author_nickname}</span>
                      <span>{formatDate(post.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span>조회 {post.view_count}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-1 mt-8">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 border-2 border-black text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black hover:text-white transition-colors"
            >
              이전
            </button>
            {pageNumbers.map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-10 h-10 text-sm font-bold border-2 transition-colors ${
                  currentPage === page
                    ? 'bg-black text-white border-black'
                    : 'border-gray-300 hover:border-black'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 border-2 border-black text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black hover:text-white transition-colors"
            >
              다음
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center text-xs text-gray-500">
            <Link href="/home-b" className="font-bold text-black">OPEN RISK</Link>
            <span>공공데이터 기반 상권 분석</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default function BoardPageDesignA() {
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
