'use client'

import { useState, useEffect, Suspense, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
 * Design X: 리스크 분석 컨셉 게시판
 * - 게시글을 "리스크 카드"처럼 표현
 * - 조회수/댓글수를 리스크 지표처럼 시각화
 * - 마우스 따라 움직이는 인터랙티브 카드
 * - 글자 타이핑 애니메이션
 * - 신문 헤드라인 스타일 결합
 */
function BoardContent() {
  const [posts, setPosts] = useState<Post[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [hoveredPost, setHoveredPost] = useState<number | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [typedText, setTypedText] = useState('')
  const router = useRouter()

  const headlines = [
    "창업 리스크, 함께 분석합니다",
    "실패를 관리하는 커뮤니티",
    "데이터로 말하는 상권 이야기",
    "당신의 창업 고민을 나눠요"
  ]
  const [headlineIndex, setHeadlineIndex] = useState(0)

  // 타이핑 애니메이션
  useEffect(() => {
    const headline = headlines[headlineIndex]
    let i = 0
    setTypedText('')

    const typeInterval = setInterval(() => {
      if (i < headline.length) {
        setTypedText(headline.slice(0, i + 1))
        i++
      } else {
        clearInterval(typeInterval)
        setTimeout(() => {
          setHeadlineIndex((prev) => (prev + 1) % headlines.length)
        }, 3000)
      }
    }, 80)

    return () => clearInterval(typeInterval)
  }, [headlineIndex])

  // 마우스 위치 추적
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

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

  // 리스크 점수 계산 (조회수 + 댓글수 기반)
  const calculateRiskScore = (post: Post) => {
    const viewScore = Math.min(post.view_count / 10, 50)
    const commentScore = Math.min(post.comment_count * 5, 50)
    return Math.round(viewScore + commentScore)
  }

  // 리스크 레벨 결정
  const getRiskLevel = (score: number) => {
    if (score >= 70) return { level: 'HIGH', color: 'text-red-500', bg: 'bg-red-500', label: '고위험' }
    if (score >= 40) return { level: 'MED', color: 'text-amber-500', bg: 'bg-amber-500', label: '중위험' }
    return { level: 'LOW', color: 'text-emerald-500', bg: 'bg-emerald-500', label: '저위험' }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours < 1) return 'NOW'
    if (hours < 24) return `${hours}H`
    return `${Math.floor(hours / 24)}D`
  }

  const totalPages = pagination?.totalPages || 1

  const notices = posts.filter(p => p.is_notice)
  const regularPosts = posts.filter(p => !p.is_notice)

  // 3D 틸트 효과 계산
  const calculateTilt = (cardRef: HTMLElement | null, postId: number) => {
    if (!cardRef || hoveredPost !== postId) return { rotateX: 0, rotateY: 0 }
    const rect = cardRef.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const rotateY = ((mousePos.x - centerX) / rect.width) * 10
    const rotateX = ((centerY - mousePos.y) / rect.height) * 10
    return { rotateX, rotateY }
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* 배경 그리드 */}
      <div
        className="fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px'
        }}
      />

      {/* 마우스 팔로우 글로우 */}
      <div
        className="fixed w-[500px] h-[500px] rounded-full pointer-events-none opacity-20 blur-[100px] transition-all duration-300"
        style={{
          background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)',
          left: mousePos.x - 250,
          top: mousePos.y - 250,
        }}
      />

      {/* Header */}
      <header className="relative z-50 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link href="/home-b" className="group flex items-center gap-4">
              <div className="relative">
                <span className="text-2xl font-black tracking-tighter">OPEN RISK</span>
                <div className="absolute -bottom-1 left-0 w-full h-0.5 bg-white scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
              </div>
              <span className="text-[10px] font-mono text-white/40 border border-white/20 px-2 py-0.5">
                COMMUNITY v2.0
              </span>
            </Link>
            <AuthButton />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative py-16 px-4 border-b border-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            {/* 좌측: 타이틀 */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 border border-white/20 rounded-full mb-6">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-mono text-white/60">LIVE COMMUNITY</span>
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight mb-4 leading-none">
                자유<br />게시판
              </h1>
              <p className="text-lg text-white/40 font-mono h-8">
                {typedText}<span className="animate-pulse">|</span>
              </p>
            </div>

            {/* 우측: 통계 대시보드 */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/5 border border-white/10 p-4 rounded-xl backdrop-blur-sm">
                <span className="text-[10px] font-mono text-white/40 block mb-2">TOTAL POSTS</span>
                <span className="text-3xl font-black">{pagination?.total || '—'}</span>
              </div>
              <div className="bg-white/5 border border-white/10 p-4 rounded-xl backdrop-blur-sm">
                <span className="text-[10px] font-mono text-white/40 block mb-2">PAGE</span>
                <span className="text-3xl font-black">{currentPage}<span className="text-lg text-white/40">/{totalPages}</span></span>
              </div>
              <div className="bg-white/5 border border-white/10 p-4 rounded-xl backdrop-blur-sm">
                <span className="text-[10px] font-mono text-white/40 block mb-2">STATUS</span>
                <span className="text-3xl font-black text-emerald-400">LIVE</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 공지사항 띠 - 스크롤링 */}
      {notices.length > 0 && (
        <div className="relative py-3 bg-white text-black overflow-hidden">
          <div className="animate-marquee whitespace-nowrap flex gap-8">
            {[...notices, ...notices, ...notices].map((post, idx) => (
              <Link
                key={`${post.id}-${idx}`}
                href={`/board/${post.id}`}
                className="inline-flex items-center gap-3 hover:text-gray-600 transition-colors"
              >
                <span className="font-black">NOTICE</span>
                <span className="font-medium">{post.title}</span>
                <span className="text-gray-400">→</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 py-8">
        {/* 글쓰기 버튼 */}
        <div className="flex justify-end mb-6">
          <Link
            href={user ? "/board/write" : "/auth/login?next=/board/write"}
            className="group relative px-6 py-3 bg-white text-black font-bold overflow-hidden"
          >
            <span className="relative z-10 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              새 리스크 리포트 작성
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-cyan-400 translate-x-full group-hover:translate-x-0 transition-transform duration-300" />
          </Link>
        </div>

        {/* 게시글 그리드 */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="aspect-[4/3] bg-white/5 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : regularPosts.length === 0 && notices.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 border border-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">∅</span>
            </div>
            <p className="text-white/60 mb-2">데이터 없음</p>
            <p className="text-white/40 text-sm">첫 번째 리스크 리포트를 작성해보세요</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {regularPosts.map((post, idx) => {
              const riskScore = calculateRiskScore(post)
              const risk = getRiskLevel(riskScore)

              return (
                <PostCard
                  key={post.id}
                  post={post}
                  riskScore={riskScore}
                  risk={risk}
                  formatDate={formatDate}
                  index={idx}
                  hoveredPost={hoveredPost}
                  setHoveredPost={setHoveredPost}
                  mousePos={mousePos}
                />
              )
            })}
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-3 mt-12">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-12 h-12 border border-white/20 text-white/60 disabled:opacity-30 hover:bg-white hover:text-black transition-all flex items-center justify-center"
            >
              ←
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).slice(
                Math.max(0, currentPage - 3),
                Math.min(totalPages, currentPage + 2)
              ).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-12 h-12 font-mono text-sm transition-all ${
                    currentPage === page
                      ? 'bg-white text-black font-bold'
                      : 'border border-white/20 text-white/60 hover:border-white/60'
                  }`}
                >
                  {String(page).padStart(2, '0')}
                </button>
              ))}
            </div>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="w-12 h-12 border border-white/20 text-white/60 disabled:opacity-30 hover:bg-white hover:text-black transition-all flex items-center justify-center"
            >
              →
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 mt-16">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <Link href="/home-b" className="text-xl font-black">OPEN RISK</Link>
            <span className="text-[10px] font-mono text-white/40">
              공공데이터 기반 상권 리스크 분석 플랫폼
            </span>
          </div>
        </div>
      </footer>

      {/* 애니메이션 스타일 */}
      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.33%); }
        }
        .animate-marquee {
          animation: marquee 20s linear infinite;
        }
      `}</style>
    </div>
  )
}

// 분리된 PostCard 컴포넌트 (3D 틸트 효과)
function PostCard({
  post,
  riskScore,
  risk,
  formatDate,
  index,
  hoveredPost,
  setHoveredPost,
  mousePos
}: {
  post: Post
  riskScore: number
  risk: { level: string; color: string; bg: string; label: string }
  formatDate: (d: string) => string
  index: number
  hoveredPost: number | null
  setHoveredPost: (id: number | null) => void
  mousePos: { x: number; y: number }
}) {
  const cardRef = useRef<HTMLAnchorElement>(null)
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 })

  useEffect(() => {
    if (!cardRef.current || hoveredPost !== post.id) {
      setTilt({ rotateX: 0, rotateY: 0 })
      return
    }
    const rect = cardRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const rotateY = ((mousePos.x - centerX) / rect.width) * 8
    const rotateX = ((centerY - mousePos.y) / rect.height) * 8
    setTilt({ rotateX, rotateY })
  }, [mousePos, hoveredPost, post.id])

  return (
    <Link
      ref={cardRef}
      href={`/board/${post.id}`}
      className="group relative block"
      style={{
        perspective: '1000px',
        animationDelay: `${index * 100}ms`
      }}
      onMouseEnter={() => setHoveredPost(post.id)}
      onMouseLeave={() => setHoveredPost(null)}
    >
      <div
        className="relative bg-gradient-to-br from-white/10 to-white/5 border border-white/10 p-5 transition-all duration-200 hover:border-white/30"
        style={{
          transform: `rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`,
          transformStyle: 'preserve-3d'
        }}
      >
        {/* 리스크 인디케이터 */}
        <div className="absolute top-0 right-0 w-20 h-20 overflow-hidden">
          <div className={`absolute top-3 right-[-35px] w-[120px] text-center text-[9px] font-bold py-1 rotate-45 ${risk.bg} text-black`}>
            {risk.level}
          </div>
        </div>

        {/* 상단: 리스크 점수 */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <span className="text-[10px] font-mono text-white/40 block">RISK SCORE</span>
            <div className="flex items-end gap-1">
              <span className={`text-3xl font-black ${risk.color}`}>{riskScore}</span>
              <span className="text-white/40 text-sm mb-1">/100</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-mono text-white/40 block">TIME</span>
            <span className="text-lg font-mono">{formatDate(post.created_at)}</span>
          </div>
        </div>

        {/* 리스크 바 */}
        <div className="h-1 bg-white/10 rounded-full mb-4 overflow-hidden">
          <div
            className={`h-full ${risk.bg} transition-all duration-500`}
            style={{ width: `${riskScore}%` }}
          />
        </div>

        {/* 제목 */}
        <h3 className="font-bold text-lg mb-2 line-clamp-2 group-hover:text-white/80 transition-colors">
          {post.title}
        </h3>

        {/* 본문 미리보기 */}
        <p className="text-sm text-white/50 line-clamp-2 mb-4">
          {post.content.replace(/<[^>]*>/g, '').substring(0, 80)}
        </p>

        {/* 하단: 메타 정보 */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          <div className="flex items-center gap-2">
            {post.author_is_admin && (
              <span className="px-2 py-0.5 bg-white/10 text-[9px] font-bold">ADMIN</span>
            )}
            <span className="text-xs text-white/40">{post.author_nickname}</span>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-mono text-white/40">
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
              {post.view_count}
            </span>
            {post.comment_count > 0 && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                </svg>
                {post.comment_count}
              </span>
            )}
          </div>
        </div>

        {/* 호버 시 글로우 효과 */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
        </div>
      </div>
    </Link>
  )
}

export default function BoardPageDesignX() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border border-white/20 rounded-full flex items-center justify-center animate-pulse">
            <div className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          </div>
          <span className="text-[10px] font-mono text-white/40">LOADING RISK DATA...</span>
        </div>
      </div>
    }>
      <BoardContent />
    </Suspense>
  )
}
