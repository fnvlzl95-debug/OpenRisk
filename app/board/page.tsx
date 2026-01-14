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

function BoardContent() {
  const [posts, setPosts] = useState<Post[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<{ id: string } | null>(null)

  // 로그인 상태 확인
  useEffect(() => {
    const checkUser = async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    checkUser()
  }, [])


  // 게시글 목록 조회
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

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-black">
      {/* Header */}
      <header className="border-b-2 border-black sticky top-0 bg-[#FAFAF8] z-50">
        <div className="max-w-3xl mx-auto px-3 sm:px-4 py-2 sm:py-3">
          <div className="flex justify-between items-center gap-2">
            <Link href="/home-b" className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <span className="text-base sm:text-xl font-black">OPEN RISK</span>
              <span className="text-[8px] sm:text-[10px] font-mono text-gray-500">커뮤니티</span>
            </Link>
            <AuthButton />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* 페이지 타이틀 + 글쓰기 버튼 */}
        <div className="flex justify-between items-center mb-3 sm:mb-4">
          <h1 className="text-base sm:text-lg font-bold">자유게시판</h1>
          {user ? (
            <Link
              href="/board/write"
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-black text-white text-xs sm:text-sm font-bold hover:bg-gray-800 transition-colors"
            >
              글쓰기
            </Link>
          ) : (
            <Link
              href="/auth/login?next=/board/write"
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-black text-white text-xs sm:text-sm font-bold hover:bg-gray-800 transition-colors"
            >
              글쓰기
            </Link>
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

          {/* 로딩 상태 */}
          {loading ? (
            <div className="px-4 py-12 text-center text-gray-400 text-sm">
              게시글을 불러오는 중...
            </div>
          ) : posts.length === 0 ? (
            <div className="px-4 py-12 text-center text-gray-400 text-sm">
              게시글이 없습니다. 첫 번째 글을 작성해보세요!
            </div>
          ) : (
            posts.map((post) => (
              <Link
                key={post.id}
                href={`/board/${post.id}`}
                className="block border-b border-gray-200 last:border-b-0 hover:bg-gray-50 transition-colors"
              >
                {/* 모바일 레이아웃 */}
                <div className="sm:hidden px-3 py-2 active:bg-gray-100">
                  <div className="flex items-start gap-1.5">
                    {/* 뱃지 */}
                    {(post.is_notice || post.author_is_admin) && (
                      <div className="flex-shrink-0 pt-0.5">
                        {post.is_notice ? (
                          <span className="px-1 py-0.5 bg-black text-white text-[8px] font-bold leading-none">
                            공지
                          </span>
                        ) : (
                          <span className="px-1 py-0.5 border border-black text-[8px] leading-none">
                            관리자
                          </span>
                        )}
                      </div>
                    )}
                    {/* 제목 + 메타 */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-[13px] line-clamp-1 leading-tight">
                        {post.title}
                        {post.comment_count > 0 && (
                          <span className="ml-1 text-blue-500 text-[11px]">[{post.comment_count}]</span>
                        )}
                      </h3>
                      <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5">
                        <span className="truncate max-w-[60px]">{post.author_nickname}</span>
                        <span>·</span>
                        <span>{post.view_count}</span>
                        <span>·</span>
                        <span>{formatDate(post.created_at)}</span>
                      </div>
                    </div>
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
                    {post.author_is_admin && !post.is_notice && (
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
                    {post.author_nickname}
                  </div>
                  <div className="col-span-1 text-center text-xs text-gray-400">
                    {post.view_count}
                  </div>
                  <div className="col-span-2 text-right text-xs text-gray-400">
                    {formatDate(post.created_at)}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-0.5 sm:gap-1 mt-4 sm:mt-6">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2 sm:px-3 py-1.5 border border-gray-300 text-xs sm:text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 active:bg-gray-200"
            >
              이전
            </button>
            {pageNumbers.map((page) => (
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
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2 sm:px-3 py-1.5 border border-gray-300 text-xs sm:text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 active:bg-gray-200"
            >
              다음
            </button>
          </div>
        )}
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

export default function BoardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="text-gray-400">로딩 중...</div>
      </div>
    }>
      <BoardContent />
    </Suspense>
  )
}
