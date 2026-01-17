'use client'

import { useState, useEffect, Suspense, useRef } from 'react'
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
 * Design GAME: RPG/게임 UI 스타일 게시판
 * - 게시글 = 퀘스트 카드
 * - 조회수/댓글 = 경험치/골드
 * - 레벨 시스템
 * - 픽셀/레트로 느낌 + 모던 믹스
 * - 사운드 이펙트 느낌의 인터랙션
 */
function BoardContent() {
  const [posts, setPosts] = useState<Post[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [selectedPost, setSelectedPost] = useState<number | null>(null)
  const [showIntro, setShowIntro] = useState(true)
  const [playerStats, setPlayerStats] = useState({ hp: 100, mp: 50, gold: 0 })

  // 인트로 애니메이션
  useEffect(() => {
    const timer = setTimeout(() => setShowIntro(false), 2000)
    return () => clearTimeout(timer)
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
          // 총 골드 계산 (모든 게시글의 조회수 합)
          const totalGold = (data.posts || []).reduce((sum: number, p: Post) => sum + p.view_count, 0)
          setPlayerStats(prev => ({ ...prev, gold: totalGold }))
        }
      } catch (error) {
        console.error('Failed to fetch posts:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchPosts()
  }, [currentPage])

  // 레벨 계산 (조회수 기반)
  const calculateLevel = (views: number) => {
    if (views >= 500) return { level: 5, rank: 'LEGENDARY', color: 'text-amber-400', border: 'border-amber-400', bg: 'from-amber-500/20' }
    if (views >= 200) return { level: 4, rank: 'EPIC', color: 'text-purple-400', border: 'border-purple-400', bg: 'from-purple-500/20' }
    if (views >= 100) return { level: 3, rank: 'RARE', color: 'text-blue-400', border: 'border-blue-400', bg: 'from-blue-500/20' }
    if (views >= 30) return { level: 2, rank: 'UNCOMMON', color: 'text-green-400', border: 'border-green-400', bg: 'from-green-500/20' }
    return { level: 1, rank: 'COMMON', color: 'text-gray-400', border: 'border-gray-600', bg: 'from-gray-500/20' }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    if (hours < 1) return 'NOW'
    if (hours < 24) return `${hours}H AGO`
    return `${Math.floor(hours / 24)}D AGO`
  }

  const totalPages = pagination?.totalPages || 1
  const notices = posts.filter(p => p.is_notice)
  const regularPosts = posts.filter(p => !p.is_notice)

  // 인트로 화면
  if (showIntro) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center animate-pulse">
          <div className="text-4xl font-black text-white mb-4 tracking-widest" style={{ fontFamily: 'monospace' }}>
            OPEN RISK
          </div>
          <div className="text-emerald-400 text-sm font-mono">LOADING QUEST BOARD...</div>
          <div className="mt-4 flex justify-center gap-1">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-3 h-3 bg-emerald-400"
                style={{
                  animation: `blink 1s infinite`,
                  animationDelay: `${i * 0.2}s`
                }}
              />
            ))}
          </div>
        </div>
        <style jsx>{`
          @keyframes blink {
            0%, 100% { opacity: 0.2; }
            50% { opacity: 1; }
          }
        `}</style>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-hidden" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
      {/* 스캔라인 오버레이 */}
      <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.03]"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)'
        }}
      />

      {/* HUD 상단 바 */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-gradient-to-b from-[#0a0a0f] to-transparent">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            {/* 로고 */}
            <Link href="/home-b" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="w-10 h-10 border-2 border-emerald-400 bg-emerald-400/10 flex items-center justify-center clip-corner">
                  <span className="text-emerald-400 font-black text-sm">OR</span>
                </div>
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 animate-ping" />
              </div>
              <div>
                <span className="text-lg font-black tracking-wider">OPEN RISK</span>
                <span className="block text-[9px] text-emerald-400 font-mono">QUEST BOARD v1.0</span>
              </div>
            </Link>

            {/* 플레이어 스탯 */}
            <div className="hidden sm:flex items-center gap-4">
              {/* HP 바 */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-red-400">HP</span>
                <div className="w-24 h-2 bg-gray-800 border border-gray-700">
                  <div className="h-full bg-gradient-to-r from-red-600 to-red-400" style={{ width: `${playerStats.hp}%` }} />
                </div>
              </div>
              {/* MP 바 */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-blue-400">MP</span>
                <div className="w-24 h-2 bg-gray-800 border border-gray-700">
                  <div className="h-full bg-gradient-to-r from-blue-600 to-blue-400" style={{ width: `${playerStats.mp}%` }} />
                </div>
              </div>
              {/* 골드 */}
              <div className="flex items-center gap-1 px-2 py-1 bg-amber-400/10 border border-amber-400/30">
                <span className="text-amber-400 text-sm">◆</span>
                <span className="font-mono text-amber-400 text-sm">{playerStats.gold.toLocaleString()}</span>
              </div>
            </div>

            <AuthButton />
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className="pt-20 pb-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* 퀘스트 보드 타이틀 */}
          <div className="text-center mb-8">
            <div className="inline-block">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-emerald-400/50" />
                <span className="text-[10px] font-mono text-emerald-400 tracking-[0.3em]">QUEST BOARD</span>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-emerald-400/50" />
              </div>
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-2">
                자유게시판
              </h1>
              <p className="text-sm text-gray-500 font-mono">SELECT YOUR QUEST</p>
            </div>
          </div>

          {/* 새 퀘스트 버튼 */}
          <div className="flex justify-center mb-8">
            <Link
              href={user ? "/board/write" : "/auth/login?next=/board/write"}
              className="group relative px-8 py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-bold overflow-hidden clip-corner-lg"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative flex items-center gap-2">
                <span className="text-xl">+</span>
                NEW QUEST 등록
              </span>
              {/* 코너 장식 */}
              <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-white/50" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-white/50" />
            </Link>
          </div>

          {/* 공지사항 = 긴급 퀘스트 */}
          {notices.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-red-400 animate-pulse">⚠</span>
                <span className="text-[10px] font-mono text-red-400 tracking-wider">URGENT QUEST</span>
              </div>
              {notices.map((post) => (
                <Link
                  key={post.id}
                  href={`/board/${post.id}`}
                  className="block mb-2 p-4 bg-gradient-to-r from-red-900/30 to-transparent border border-red-500/50 hover:border-red-400 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-500/20 border border-red-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-red-400 text-xl">!</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-red-400 text-[10px] font-mono">NOTICE</span>
                      <h3 className="font-bold truncate group-hover:text-red-300 transition-colors">{post.title}</h3>
                    </div>
                    <span className="text-gray-500 font-mono text-sm hidden sm:block">ACCEPT →</span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* 퀘스트 목록 */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-40 bg-gray-900/50 border border-gray-800 animate-pulse" />
              ))}
            </div>
          ) : regularPosts.length === 0 && notices.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-gray-700">
              <div className="text-4xl mb-4 opacity-30">📜</div>
              <p className="text-gray-500 mb-2 font-mono">NO QUESTS AVAILABLE</p>
              <p className="text-gray-600 text-sm">첫 번째 퀘스트를 등록해보세요</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {regularPosts.map((post, idx) => {
                const levelInfo = calculateLevel(post.view_count)
                const isSelected = selectedPost === post.id

                return (
                  <Link
                    key={post.id}
                    href={`/board/${post.id}`}
                    className={`group relative block border transition-all duration-200 ${levelInfo.border} ${
                      isSelected ? 'scale-[1.02] shadow-lg shadow-emerald-500/20' : ''
                    }`}
                    onMouseEnter={() => setSelectedPost(post.id)}
                    onMouseLeave={() => setSelectedPost(null)}
                    style={{
                      animationDelay: `${idx * 50}ms`,
                      animation: 'fadeIn 0.3s ease-out forwards'
                    }}
                  >
                    {/* 카드 배경 그라데이션 */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${levelInfo.bg} to-transparent opacity-50`} />

                    {/* 레벨 뱃지 */}
                    <div className={`absolute -top-px -right-px px-3 py-1 ${levelInfo.color} bg-[#0a0a0f] border-l border-b ${levelInfo.border} text-[10px] font-mono font-bold`}>
                      {levelInfo.rank}
                    </div>

                    <div className="relative p-4">
                      {/* 상단: 퀘스트 정보 */}
                      <div className="flex items-start gap-3 mb-3">
                        {/* 레벨 아이콘 */}
                        <div className={`w-12 h-12 border ${levelInfo.border} bg-gray-900/80 flex items-center justify-center flex-shrink-0`}>
                          <span className={`text-2xl font-black font-mono ${levelInfo.color}`}>
                            {levelInfo.level}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* 작성자 & 시간 */}
                          <div className="flex items-center gap-2 mb-1">
                            {post.author_is_admin && (
                              <span className="px-1.5 py-0.5 bg-purple-500/20 border border-purple-500/50 text-purple-400 text-[8px] font-bold">
                                GM
                              </span>
                            )}
                            <span className="text-[10px] text-gray-500 font-mono">{post.author_nickname}</span>
                            <span className="text-gray-700">|</span>
                            <span className="text-[10px] text-gray-600 font-mono">{formatDate(post.created_at)}</span>
                          </div>

                          {/* 제목 */}
                          <h3 className="font-bold text-lg truncate group-hover:text-emerald-300 transition-colors">
                            {post.title}
                          </h3>
                        </div>
                      </div>

                      {/* 본문 미리보기 */}
                      <p className="text-sm text-gray-500 line-clamp-2 mb-4 pl-15">
                        {post.content.replace(/<[^>]*>/g, '').substring(0, 80)}
                      </p>

                      {/* 하단: 보상 정보 */}
                      <div className="flex items-center justify-between pt-3 border-t border-gray-800">
                        <div className="flex items-center gap-4">
                          {/* EXP */}
                          <div className="flex items-center gap-1.5">
                            <span className="text-emerald-400 text-xs">★</span>
                            <span className="text-[11px] font-mono text-emerald-400">EXP +{post.view_count}</span>
                          </div>
                          {/* GOLD */}
                          {post.comment_count > 0 && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-amber-400 text-xs">◆</span>
                              <span className="text-[11px] font-mono text-amber-400">GOLD +{post.comment_count * 10}</span>
                            </div>
                          )}
                        </div>

                        {/* ACCEPT 버튼 */}
                        <span className="text-[10px] font-mono text-gray-600 group-hover:text-emerald-400 transition-colors flex items-center gap-1">
                          ACCEPT
                          <span className="group-hover:translate-x-1 transition-transform">→</span>
                        </span>
                      </div>
                    </div>

                    {/* 호버 시 글로우 */}
                    <div className={`absolute inset-0 border ${levelInfo.border} opacity-0 group-hover:opacity-50 transition-opacity pointer-events-none`}
                      style={{ boxShadow: `inset 0 0 30px ${levelInfo.color.includes('amber') ? 'rgba(251,191,36,0.1)' : levelInfo.color.includes('purple') ? 'rgba(192,132,252,0.1)' : levelInfo.color.includes('blue') ? 'rgba(96,165,250,0.1)' : levelInfo.color.includes('green') ? 'rgba(74,222,128,0.1)' : 'rgba(156,163,175,0.05)'}` }}
                    />
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
                className="w-10 h-10 border border-gray-700 text-gray-500 disabled:opacity-30 hover:border-emerald-400 hover:text-emerald-400 transition-all flex items-center justify-center font-mono"
              >
                ◀
              </button>

              <div className="px-4 py-2 border border-gray-700 bg-gray-900/50">
                <span className="font-mono text-emerald-400">{String(currentPage).padStart(2, '0')}</span>
                <span className="text-gray-600 mx-2">/</span>
                <span className="font-mono text-gray-500">{String(totalPages).padStart(2, '0')}</span>
              </div>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-10 h-10 border border-gray-700 text-gray-500 disabled:opacity-30 hover:border-emerald-400 hover:text-emerald-400 transition-all flex items-center justify-center font-mono"
              >
                ▶
              </button>
            </div>
          )}
        </div>
      </main>

      {/* 하단 HUD */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/90 to-transparent pt-8">
        <div className="max-w-6xl mx-auto px-4 pb-4">
          <div className="flex justify-between items-center text-[10px] font-mono text-gray-600">
            <Link href="/home-b" className="hover:text-emerald-400 transition-colors">
              OPEN RISK™
            </Link>
            <span>공공데이터 기반 상권 리스크 분석</span>
            <span className="text-emerald-400/50">SYSTEM ONLINE</span>
          </div>
        </div>
      </footer>

      {/* 스타일 */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .clip-corner {
          clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
        }
        .clip-corner-lg {
          clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
        }
      `}</style>
    </div>
  )
}

export default function BoardPageDesignGame() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="text-emerald-400 text-sm font-mono animate-pulse">LOADING...</div>
        </div>
      </div>
    }>
      <BoardContent />
    </Suspense>
  )
}
