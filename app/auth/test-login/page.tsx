'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// 비공개 테스트 로그인 페이지
// URL: /auth/test-login?key=openrisk2025
export default function TestLoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
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

  // 아이디로 가짜 이메일 생성
  const toEmail = (id: string) => `${id}@openrisk.test`

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const email = toEmail(username.trim().toLowerCase())

    try {
      if (mode === 'signup') {
        if (!nickname.trim()) {
          setError('닉네임을 입력해주세요.')
          setLoading(false)
          return
        }

        // 회원가입
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        })

        if (signUpError) {
          if (signUpError.message.includes('already registered')) {
            throw new Error('이미 사용 중인 아이디입니다.')
          }
          throw signUpError
        }

        // 이미 존재하는 유저인 경우 (identities가 비어있음)
        if (!data.user || data.user.identities?.length === 0) {
          throw new Error('이미 사용 중인 아이디입니다.')
        }

        // 프로필 생성
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            kakao_id: `test_${username}`,
            nickname: nickname.trim(),
            is_admin: false
          })

        if (profileError) {
          console.error('Profile creation error:', profileError)
          if (profileError.message.includes('duplicate') || profileError.message.includes('unique')) {
            throw new Error('이미 사용 중인 닉네임입니다.')
          }
          throw new Error('프로필 생성에 실패했습니다.')
        }

        alert('계정이 생성되었습니다!')
        setMode('login')
      } else {
        // 로그인
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (signInError) {
          if (signInError.message.includes('Invalid login')) {
            throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.')
          }
          throw signInError
        }

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
        <h1 className="text-lg font-bold text-center mb-1 text-black">테스트 계정</h1>
        <p className="text-xs text-gray-500 text-center mb-4">
          개발/테스트 전용 로그인
        </p>

        <div className="flex mb-4 border-b border-gray-200">
          <button
            type="button"
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
            type="button"
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
              아이디
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="영문, 숫자 조합"
              className="w-full px-3 py-2 border border-gray-300 text-sm text-black focus:outline-none focus:border-black"
              pattern="[a-zA-Z0-9_]+"
              minLength={3}
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
              className="w-full px-3 py-2 border border-gray-300 text-sm text-black focus:outline-none focus:border-black"
              minLength={6}
              required
            />
          </div>

          {mode === 'signup' && (
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                닉네임 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="게시판에 표시될 이름"
                className="w-full px-3 py-2 border border-gray-300 text-sm text-black focus:outline-none focus:border-black"
                required
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
