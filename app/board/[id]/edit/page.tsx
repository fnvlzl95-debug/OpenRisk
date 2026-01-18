'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AuthButton from '@/components/board/AuthButton'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

interface Profile {
  is_admin: boolean
}

interface Post {
  id: number
  title: string
  content: string
  is_notice: boolean
  author_id: string
}

export default function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isNotice, setIsNotice] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [post, setPost] = useState<Post | null>(null)

  // 인증 상태 확인 및 게시글 로드
  useEffect(() => {
    const supabase = createClient()

    const loadData = async () => {
      setLoading(true)

      try {
        // 병렬로 사용자, 프로필, 게시글 로드
        const [
          { data: { user } },
          postRes
        ] = await Promise.all([
          supabase.auth.getUser(),
          fetch(`/api/board/posts/${id}`)
        ])

        setUser(user)

        if (!user) {
          router.push('/board')
          return
        }

        // 프로필 확인
        const { data: profileData } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .single()
        setProfile(profileData)

        // 게시글 처리
        if (!postRes.ok) {
          throw new Error('게시글을 찾을 수 없습니다.')
        }

        const data = await postRes.json()
        const postData = data.post

        // 권한 확인 (작성자 또는 관리자)
        if (postData.author_id !== user.id && !profileData?.is_admin) {
          router.push(`/board/${id}`)
          return
        }

        setPost(postData)
        setTitle(postData.title)
        setContent(postData.content)
        setIsNotice(postData.is_notice)
      } catch (err) {
        setError(err instanceof Error ? err.message : '게시글을 불러올 수 없습니다.')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [id, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) {
      setError('제목과 내용을 입력해주세요.')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const res = await fetch(`/api/board/posts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          is_notice: profile?.is_admin && isNotice
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '글 수정에 실패했습니다.')
      }

      router.push(`/board/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '글 수정에 실패했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
          <div className="text-sm text-gray-500">게시글 불러오는 중...</div>
        </div>
      </div>
    )
  }

  if (!post) {
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
          href={`/board/${id}`}
          className="inline-flex items-center gap-1 text-xs sm:text-sm text-gray-500 hover:text-black mb-3 sm:mb-4"
        >
          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          취소
        </Link>

        {/* 수정 폼 */}
        <form onSubmit={handleSubmit} className="border-2 border-black bg-white">
          {/* 헤더 */}
          <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b-2 border-black bg-gray-50">
            <h1 className="text-base sm:text-lg font-bold">글 수정</h1>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-red-50 border-b border-red-200">
              <p className="text-xs sm:text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* 공지글 체크박스 (관리자만) */}
          {profile?.is_admin && (
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-gray-200">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isNotice}
                  onChange={(e) => setIsNotice(e.target.checked)}
                  className="w-4 h-4 accent-black"
                />
                <span className="text-xs sm:text-sm font-medium">공지글로 등록</span>
                <span className="text-[10px] sm:text-xs text-gray-400 hidden xs:inline">(목록 상단에 고정됩니다)</span>
              </label>
            </div>
          )}

          {/* 제목 */}
          <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-gray-200">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목을 입력하세요"
              maxLength={100}
              className="w-full text-base sm:text-lg font-medium outline-none placeholder:text-gray-300"
            />
            <div className="text-right text-[9px] sm:text-[10px] text-gray-400 mt-1">
              {title.length}/100
            </div>
          </div>

          {/* 내용 */}
          <div className="px-3 sm:px-4 py-2.5 sm:py-3">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="내용을 입력하세요..."
              maxLength={5000}
              className="w-full h-60 sm:h-80 text-[13px] sm:text-sm outline-none resize-none placeholder:text-gray-300 leading-relaxed"
            />
            <div className="text-right text-[9px] sm:text-[10px] text-gray-400 mt-1">
              {content.length}/5000
            </div>
          </div>

          {/* 버튼 영역 */}
          <div className="px-3 sm:px-4 py-3 sm:py-4 border-t-2 border-black flex justify-end gap-2 sm:gap-3">
            <Link
              href={`/board/${id}`}
              className="px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 text-xs sm:text-sm hover:bg-gray-100 active:bg-gray-200 transition-colors"
            >
              취소
            </Link>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim() || !content.trim()}
              className="px-4 sm:px-6 py-1.5 sm:py-2 bg-black text-white text-xs sm:text-sm font-bold disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-gray-800 active:bg-gray-900 transition-colors flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="hidden xs:inline">수정 중...</span>
                  <span className="xs:hidden">수정중</span>
                </>
              ) : (
                '수정하기'
              )}
            </button>
          </div>
        </form>
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
