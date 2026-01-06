'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function WritePostPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isNotice, setIsNotice] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 더미 로그인 상태 (관리자 여부 포함)
  const isLoggedIn = true // 글 작성 페이지는 로그인 상태로 가정
  const isAdmin = true // 관리자 확인용

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) {
      alert('제목과 내용을 입력해주세요.')
      return
    }

    setIsSubmitting(true)
    // TODO: API 호출
    await new Promise((r) => setTimeout(r, 500)) // 시뮬레이션
    alert('글 작성 기능은 준비 중입니다.')
    setIsSubmitting(false)
    // router.push('/board')
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

            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-xs sm:text-sm text-gray-600">관리자</span>
              <button className="text-xs sm:text-sm text-gray-500 hover:text-black">
                로그아웃
              </button>
            </div>
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

        {/* 글쓰기 폼 */}
        <form onSubmit={handleSubmit} className="border-2 border-black bg-white">
          {/* 헤더 */}
          <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b-2 border-black bg-gray-50">
            <h1 className="text-base sm:text-lg font-bold">글쓰기</h1>
          </div>

          {/* 공지글 체크박스 (관리자만) */}
          {isAdmin && (
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
              className="w-full h-60 sm:h-80 text-[13px] sm:text-sm outline-none resize-none placeholder:text-gray-300 leading-relaxed"
            />
          </div>

          {/* 도움말 */}
          <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-t border-gray-200 bg-gray-50">
            <div className="text-[9px] sm:text-[10px] text-gray-500">
              <p className="font-medium mb-1">작성 팁:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>구체적인 지역과 업종을 언급하면 더 좋은 답변을 받을 수 있어요</li>
                <li className="hidden sm:list-item">분석 결과를 공유할 때는 리스크 점수와 주요 지표를 함께 적어주세요</li>
                <li>비속어나 광고성 글은 삭제될 수 있습니다</li>
              </ul>
            </div>
          </div>

          {/* 버튼 영역 */}
          <div className="px-3 sm:px-4 py-3 sm:py-4 border-t-2 border-black flex justify-end gap-2 sm:gap-3">
            <Link
              href="/board"
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
                  <span className="hidden xs:inline">등록 중...</span>
                  <span className="xs:hidden">등록중</span>
                </>
              ) : (
                '등록하기'
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
