'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { LogIn, LogOut, Loader2 } from 'lucide-react'

interface Profile {
  nickname: string
  profile_image: string | null
  is_admin: boolean
}

export default function AuthButton() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    // 초기 세션 체크
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        supabase
          .from('profiles')
          .select('nickname, profile_image, is_admin')
          .eq('id', session.user.id)
          .single()
          .then(({ data }) => setProfile(data))
      }
      setLoading(false)
    })

    // 인증 상태 변경 구독
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          supabase
            .from('profiles')
            .select('nickname, profile_image, is_admin')
            .eq('id', session.user.id)
            .single()
            .then(({ data }) => setProfile(data))
        } else {
          setProfile(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

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
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.reload()
  }

  if (loading) {
    return (
      <button disabled className="flex items-center gap-2 px-3 py-1.5 text-xs border border-gray-200 text-gray-400">
        <Loader2 size={14} className="animate-spin" />
        로딩 중...
      </button>
    )
  }

  if (user) {
    const displayName = profile?.nickname || user.user_metadata?.name || user.user_metadata?.full_name || '사용자'
    const displayImage = profile?.profile_image || user.user_metadata?.avatar_url || null

    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          {displayImage ? (
            <img
              src={displayImage}
              alt={displayName}
              className="w-6 h-6 rounded-full"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs">
              {displayName[0]}
            </div>
          )}
          <span className="text-xs font-medium">
            {displayName}
            {profile?.is_admin && (
              <span className="ml-1 text-[10px] text-red-500">[관리자]</span>
            )}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1 px-2 py-1 text-[10px] border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <LogOut size={12} />
          로그아웃
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={handleLogin}
      className="flex items-center gap-2 px-3 py-1.5 text-xs bg-[#FEE500] hover:bg-[#FDD800] transition-colors font-medium"
    >
      <LogIn size={14} />
      카카오 로그인
    </button>
  )
}
