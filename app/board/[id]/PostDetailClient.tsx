'use client'

import { useState, useEffect, type HTMLAttributes, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AuthButton from '@/components/board/AuthButton'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { hasViewedPost, markPostAsViewed } from '@/lib/board/view-tracker'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

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

export default function PostDetailClient({ id }: { id: string }) {
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

  // 댓글 렌더링 함수 - 컴팩트한 디자인
  // rootCommentId: 대댓글에서 답글 달 때 원 댓글의 id를 사용하기 위함
  const renderComment = (comment: Comment, isReply: boolean = false, rootCommentId?: number) => {
    const isEditing = editingCommentId === comment.id
    // 대댓글에 답글 달면 원 댓글에 대댓글로 저장
    const replyTargetId = isReply && rootCommentId ? rootCommentId : comment.id

    return (
      <div key={comment.id} className={isReply ? 'bg-gray-50 rounded-lg p-3' : ''}>
        {/* 댓글 헤더 */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            {isReply && (
              <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            )}
            <span className="text-sm font-semibold text-gray-900">{comment.author_nickname}</span>
            {comment.author_is_admin && (
              <span className="px-1.5 py-0.5 text-[9px] font-semibold text-blue-700 bg-blue-50 rounded-full">
                관리자
              </span>
            )}
            <time className="text-xs text-gray-400">
              {new Date(comment.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
            </time>
          </div>
          {canDeleteComment(comment) && !isEditing && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleEditComment(comment)}
                className="text-xs text-gray-500 hover:text-gray-900 transition-colors"
              >
                수정
              </button>
              <button
                onClick={() => handleDeleteComment(comment.id)}
                className="text-xs text-red-500 hover:text-red-700 transition-colors"
              >
                삭제
              </button>
            </div>
          )}
        </div>

        {/* 댓글 내용 */}
        {isEditing ? (
          <div>
            <textarea
              value={editingCommentText}
              onChange={(e) => setEditingCommentText(e.target.value)}
              maxLength={500}
              className="w-full h-20 px-3 py-2.5 text-sm leading-[1.5] bg-white border border-gray-200 rounded-lg resize-none outline-none focus:border-blue-400 transition-all"
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-gray-400">
                {editingCommentText.length}/500
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handleCancelEditComment}
                  disabled={submitting}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  onClick={() => handleSaveComment(comment.id)}
                  disabled={submitting || !editingCommentText.trim()}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700 transition-all"
                >
                  {submitting ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-700 leading-[1.6] break-words whitespace-pre-wrap">{comment.content}</p>
        )}

        {/* 답글 버튼 */}
        {user && !isEditing && (
          <button
            onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
            className="mt-2 text-xs text-gray-500 hover:text-gray-900 transition-colors"
          >
            {replyingTo === comment.id ? '취소' : '답글'}
          </button>
        )}

        {/* 답글 입력 폼 */}
        {replyingTo === comment.id && (
          <form onSubmit={(e) => handleCommentSubmit(e, replyTargetId)} className="mt-2 flex gap-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="답글을 입력하세요"
              maxLength={500}
              className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-blue-400 focus:bg-white"
            />
            <button
              type="submit"
              disabled={!replyText.trim() || submitting}
              className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg disabled:bg-gray-300 hover:bg-blue-700 transition-all"
            >
              {submitting ? '...' : '등록'}
            </button>
          </form>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 text-black">
      {/* 확인 모달 */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Header - 심플하고 깔끔한 헤더 */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 py-5 sm:py-5">
          <div className="flex justify-between items-center">
            <Link href="/home-b" className="group">
              <span className="text-lg sm:text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                OPEN RISK
              </span>
            </Link>
            <AuthButton />
          </div>
        </div>
      </header>

      {/* Main - 편안한 가독성 중심 */}
      <main className="max-w-4xl mx-auto px-5 sm:px-6 py-6 sm:py-8 bg-gray-50">
        {/* 뒤로가기 */}
        <Link
          href="/board"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-8"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>목록</span>
        </Link>

        {/* 게시글 - 카드 디자인 */}
        <article className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 mb-6">
          {/* 뱃지 */}
          {(post.is_notice || post.author_is_admin) && (
            <div className="flex items-center gap-2 mb-5">
              {post.is_notice && (
                <span className="px-3 py-1.5 text-xs font-semibold text-orange-700 bg-orange-50 rounded-full">
                  공지사항
                </span>
              )}
              {post.author_is_admin && !post.is_notice && (
                <span className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 rounded-full">
                  관리자
                </span>
              )}
            </div>
          )}

          {/* 제목 */}
          <h1 className="text-[22px] sm:text-[26px] font-bold text-gray-900 mb-4 leading-[1.4] break-words">
            {post.title}
          </h1>

          {/* 메타 정보 */}
          <div className="flex items-center gap-2 pb-5 mb-6 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">{post.author_nickname}</span>
            <span className="text-gray-300">·</span>
            <time className="text-sm text-gray-500">
              {new Date(post.created_at).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </time>
            <span className="text-gray-300">·</span>
            <span className="text-sm text-gray-500">조회 {post.view_count}</span>
          </div>

          {/* 본문 */}
          <div className="prose prose-lg max-w-none text-[16px] sm:text-[17px] leading-[1.8] text-gray-700">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="text-[24px] sm:text-[28px] font-bold text-gray-900 mt-8 mb-6 leading-[1.3]">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-[20px] sm:text-[22px] font-bold text-gray-900 mt-8 mb-4 leading-[1.3]">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-[18px] sm:text-[20px] font-semibold text-gray-900 mt-6 mb-3 leading-[1.4]">
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p className="my-4 leading-[1.8] text-gray-700">
                    {children}
                  </p>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold text-gray-900">
                    {children}
                  </strong>
                ),
                em: ({ children }) => (
                  <em className="italic text-gray-800">
                    {children}
                  </em>
                ),
                ul: ({ children }) => (
                  <ul className="my-4 ml-6 space-y-2 list-disc">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="my-4 ml-6 space-y-2 list-decimal">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="leading-[1.8] text-gray-700">
                    {children}
                  </li>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="my-4 pl-4 border-l-4 border-gray-300 text-gray-600 italic">
                    {children}
                  </blockquote>
                ),
                code: ({ inline, children, ...props }: { inline?: boolean; children?: ReactNode } & HTMLAttributes<HTMLElement>) =>
                  inline ? (
                    <code className="px-1.5 py-0.5 bg-gray-100 text-gray-800 rounded text-sm font-mono" {...props}>
                      {children}
                    </code>
                  ) : (
                    <code className="block my-4 p-4 bg-gray-100 text-gray-800 rounded-lg text-sm font-mono overflow-x-auto" {...props}>
                      {children}
                    </code>
                  ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    {children}
                  </a>
                ),
                hr: () => <hr className="my-8 border-gray-200" />,
              }}
            >
              {post.content}
            </ReactMarkdown>
          </div>

          {/* 버튼 영역 */}
          {canEditPost && (
            <div className="flex gap-2 mt-8 pt-6 border-t border-gray-100">
              <Link
                href={`/board/${id}/edit`}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all flex items-center justify-center"
              >
                수정
              </Link>
              <button
                onClick={handleDeletePost}
                className="px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-all"
              >
                삭제
              </button>
            </div>
          )}
        </article>

        {/* 댓글 섹션 - 컴팩트한 디자인 */}
        <section className="bg-white rounded-2xl shadow-sm p-5 sm:p-6">
          {/* 댓글 헤더 */}
          <h2 className="text-base font-bold text-gray-900 mb-4">
            댓글 <span className="text-gray-500 font-normal text-sm">{comments.length}</span>
          </h2>

          {/* 댓글 작성 */}
          <form onSubmit={(e) => handleCommentSubmit(e)} className="mb-5 pb-5 border-b border-gray-100">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={user ? '댓글을 입력하세요' : '로그인 후 댓글을 작성할 수 있습니다'}
              disabled={!user || submitting}
              maxLength={500}
              className="w-full h-20 px-3 py-2.5 text-sm leading-[1.5] bg-gray-50 border border-gray-200 rounded-lg resize-none outline-none focus:border-blue-400 focus:bg-white disabled:bg-gray-100 disabled:cursor-not-allowed transition-all placeholder:text-gray-400"
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-gray-400">
                {commentText.length}/500
              </span>
              <button
                type="submit"
                disabled={!user || !commentText.trim() || submitting}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700 transition-all"
              >
                {submitting ? '작성 중...' : '등록'}
              </button>
            </div>
          </form>

          {/* 댓글 목록 */}
          <div className="space-y-4">
            {comments.length === 0 ? (
              <div className="py-10 text-center">
                <div className="text-gray-300 mb-2">
                  <svg className="w-10 h-10 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-gray-400 text-sm">첫 댓글을 남겨보세요</p>
              </div>
            ) : (
              organizeComments(comments).map((comment) => (
                <div key={comment.id} className="border-b border-gray-100 last:border-0 pb-4 last:pb-0">
                  {/* 부모 댓글 */}
                  {renderComment(comment, false)}

                  {/* 대댓글 목록 */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="ml-5 mt-3 space-y-3 pl-3 border-l-2 border-gray-100">
                      {comment.replies.map((reply) => renderComment(reply, true, comment.id))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 mt-8">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 py-8">
          <div className="flex flex-col items-center gap-2 text-xs text-gray-400">
            <Link href="/home-b" className="font-bold text-gray-600 hover:text-blue-600 transition-colors">
              OPEN RISK
            </Link>
            <p>공공데이터 기반 상권 분석 플랫폼</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
