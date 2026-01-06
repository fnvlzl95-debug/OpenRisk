'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

// 더미 데이터 (나중에 API로 교체)
const DUMMY_POST = {
  id: 3,
  title: '강남역 카페 창업 분석 결과 공유합니다',
  content: `안녕하세요, 강남역 근처에서 카페 창업을 준비 중인 예비창업자입니다.

오픈리스크로 분석해본 결과가 생각보다 충격적이어서 공유드립니다.

## 분석 결과 요약

- **리스크 점수**: 78점 (HIGH)
- **경쟁 밀도**: 반경 500m 내 카페 158개 (과밀)
- **임대료**: 평당 45만원 (높음)
- **유동인구**: 높음 (지하철 일평균 15만명)

## 느낀 점

유동인구가 많아서 괜찮을 줄 알았는데, 경쟁이 너무 치열하고 임대료가 높아서
실제로 수익을 내기가 쉽지 않을 것 같다는 분석이 나왔습니다.

특히 "파이 쪼개기 구조"라는 리스크 카드가 인상적이었어요.
경쟁이 많은데 그만큼 손님이 분산된다는 의미더라고요.

다른 분들은 이런 결과가 나왔을 때 어떻게 판단하시나요?
조언 부탁드립니다!`,
  is_notice: false,
  view_count: 456,
  created_at: '2026-01-06T08:30:00Z',
  updated_at: '2026-01-06T08:30:00Z',
  author: {
    nickname: '예비창업자',
    profile_image: null,
    is_admin: false,
  },
}

const DUMMY_COMMENTS = [
  {
    id: 1,
    content: '저도 강남역 근처 분석해봤는데 비슷한 결과가 나왔어요. 차별화 포인트가 확실하지 않으면 힘들 것 같습니다.',
    created_at: '2026-01-06T09:00:00Z',
    author: { nickname: '카페사장님', is_admin: false },
  },
  {
    id: 2,
    content: '78점이면 상당히 높은 리스크예요. 저라면 다른 지역도 같이 분석해보고 비교할 것 같아요.',
    created_at: '2026-01-06T09:30:00Z',
    author: { nickname: '맛집사장', is_admin: false },
  },
  {
    id: 3,
    content: '유동인구가 많다고 무조건 좋은 건 아니더라고요. 실제로 그 유동인구가 카페를 이용하는지가 중요합니다. 출퇴근 시간에만 붐비고 낮에는 한산할 수도 있어요.',
    created_at: '2026-01-06T10:15:00Z',
    author: { nickname: '10년차창업', is_admin: false },
  },
  {
    id: 4,
    content: '오픈리스크 분석 결과를 참고용으로만 활용하시고, 꼭 현장 답사를 여러 번 해보세요. 요일별, 시간대별로 다르게 느껴질 수 있습니다.',
    created_at: '2026-01-06T11:00:00Z',
    author: { nickname: '관리자', is_admin: true },
  },
]

export default function PostDetailPage() {
  const params = useParams()
  const [commentText, setCommentText] = useState('')
  // 더미 로그인 상태
  const isLoggedIn = false
  const currentUser = null

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

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLoggedIn) {
      alert('로그인이 필요합니다.')
      return
    }
    if (!commentText.trim()) return
    // TODO: API 호출
    alert('댓글 기능은 준비 중입니다.')
    setCommentText('')
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

            {isLoggedIn ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-xs sm:text-sm text-gray-600">닉네임</span>
                <button className="text-xs sm:text-sm text-gray-500 hover:text-black">
                  로그아웃
                </button>
              </div>
            ) : (
              <button className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 bg-[#FEE500] text-[#3C1E1E] text-xs sm:text-sm font-medium rounded hover:bg-[#FDD835] transition-colors">
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3C6.48 3 2 6.58 2 11c0 2.83 1.89 5.29 4.68 6.68-.15.53-.51 1.83-.59 2.11-.09.33.12.33.26.24.1-.07 1.62-1.07 2.28-1.5.45.07.91.1 1.37.1 5.52 0 10-3.58 10-8S17.52 3 12 3z"/>
                </svg>
                <span className="hidden xs:inline">카카오 </span>로그인
              </button>
            )}
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
              {DUMMY_POST.is_notice && (
                <span className="px-1.5 sm:px-2 py-0.5 bg-black text-white text-[9px] sm:text-[10px] font-bold">
                  공지
                </span>
              )}
              {DUMMY_POST.author.is_admin && (
                <span className="px-1.5 sm:px-2 py-0.5 border border-black text-[9px] sm:text-[10px]">
                  관리자
                </span>
              )}
            </div>
            <h1 className="text-base sm:text-xl font-bold mb-2 sm:mb-3 leading-snug">{DUMMY_POST.title}</h1>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0 text-[10px] sm:text-xs text-gray-500">
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="font-medium text-gray-700">{DUMMY_POST.author.nickname}</span>
                <span className="hidden sm:inline">{formatDate(DUMMY_POST.created_at)}</span>
                <span className="sm:hidden">{new Date(DUMMY_POST.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</span>
              </div>
              <span>조회 {DUMMY_POST.view_count}</span>
            </div>
          </div>

          {/* 본문 */}
          <div className="px-3 sm:px-4 py-4 sm:py-6">
            <div className="prose prose-sm max-w-none">
              {DUMMY_POST.content.split('\n').map((line, i) => {
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
          <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-t border-gray-200 flex justify-end gap-2">
            <button className="px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm text-gray-500 hover:text-black active:bg-gray-100">
              수정
            </button>
            <button className="px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm text-red-500 hover:text-red-700 active:bg-red-50">
              삭제
            </button>
          </div>
        </article>

        {/* 댓글 섹션 */}
        <section className="border-2 border-black bg-white">
          <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-gray-200">
            <h2 className="text-xs sm:text-sm font-bold">
              댓글 <span className="text-blue-500">{DUMMY_COMMENTS.length}</span>
            </h2>
          </div>

          {/* 댓글 목록 */}
          <div className="divide-y divide-gray-200">
            {DUMMY_COMMENTS.map((comment) => (
              <div key={comment.id} className="px-3 sm:px-4 py-3 sm:py-4">
                <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="font-medium text-xs sm:text-sm">{comment.author.nickname}</span>
                    {comment.author.is_admin && (
                      <span className="px-1 sm:px-1.5 py-0.5 border border-black text-[8px] sm:text-[9px]">
                        관리자
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] sm:text-[10px] text-gray-400">
                    {new Date(comment.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <p className="text-[13px] sm:text-sm text-gray-700 leading-relaxed">{comment.content}</p>
              </div>
            ))}
          </div>

          {/* 댓글 작성 */}
          <form onSubmit={handleCommentSubmit} className="border-t-2 border-black">
            <div className="px-3 sm:px-4 py-3">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={isLoggedIn ? '댓글을 작성하세요...' : '로그인 후 댓글을 작성할 수 있습니다.'}
                disabled={!isLoggedIn}
                className="w-full h-16 sm:h-20 p-2.5 sm:p-3 border border-gray-300 text-[13px] sm:text-sm resize-none outline-none focus:border-black disabled:bg-gray-50 disabled:cursor-not-allowed"
              />
              <div className="flex justify-end mt-2">
                <button
                  type="submit"
                  disabled={!isLoggedIn || !commentText.trim()}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 bg-black text-white text-xs sm:text-sm font-bold disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-gray-800 active:bg-gray-900 transition-colors"
                >
                  댓글 작성
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
