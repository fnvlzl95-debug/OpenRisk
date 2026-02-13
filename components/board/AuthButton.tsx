'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Session } from '@supabase/supabase-js'
import { LogIn, LogOut, Loader2, Settings } from 'lucide-react'
import Link from 'next/link'

interface Profile {
  id: string
  nickname: string
  profile_image: string | null
  is_admin: boolean
}

// 전역 세션 캐시
const listeners: Set<() => void> = new Set()
let cachedSnapshot: { session: Session | null; loaded: boolean } = { session: null, loaded: false }

function subscribe(callback: () => void) {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

function getSnapshot() {
  return cachedSnapshot
}

// 서버에서는 항상 로딩 상태 반환 (hydration mismatch 방지)
const serverSnapshot = { session: null, loaded: false }
function getServerSnapshot() {
  return serverSnapshot
}

function updateSnapshot(session: Session | null, loaded: boolean) {
  cachedSnapshot = { session, loaded }
  listeners.forEach(l => l())
}

// 앱 시작 시 세션 로드
if (typeof window !== 'undefined') {
  const supabase = createClient()

  supabase.auth.getSession().then(({ data: { session } }) => {
    updateSnapshot(session, true)
  })

  supabase.auth.onAuthStateChange((_event, session) => {
    updateSnapshot(session, true)
  })
}

export default function AuthButton() {
  const { session, loaded } = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const user = session?.user ?? null
  const userId = user?.id
  const [profile, setProfile] = useState<Profile | null>(null)
  const [showMenu, setShowMenu] = useState(false)

  useEffect(() => {
    if (!userId) return

    const supabase = createClient()
    supabase
      .from('profiles')
      .select('id, nickname, profile_image, is_admin')
      .eq('id', userId)
      .single()
      .then(({ data }) => setProfile(data))
  }, [userId])

  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogin = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${window.location.pathname}`,
      },
    })
  }

  const handleLogout = async () => {
    setShowMenu(false)
    const supabase = createClient()
    setLoggingOut(true)
    try {
      await supabase.auth.signOut()
      window.location.reload()
    } catch (error) {
      console.error('Logout error:', error)
      setLoggingOut(false)
    }
  }

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    if (!showMenu) return

    const handleClickOutside = () => setShowMenu(false)
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showMenu])

  // 세션 로드 중이면 로딩 표시
  if (!loaded || loggingOut) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] sm:text-xs text-gray-400">
        <Loader2 size={14} className="animate-spin" />
      </div>
    )
  }

  if (user) {
    const activeProfile = profile?.id === userId ? profile : null
    const displayName = activeProfile?.nickname || user.user_metadata?.name || user.user_metadata?.full_name || '사용자'
    const displayImage = activeProfile?.profile_image || user.user_metadata?.avatar_url || null

    return (
      <div className="relative">
        {/* 모바일: 프로필 이미지만 표시 */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            setShowMenu(!showMenu)
          }}
          className="flex items-center gap-1.5 sm:gap-2"
        >
          {displayImage ? (
            <img
              src={displayImage}
              alt={displayName}
              className="w-7 h-7 sm:w-6 sm:h-6 rounded-full border border-gray-200"
            />
          ) : (
            <div className="w-7 h-7 sm:w-6 sm:h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] sm:text-xs font-medium">
              {displayName[0]}
            </div>
          )}
          {/* 데스크톱: 닉네임 표시 */}
          <span className="hidden sm:flex items-center text-xs font-medium text-gray-900">
            {displayName}
            {activeProfile?.is_admin && (
              <span className="ml-1 text-[10px] text-red-500">[관리자]</span>
            )}
          </span>
        </button>

        {/* 드롭다운 메뉴 */}
        {showMenu && (
          <div className="absolute right-0 top-full mt-2 w-40 bg-white border border-gray-200 shadow-lg z-50">
            {/* 모바일에서만 닉네임 표시 */}
            <div className="sm:hidden px-3 py-2 border-b border-gray-100">
              <p className="text-xs font-medium text-gray-900 truncate">{displayName}</p>
              {activeProfile?.is_admin && (
                <span className="text-[10px] text-red-500">[관리자]</span>
              )}
            </div>

            <Link
              href="/board/profile"
              className="flex items-center gap-2 px-3 py-2.5 text-xs text-gray-700 hover:bg-gray-50 active:bg-gray-100"
              onClick={() => setShowMenu(false)}
            >
              <Settings size={14} />
              프로필 설정
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-700 hover:bg-gray-50 active:bg-gray-100 border-t border-gray-100"
            >
              <LogOut size={14} />
              로그아웃
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <button
      onClick={handleLogin}
      className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs bg-[#FEE500] text-[#191919] hover:bg-[#FDD800] active:bg-[#FCCC00] transition-colors font-medium rounded-sm"
    >
      <LogIn size={14} />
      <span className="hidden sm:inline">카카오 로그인</span>
      <span className="sm:hidden">로그인</span>
    </button>
  )
}
