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
 * Design F: 인덱스/목차 스타일
 * - 넘버링된 리스트
 * - 좌측 큰 숫자
 * - 미니멀한 정보 표시
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

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-black">
      {/* Header */}
      <header className="border-b-2 border-black sticky top-0 bg-[#FAFAF8] z-50">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link href="/home-b">
              <span className="text-2xl font-black tracking-tighter">OPEN RISK</span>
            </Link>
            <AuthButton />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-3xl mx-auto px-4 py-10">
        {/* 타이틀 */}
        <div className="mb-10">
          <div className="flex justify-between items-end">
            <div>
              <span className="text-[10px] font-mono text-gray-400 tracking-[0.3em]">INDEX</span>
              <h1 className="text-4xl font-black tracking-tight">자유게시판</h1>
            </div>
            <Link
              href={user ? "/board/write" : "/auth/login?next=/board/write"}
              className="px-4 py-2 border-2 border-black text-sm font-bold hover:bg-black hover:text-white transition-colors"
            >
              글쓰기
            </Link>
          </div>
          <div className="h-1 bg-black mt-4" />
        </div>

        {/* 공지사항 */}
        {notices.length > 0 && (
          <div className="mb-8">
            {notices.map((post) => (
              <Link
                key={post.id}
                href={`/board/${post.id}`}
                className="flex items-center gap-4 py-3 border-b border-gray-200 hover:bg-white transition-colors -mx-4 px-4"
              >
                <span className="w-12 h-12 bg-black text-white flex items-center justify-center text-[10px] font-bold">공지</span>
                <span className="font-semibold flex-1 truncate">{post.title}</span>
              </Link>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
          </div>
        ) : regularPosts.length === 0 && notices.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400">게시글이 없습니다</p>
          </div>
        ) : (
          <div>
            {regularPosts.map((post, idx) => {
              const num = String((currentPage - 1) * 10 + idx + 1).padStart(2, '0')
              return (
                <Link
                  key={post.id}
                  href={`/board/${post.id}`}
                  className="group flex gap-4 py-5 border-b border-gray-200 hover:bg-white transition-colors -mx-4 px-4"
                >
                  {/* 좌측: 번호 */}
                  <div className="w-12 flex-shrink-0">
                    <span className="text-3xl font-black text-gray-200 group-hover:text-black transition-colors font-mono">
                      {num}
                    </span>
                  </div>

                  {/* 우측: 콘텐츠 */}
                  <div className="flex-1 min-w-0 pt-1">
                    {/* 제목 */}
                    <div className="flex items-center gap-2 mb-1">
                      {post.author_is_admin && (
                        <span className="px-1.5 py-0.5 border border-black text-[8px] font-bold">관리자</span>
                      )}
                      <h3 className="font-semibold text-lg group-hover:underline truncate">
                        {post.title}
                      </h3>
                      {post.comment_count > 0 && (
                        <span className="text-gray-400 text-sm">[{post.comment_count}]</span>
                      )}
                    </div>

                    {/* 메타 */}
                    <div className="flex items-center gap-3 text-xs text-gray-400 font-mono">
                      <span>{post.author_nickname}</span>
                      <span>·</span>
                      <span>{formatDate(post.created_at)}</span>
                      <span>·</span>
                      <span>{post.view_count} views</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-10">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-10 h-10 border-2 border-black text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black hover:text-white transition-colors"
            >
              ←
            </button>
            <span className="px-4 font-mono text-sm">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="w-10 h-10 border-2 border-black text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black hover:text-white transition-colors"
            >
              →
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t-2 border-black mt-12">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center text-xs text-gray-500">
            <Link href="/home-b" className="font-black text-black">OPEN RISK</Link>
            <span className="font-mono">공공데이터 기반 상권 분석</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default function BoardPageDesignF() {
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
