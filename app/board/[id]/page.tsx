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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <div className="text-gray-500">{error || '게시글을 찾을 수 없습니다.'}</div>
        <Link href="/board" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
          목록으로 돌아가기
        </Link>
      </div>
    )
  }

  // 댓글 렌더링 함수 (부모/대댓글 공통)
  const renderComment = (comment: Comment, isReply: boolean = false) => {
    const isEditing = editingCommentId === comment.id

    return (
      <div key={comment.id} className={`${isReply ? 'bg-gray-50 rounded-xl p-3 sm:p-4' : 'py-3 sm:py-4'}`}>
        <div className="flex items-start justify-between mb-2 sm:mb-3 gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0 flex-1">
            {isReply && (
              <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold text-gray-600 bg-gray-200 rounded flex-shrink-0">
                ↳ 답글
              </span>
            )}
            <span className="text-sm sm:text-base font-bold text-gray-900 truncate">{comment.author_nickname}</span>
            {comment.author_is_admin && (
              <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold text-blue-600 bg-blue-50 rounded flex-shrink-0">
                ADMIN
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <time className="text-xs sm:text-sm text-gray-400">
              {new Date(comment.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
            </time>
            {canDeleteComment(comment) && !isEditing && (
              <>
                <button
                  onClick={() => handleEditComment(comment)}
                  className="text-xs sm:text-sm text-gray-500 hover:text-gray-900 active:text-gray-700 transition-colors font-medium min-h-[32px] px-1"
                >
                  수정
                </button>
                <button
                  onClick={() => handleDeleteComment(comment.id)}
                  className="text-xs sm:text-sm text-red-500 hover:text-red-700 active:text-red-600 transition-colors font-medium min-h-[32px] px-1"
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
              className="w-full h-24 sm:h-28 px-3 sm:px-4 py-2 sm:py-3 bg-white border-2 border-gray-200 rounded-xl text-[15px] sm:text-base leading-relaxed resize-none outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100 transition-all"
            />
            <div className="flex justify-between items-center mt-2 sm:mt-3">
              <span className="text-xs sm:text-sm text-gray-400">
                {editingCommentText.length}/500
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handleCancelEditComment}
                  disabled={submitting}
                  className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-gray-600 hover:text-gray-900 active:text-gray-700 transition-colors disabled:opacity-50 min-h-[44px]"
                >
                  취소
                </button>
                <button
                  onClick={() => handleSaveComment(comment.id)}
                  disabled={submitting || !editingCommentText.trim()}
                  className="px-4 sm:px-5 py-2 bg-gray-900 text-white text-xs sm:text-sm font-semibold rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-gray-700 active:scale-95 transition-all min-h-[44px]"
                >
                  {submitting ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-[15px] sm:text-base text-gray-700 leading-relaxed break-words whitespace-pre-wrap">{comment.content}</p>
        )}

        {/* 답글 버튼 (부모 댓글에만 표시) */}
        {!isReply && user && !isEditing && (
          <button
            onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
            className="mt-3 sm:mt-4 px-3 py-2 text-xs sm:text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-lg transition-all flex items-center gap-1.5 min-h-[40px]"
          >
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            {replyingTo === comment.id ? '취소' : '답글 달기'}
          </button>
        )}

        {/* 답글 입력 폼 */}
        {!isReply && replyingTo === comment.id && (
          <form onSubmit={(e) => handleCommentSubmit(e, comment.id)} className="mt-3 sm:mt-4 bg-white rounded-xl border-2 border-gray-200 p-2 sm:p-3 flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="답글을 입력하세요..."
              maxLength={500}
              className="flex-1 px-3 py-2 text-[15px] sm:text-base outline-none min-h-[44px]"
            />
            <button
              type="submit"
              disabled={!replyText.trim() || submitting}
              className="px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-lg disabled:bg-gray-300 hover:bg-gray-700 active:scale-95 transition-all min-h-[44px]"
            >
              {submitting ? '...' : '등록'}
            </button>
          </form>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white text-black">
      {/* 확인 모달 */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-3xl lg:max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex justify-between items-center">
            <Link href="/home-b" className="group">
              <span className="text-lg sm:text-xl font-black tracking-tight text-gray-900 group-hover:text-gray-600 transition-colors">
                OPEN RISK
              </span>
            </Link>
            <AuthButton />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-3xl lg:max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* 뒤로가기 */}
        <Link
          href="/board"
          className="inline-flex items-center gap-1.5 min-h-[44px] text-sm text-gray-500 hover:text-gray-900 transition-colors mb-4 sm:mb-6 active:scale-95"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-medium">목록으로</span>
        </Link>

        {/* 게시글 */}
        <article className="mb-8 sm:mb-12">
          {/* 헤더 */}
          <div className="mb-6 sm:mb-8">
            {/* 뱃지 */}
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              {post.is_notice && (
                <span className="px-2 py-1 text-[10px] sm:text-xs font-bold text-orange-600 bg-orange-50 rounded">
                  NOTICE
                </span>
              )}
              {post.author_is_admin && !post.is_notice && (
                <span className="px-2 py-1 text-[10px] sm:text-xs font-bold text-blue-600 bg-blue-50 rounded">
                  ADMIN
                </span>
              )}
            </div>

            {/* 제목 */}
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-4 sm:mb-5 leading-tight break-words">
              {post.title}
            </h1>

            {/* 메타 정보 */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-500">
              <span className="font-semibold text-gray-900">{post.author_nickname}</span>
              <span className="hidden sm:inline">·</span>
              <time className="text-xs sm:text-sm">
                {new Date(post.created_at).toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </time>
              <span className="hidden sm:inline">·</span>
              <span className="flex items-center gap-1 text-xs sm:text-sm">
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                {post.view_count}
              </span>
            </div>
          </div>

          {/* 본문 */}
          <div className="bg-gray-50 rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8">
            <div className="prose prose-gray max-w-none">
              <div className="text-[15px] sm:text-base lg:text-lg leading-relaxed text-gray-800 space-y-3 sm:space-y-4 break-words">
                {post.content.split('\n').map((line, i) => {
                  if (line.startsWith('## ')) {
                    return (
                      <h2 key={i} className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mt-6 sm:mt-8 mb-3 sm:mb-4 leading-tight">
                        {line.replace('## ', '')}
                      </h2>
                    )
                  }
                  if (line.startsWith('- **')) {
                    const match = line.match(/- \*\*(.+?)\*\*: (.+)/)
                    if (match) {
                      return (
                        <p key={i} className="my-2 sm:my-3 leading-relaxed">
                          <strong className="font-bold text-gray-900">{match[1]}</strong>: {match[2]}
                        </p>
                      )
                    }
                  }
                  if (line.trim() === '') {
                    return <div key={i} className="h-3 sm:h-4" />
                  }
                  return (
                    <p key={i} className="leading-relaxed text-gray-700">
                      {line}
                    </p>
                  )
                })}
              </div>
            </div>
          </div>

          {/* 버튼 영역 */}
          {canEditPost && (
            <div className="flex gap-2 sm:gap-3">
              <Link
                href={`/board/${id}/edit`}
                className="flex-1 sm:flex-none px-4 sm:px-5 py-3 sm:py-2.5 text-sm font-semibold text-center text-gray-700 bg-white border-2 border-gray-200 hover:border-gray-300 active:bg-gray-50 rounded-lg transition-all min-h-[44px] flex items-center justify-center"
              >
                수정
              </Link>
              <button
                onClick={handleDeletePost}
                className="flex-1 sm:flex-none px-4 sm:px-5 py-3 sm:py-2.5 text-sm font-semibold text-red-600 bg-white border-2 border-red-200 hover:border-red-300 active:bg-red-50 rounded-lg transition-all min-h-[44px]"
              >
                삭제
              </button>
            </div>
          )}
        </article>

        {/* 댓글 섹션 */}
        <section className="mt-10 sm:mt-16">
          <div className="mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              댓글 <span className="text-gray-400 font-normal">{comments.length}</span>
            </h2>
          </div>

          {/* 댓글 작성 */}
          <form onSubmit={(e) => handleCommentSubmit(e)} className="mb-8 sm:mb-10 bg-white border-2 border-gray-200 rounded-xl sm:rounded-2xl p-4 sm:p-5 focus-within:border-gray-400 transition-colors">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={user ? '댓글을 작성하세요...' : '로그인 후 댓글을 작성할 수 있습니다.'}
              disabled={!user || submitting}
              maxLength={500}
              className="w-full h-28 sm:h-32 px-3 sm:px-4 py-3 text-[15px] sm:text-base leading-relaxed resize-none outline-none disabled:bg-gray-50 disabled:cursor-not-allowed transition-colors"
            />
            <div className="flex justify-between items-center mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-100">
              <span className="text-xs sm:text-sm text-gray-400 font-medium">
                {commentText.length}/500
              </span>
              <button
                type="submit"
                disabled={!user || !commentText.trim() || submitting}
                className="px-5 sm:px-6 py-2.5 sm:py-3 bg-gray-900 text-white text-sm font-semibold rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-gray-700 active:scale-95 transition-all min-h-[44px]"
              >
                {submitting ? '작성 중...' : '댓글 작성'}
              </button>
            </div>
          </form>

          {/* 댓글 목록 */}
          <div className="space-y-4 sm:space-y-5">
            {comments.length === 0 ? (
              <div className="py-16 sm:py-20 text-center">
                <div className="text-gray-300 mb-3">
                  <svg className="w-12 h-12 sm:w-16 sm:h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-gray-400 text-sm sm:text-base">아직 댓글이 없습니다.</p>
                <p className="text-gray-300 text-xs sm:text-sm mt-2">첫 댓글을 남겨보세요!</p>
              </div>
            ) : (
              organizeComments(comments).map((comment) => (
                <div key={comment.id} className="bg-white border border-gray-200 rounded-xl sm:rounded-2xl p-4 sm:p-5">
                  {/* 부모 댓글 */}
                  {renderComment(comment, false)}

                  {/* 대댓글 목록 */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="ml-3 sm:ml-6 mt-4 sm:mt-5 space-y-3 sm:space-y-4 pl-3 sm:pl-4 border-l-[3px] sm:border-l-4 border-gray-200">
                      {comment.replies.map((reply) => renderComment(reply, true))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 mt-16">
        <div className="max-w-3xl lg:max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-4 text-xs text-gray-400">
            <Link href="/home-b" className="font-black text-gray-500 hover:text-gray-900 transition-colors">
              OPEN RISK
            </Link>
            <p>공공데이터 기반 상권 분석</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
