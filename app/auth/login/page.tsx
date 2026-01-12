'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Suspense } from 'react'
import Link from 'next/link'
import { MessageCircle, ArrowLeft, Users, Lock } from 'lucide-react'

function LoginHandler() {
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/board'
  const [isLoading, setIsLoading] = useState(true)
  const [isRedirecting, setIsRedirecting] = useState(false)

  useEffect(() => {
    const checkSession = async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()

        if (session) {
          window.location.href = next
          return
        }
      } catch (e) {
        console.error('Session check error:', e)
      }

      setIsLoading(false)
    }

    checkSession()
  }, [next])

  const handleKakaoLogin = async () => {
    setIsRedirecting(true)
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })

    if (error) {
      console.error('Login error:', error)
      setIsRedirecting(false)
      alert('로그인 중 오류가 발생했습니다')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-300">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/home-b"
            className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-black transition-colors"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">돌아가기</span>
          </Link>
          <Link href="/home-b" className="text-base sm:text-lg font-bold tracking-tight">
            OPEN RISK
          </Link>
          <div className="w-16" /> {/* Spacer for centering */}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-sm">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-black rounded-full flex items-center justify-center">
              <Lock className="w-7 h-7 sm:w-9 sm:h-9 text-white" />
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-xl sm:text-2xl font-bold text-black mb-2">커뮤니티 입장</h1>
            <p className="text-sm text-gray-700">
              회원 전용 공간입니다
            </p>
          </div>

          {/* Info Box */}
          <div className="border-t border-b border-gray-300 py-4 sm:py-5 mb-6 sm:mb-8">
            <div className="flex items-start gap-3 mb-3">
              <Users size={18} className="text-gray-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-black">상권 분석 커뮤니티</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  창업자, 자영업자들과 정보를 공유하세요
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MessageCircle size={18} className="text-gray-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-black">실시간 상권 이야기</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  현장의 생생한 경험담을 나눠보세요
                </p>
              </div>
            </div>
          </div>

          {/* Kakao Login Button */}
          <button
            onClick={handleKakaoLogin}
            disabled={isRedirecting}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 sm:py-4 bg-[#FEE500] hover:bg-[#FDD800] active:bg-[#FCCC00] transition-all font-medium text-sm sm:text-base text-black disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRedirecting ? (
              <>
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                <span>로그인 중...</span>
              </>
            ) : (
              <>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3C6.48 3 2 6.58 2 11c0 2.84 1.86 5.33 4.64 6.73-.14.52-.91 3.37-.94 3.58 0 0-.02.16.08.22.1.06.22.02.22.02.29-.04 3.37-2.2 3.9-2.57.69.1 1.4.15 2.1.15 5.52 0 10-3.58 10-8s-4.48-8-10-8z"/>
                </svg>
                <span>카카오로 시작하기</span>
              </>
            )}
          </button>

          {/* Sub text */}
          <p className="text-center text-[11px] text-gray-500 mt-4">
            로그인 시 서비스 이용약관에 동의하게 됩니다
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-300 py-4">
        <div className="text-center">
          <p className="text-[10px] sm:text-xs text-gray-600">
            공공데이터 기반 상권 분석 서비스
          </p>
        </div>
      </footer>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginHandler />
    </Suspense>
  )
}
