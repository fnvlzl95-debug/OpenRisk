'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AuthButton from '@/components/board/AuthButton'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { hasViewedPost, markPostAsViewed } from '@/lib/board/view-tracker'

interface Post {
  id: number
  title: string
  content: string
  is_notice: boolean
  view_count: number
  created_at: string
  updated_at: string
  author_id: string
  author_nickname: string
  author_profile_image: string | null
  author_is_admin: boolean
}

interface Comment {
  id: number
  content: string
  created_at: string
  author_id: string
  author_nickname: string
  author_profile_image: string | null
  author_is_admin: boolean
}

interface Profile {
  is_admin: boolean
}

export default function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentText, setCommentText] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  // 인증 상태 확인
  useEffect(() => {
    const supabase = createClient()

    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)

      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', session.user.id)
          .single()
        setProfile(profile)
      }
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', session.user.id)
            .single()
          setProfile(profile)
        } else {
          setProfile(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // 게시글 조회
  useEffect(() => {
    const fetchPost = async () => {
      setLoading(true)
      try {
        const postId = parseInt(id)
        const shouldIncrement = !hasViewedPost(postId)

        const res = await fetch(`/api/board/posts/${id}`, {
          headers: shouldIncrement ? { 'x-increment-view': 'true' } : {}
        })

        if (!res.ok) {
          throw new Error('게시글을 찾을 수 없습니다.')
        }

        const data = await res.json()
        setPost(data.post)
        setComments(data.comments || [])

        if (shouldIncrement) {
          markPostAsViewed(postId)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '게시글을 불러오는 데 실패했습니다.')
      } finally {
        setLoading(false)
      }
    }

    fetchPost()
  }, [id])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      alert('로그인이 필요합니다.')
      return
    }
    if (!commentText.trim()) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/board/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_id: parseInt(id),
          content: commentText.trim()
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '댓글 작성에 실패했습니다.')
      }

      setComments([...comments, data.comment])
      setCommentText('')
    } catch (err) {
      alert(err instanceof Error ? err.message : '댓글 작성에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeletePost = async () => {
    if (!confirm('정말 삭제하시겠습니까?')) return

    try {
      const res = await fetch(`/api/board/posts/${id}`, { method: 'DELETE' })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '삭제에 실패했습니다.')
      }

      router.push('/board')
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    }
  }

  const handleDeleteComment = async (commentId: number) => {
    if (!confirm('댓글을 삭제하시겠습니까?')) return

    try {
      const res = await fetch(`/api/board/comments/${commentId}`, { method: 'DELETE' })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '삭제에 실패했습니다.')
      }

      setComments(comments.filter(c => c.id !== commentId))
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    }
  }

  const canEditPost = user && post && (user.id === post.author_id || profile?.is_admin)
  const canDeleteComment = (comment: Comment) =>
    user && (user.id === comment.author_id || profile?.is_admin)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="text-gray-400">로딩 중...</div>
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex flex-col items-center justify-center gap-4">
        <div className="text-gray-500">{error || '게시글을 찾을 수 없습니다.'}</div>
        <Link href="/board" className="text-sm text-blue-500 hover:underline">
          목록으로 돌아가기
        </Link>
      </div>
    )
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
            <AuthButton />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* 뒤로가기 */}
        <Link
          href="/board"
          className="inline-flex items-center gap-1 text-xs sm:text-sm text-gray-500 hover:text-black mb-3 sm:mb-4"
        >
          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          목록으로
        </Link>

        {/* 게시글 */}
        <article className="border-2 border-black bg-white mb-4 sm:mb-6">
          {/* 헤더 */}
          <div className="px-3 sm:px-4 py-3 sm:py-4 border-b border-gray-200">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-2">
              {post.is_notice && (
                <span className="px-1.5 sm:px-2 py-0.5 bg-black text-white text-[9px] sm:text-[10px] font-bold">
                  공지
                </span>
              )}
              {post.author_is_admin && (
                <span className="px-1.5 sm:px-2 py-0.5 border border-black text-[9px] sm:text-[10px]">
                  관리자
                </span>
              )}
            </div>
            <h1 className="text-base sm:text-xl font-bold mb-2 sm:mb-3 leading-snug">{post.title}</h1>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0 text-[10px] sm:text-xs text-gray-500">
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="font-medium text-gray-700">{post.author_nickname}</span>
                <span className="hidden sm:inline">{formatDate(post.created_at)}</span>
                <span className="sm:hidden">{new Date(post.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
              </div>
              <span>조회 {post.view_count}</span>
            </div>
          </div>

          {/* 본문 */}
          <div className="px-3 sm:px-4 py-4 sm:py-6">
            <div className="prose prose-sm max-w-none">
              {post.content.split('\n').map((line, i) => {
                if (line.startsWith('## ')) {
                  return (
                    <h2 key={i} className="text-sm sm:text-base font-bold mt-3 sm:mt-4 mb-1.5 sm:mb-2">
                      {line.replace('## ', '')}
                    </h2>
                  )
                }
                if (line.startsWith('- **')) {
                  const match = line.match(/- \*\*(.+?)\*\*: (.+)/)
                  if (match) {
                    return (
                      <p key={i} className="my-0.5 sm:my-1 text-[13px] sm:text-sm">
                        <strong>{match[1]}</strong>: {match[2]}
                      </p>
                    )
                  }
                }
                if (line.trim() === '') {
                  return <br key={i} />
                }
                return (
                  <p key={i} className="my-0.5 sm:my-1 text-[13px] sm:text-sm leading-relaxed">
                    {line}
                  </p>
                )
              })}
            </div>
          </div>

          {/* 버튼 영역 */}
          {canEditPost && (
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={handleDeletePost}
                className="px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm text-red-500 hover:text-red-700 active:bg-red-50"
              >
                삭제
              </button>
            </div>
          )}
        </article>

        {/* 댓글 섹션 */}
        <section className="border-2 border-black bg-white">
          <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-gray-200">
            <h2 className="text-xs sm:text-sm font-bold">
              댓글 <span className="text-blue-500">{comments.length}</span>
            </h2>
          </div>

          {/* 댓글 목록 */}
          <div className="divide-y divide-gray-200">
            {comments.length === 0 ? (
              <div className="px-3 sm:px-4 py-6 text-center text-gray-400 text-sm">
                아직 댓글이 없습니다.
              </div>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="px-3 sm:px-4 py-3 sm:py-4">
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="font-medium text-xs sm:text-sm">{comment.author_nickname}</span>
                      {comment.author_is_admin && (
                        <span className="px-1 sm:px-1.5 py-0.5 border border-black text-[8px] sm:text-[9px]">
                          관리자
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] sm:text-[10px] text-gray-400">
                        {new Date(comment.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                      </span>
                      {canDeleteComment(comment) && (
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-[9px] sm:text-[10px] text-red-400 hover:text-red-600"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-[13px] sm:text-sm text-gray-700 leading-relaxed">{comment.content}</p>
                </div>
              ))
            )}
          </div>

          {/* 댓글 작성 */}
          <form onSubmit={handleCommentSubmit} className="border-t-2 border-black">
            <div className="px-3 sm:px-4 py-3">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={user ? '댓글을 작성하세요...' : '로그인 후 댓글을 작성할 수 있습니다.'}
                disabled={!user || submitting}
                maxLength={500}
                className="w-full h-16 sm:h-20 p-2.5 sm:p-3 border border-gray-300 text-[13px] sm:text-sm resize-none outline-none focus:border-black disabled:bg-gray-50 disabled:cursor-not-allowed"
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-[9px] sm:text-[10px] text-gray-400">
                  {commentText.length}/500
                </span>
                <button
                  type="submit"
                  disabled={!user || !commentText.trim() || submitting}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 bg-black text-white text-xs sm:text-sm font-bold disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-gray-800 active:bg-gray-900 transition-colors"
                >
                  {submitting ? '작성 중...' : '댓글 작성'}
                </button>
              </div>
            </div>
          </form>
        </section>
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
