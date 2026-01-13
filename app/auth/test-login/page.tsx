'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// 비공개 테스트 로그인 페이지
// URL: /auth/test-login?key=openrisk2025
export default function TestLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [nickname, setNickname] = useState('')

  // URL 파라미터로 접근 제한
  const isAuthorized = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('key') === 'openrisk2025'

  if (typeof window !== 'undefined' && !isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-500">접근 권한이 없습니다.</p>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()

    try {
      if (mode === 'signup') {
        // 회원가입
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        })

        if (signUpError) throw signUpError

        if (data.user) {
          // 프로필 생성
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              kakao_id: `test_${Date.now()}`,
              nickname: nickname || `테스트유저_${Date.now().toString().slice(-4)}`,
              is_admin: false
            })

          if (profileError) {
            console.error('Profile creation error:', profileError)
          }
        }

        alert('테스트 계정이 생성되었습니다. 로그인해주세요.')
        setMode('login')
      } else {
        // 로그인
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (signInError) throw signInError

        router.push('/board')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-sm bg-white p-6 border-2 border-black">
        <h1 className="text-lg font-bold text-center mb-1">테스트 계정</h1>
        <p className="text-xs text-gray-500 text-center mb-4">
          개발/테스트 전용 로그인
        </p>

        <div className="flex mb-4 border-b border-gray-200">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-2 text-sm font-medium ${
              mode === 'login'
                ? 'text-black border-b-2 border-black'
                : 'text-gray-400'
            }`}
          >
            로그인
          </button>
          <button
            onClick={() => setMode('signup')}
            className={`flex-1 py-2 text-sm font-medium ${
              mode === 'signup'
                ? 'text-black border-b-2 border-black'
                : 'text-gray-400'
            }`}
          >
            계정 생성
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              이메일
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="test@example.com"
              className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-black"
              required
            />
          </div>

          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6자 이상"
              className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-black"
              minLength={6}
              required
            />
          </div>

          {mode === 'signup' && (
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                닉네임
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="게시판에 표시될 이름"
                className="w-full px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-black"
              />
            </div>
          )}

          {error && (
            <p className="text-xs text-red-500 mb-3">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-black text-white text-sm font-bold hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading
              ? '처리 중...'
              : mode === 'login'
                ? '로그인'
                : '계정 생성'
            }
          </button>
        </form>

        <p className="mt-4 text-[10px] text-gray-400 text-center">
          이 페이지는 테스트 목적으로만 사용됩니다.
        </p>
      </div>
    </div>
  )
}
