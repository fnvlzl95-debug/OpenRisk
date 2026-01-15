'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AuthButton from '@/components/board/AuthButton'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { hasViewedPost, markPostAsViewed } from '@/lib/board/view-tracker'

// 커스텀 확인 모달
function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel
}: {
  isOpen: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* 배경 오버레이 */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />
      {/* 모달 */}
      <div className="relative bg-white border-2 border-black w-[280px] sm:w-[320px] mx-4">
        <div className="px-4 py-3 border-b-2 border-black">
          <h3 className="text-sm sm:text-base font-bold">{title}</h3>
        </div>
        <div className="px-4 py-4">
          <p className="text-xs sm:text-sm text-gray-600">{message}</p>
        </div>
        <div className="flex border-t-2 border-black">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-xs sm:text-sm font-medium hover:bg-gray-100 active:bg-gray-200 transition-colors border-r border-black"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 text-xs sm:text-sm font-bold text-white bg-black hover:bg-gray-800 active:bg-gray-900 transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}

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
  parent_id: number | null
  replies?: Comment[]
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
  const [replyingTo, setReplyingTo] = useState<number | null>(null)
  const [replyText, setReplyText] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} })
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null)
  const [editingCommentText, setEditingCommentText] = useState('')

  // 인증 상태 확인
  useEffect(() => {
    const supabase = createClient()

    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .single()
        setProfile(profile)
      }
    }

    loadUser()

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

        // Strict Mode 중복 방지: API 호출 전에 먼저 마킹
        if (shouldIncrement) {
          markPostAsViewed(postId)
        }

        const res = await fetch(`/api/board/posts/${id}`, {
          headers: shouldIncrement ? { 'x-increment-view': 'true' } : {}
        })

        if (!res.ok) {
          throw new Error('게시글을 찾을 수 없습니다.')
        }

        const data = await res.json()
        setPost(data.post)
        setComments(data.comments || [])
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

  // 댓글을 계층 구조로 정리
  const organizeComments = (flatComments: Comment[]): Comment[] => {
    const commentMap = new Map<number, Comment>()
    const rootComments: Comment[] = []

    // 먼저 모든 댓글을 맵에 저장
    flatComments.forEach(comment => {
      commentMap.set(comment.id, { ...comment, replies: [] })
    })

    // 부모-자식 관계 설정
    flatComments.forEach(comment => {
      const mappedComment = commentMap.get(comment.id)!
      if (comment.parent_id === null) {
        rootComments.push(mappedComment)
      } else {
        const parent = commentMap.get(comment.parent_id)
        if (parent) {
          parent.replies = parent.replies || []
          parent.replies.push(mappedComment)
        }
      }
    })

    return rootComments
  }

  const handleCommentSubmit = async (e: React.FormEvent, parentId?: number) => {
    e.preventDefault()
    if (!user) {
      alert('로그인이 필요합니다.')
      return
    }

    const content = parentId ? replyText : commentText
    if (!content.trim()) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/board/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_id: parseInt(id),
          content: content.trim(),
          parent_id: parentId || null
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '댓글 작성에 실패했습니다.')
      }

      setComments([...comments, data.comment])
      if (parentId) {
        setReplyText('')
        setReplyingTo(null)
      } else {
        setCommentText('')
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '댓글 작성에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeletePost = () => {
    setConfirmModal({
      isOpen: true,
      title: '게시글 삭제',
      message: '정말 삭제하시겠습니까? 삭제된 글은 복구할 수 없습니다.',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }))
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
    })
  }

  const handleDeleteComment = (commentId: number) => {
    setConfirmModal({
      isOpen: true,
      title: '댓글 삭제',
      message: '댓글을 삭제하시겠습니까?',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }))
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
    })
  }

  const handleEditComment = (comment: Comment) => {
    setEditingCommentId(comment.id)
    setEditingCommentText(comment.content)
  }

  const handleCancelEditComment = () => {
    setEditingCommentId(null)
    setEditingCommentText('')
  }

  const handleSaveComment = async (commentId: number) => {
    if (!editingCommentText.trim()) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/board/comments/${commentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editingCommentText.trim() })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '수정에 실패했습니다.')
      }

      setComments(comments.map(c => c.id === commentId ? data.comment : c))
      setEditingCommentId(null)
      setEditingCommentText('')
    } catch (err) {
      alert(err instanceof Error ? err.message : '수정에 실패했습니다.')
    } finally {
      setSubmitting(false)
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

  // 댓글 렌더링 함수 (부모/대댓글 공통)
  const renderComment = (comment: Comment, isReply: boolean = false) => {
    const isEditing = editingCommentId === comment.id

    return (
      <div key={comment.id} className={isReply ? "px-3 sm:px-4 py-2.5 sm:py-3 pl-6 sm:pl-8 border-b border-gray-100 last:border-b-0" : "px-3 sm:px-4 py-3 sm:py-4"}>
        <div className="flex items-center justify-between mb-1.5 sm:mb-2">
          <div className="flex items-center gap-1.5 sm:gap-2">
            {isReply && (
              <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            )}
            <span className={`font-medium ${isReply ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'}`}>{comment.author_nickname}</span>
            {comment.author_is_admin && (
              <span className={`px-1 ${isReply ? 'py-0.5 text-[7px] sm:text-[8px]' : 'sm:px-1.5 py-0.5 text-[8px] sm:text-[9px]'} border border-black`}>
                관리자
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`${isReply ? 'text-[8px] sm:text-[9px]' : 'text-[9px] sm:text-[10px]'} text-gray-400`}>
              {new Date(comment.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
            </span>
            {canDeleteComment(comment) && !isEditing && (
              <>
                <button
                  onClick={() => handleEditComment(comment)}
                  className={`${isReply ? 'text-[8px] sm:text-[9px]' : 'text-[9px] sm:text-[10px]'} text-gray-400 hover:text-gray-600`}
                >
                  수정
                </button>
                <button
                  onClick={() => handleDeleteComment(comment.id)}
                  className={`${isReply ? 'text-[8px] sm:text-[9px]' : 'text-[9px] sm:text-[10px]'} text-red-400 hover:text-red-600`}
                >
                  삭제
                </button>
              </>
            )}
          </div>
        </div>

        {isEditing ? (
          <div>
            <textarea
              value={editingCommentText}
              onChange={(e) => setEditingCommentText(e.target.value)}
              maxLength={500}
              className="w-full h-16 sm:h-20 p-2.5 sm:p-3 border border-gray-300 text-[13px] sm:text-sm resize-none outline-none focus:border-black"
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-[9px] sm:text-[10px] text-gray-400">
                {editingCommentText.length}/500
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handleCancelEditComment}
                  disabled={submitting}
                  className="px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm text-gray-500 hover:text-black border border-gray-300 hover:border-black transition-colors disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  onClick={() => handleSaveComment(comment.id)}
                  disabled={submitting || !editingCommentText.trim()}
                  className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-black text-white text-xs sm:text-sm font-bold disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-gray-800 active:bg-gray-900 transition-colors"
                >
                  {submitting ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className={`${isReply ? 'text-[12px] sm:text-[13px] text-gray-600 pl-5' : 'text-[13px] sm:text-sm text-gray-700'} leading-relaxed break-words whitespace-pre-wrap`}>{comment.content}</p>
        )}

        {/* 답글 버튼 (부모 댓글에만 표시) */}
        {!isReply && user && !isEditing && (
          <button
            onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
            className="mt-2 text-[10px] sm:text-xs text-gray-500 hover:text-black"
          >
            {replyingTo === comment.id ? '취소' : '답글'}
          </button>
        )}

        {/* 답글 입력 폼 */}
        {!isReply && replyingTo === comment.id && (
          <form onSubmit={(e) => handleCommentSubmit(e, comment.id)} className="mt-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="답글을 입력하세요..."
                maxLength={500}
                className="flex-1 px-2.5 py-1.5 border border-gray-300 text-xs sm:text-sm outline-none focus:border-black"
              />
              <button
                type="submit"
                disabled={!replyText.trim() || submitting}
                className="px-3 py-1.5 bg-black text-white text-xs font-bold disabled:bg-gray-300 hover:bg-gray-800"
              >
                {submitting ? '...' : '등록'}
              </button>
            </div>
          </form>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-black">
      {/* 확인 모달 */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />

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
              <Link
                href={`/board/${id}/edit`}
                className="px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm text-gray-600 hover:text-black active:bg-gray-50 border border-gray-300 hover:border-black transition-colors"
              >
                수정
              </Link>
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
              organizeComments(comments).map((comment) => (
                <div key={comment.id}>
                  {/* 부모 댓글 */}
                  {renderComment(comment, false)}

                  {/* 대댓글 목록 */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="bg-gray-50 border-t border-gray-100">
                      {comment.replies.map((reply) => renderComment(reply, true))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* 댓글 작성 */}
          <form onSubmit={(e) => handleCommentSubmit(e)} className="border-t-2 border-black">
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
