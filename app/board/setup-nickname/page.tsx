'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

export default function SetupNicknamePage() {
  const router = useRouter()
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // 이미 닉네임이 있으면 게시판으로 이동
    const checkNickname = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/board')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', user.id)
        .single()

      // 닉네임이 이미 설정되어 있고 카카오 기본값이 아니면 게시판으로
      if (profile?.nickname && !profile.nickname.startsWith('kakao_')) {
        router.replace('/board')
        return
      }

      setChecking(false)
    }

    checkNickname()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const trimmed = nickname.trim()

    // 클라이언트 검증
    if (trimmed.length < 2) {
      setError('닉네임은 2자 이상이어야 합니다.')
      return
    }

    if (trimmed.length > 20) {
      setError('닉네임은 20자 이하여야 합니다.')
      return
    }

    // 특수문자 제한 (한글, 영문, 숫자, 밑줄만 허용)
    if (!/^[가-힣a-zA-Z0-9_]+$/.test(trimmed)) {
      setError('닉네임은 한글, 영문, 숫자, 밑줄(_)만 사용 가능합니다.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/board/profile/nickname', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: trimmed }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '닉네임 설정에 실패했습니다.')
        setLoading(false)
        return
      }

      // 성공 - 게시판으로 이동
      router.replace('/board')
    } catch {
      setError('오류가 발생했습니다. 다시 시도해주세요.')
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8]">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8] px-4 py-8">
      <div className="w-full max-w-sm sm:max-w-md bg-white p-6 sm:p-8 border-2 border-black">
        <h1 className="text-lg sm:text-xl font-bold text-center mb-1 sm:mb-2">닉네임 설정</h1>
        <p className="text-xs sm:text-sm text-gray-500 text-center mb-5 sm:mb-6">
          게시판에서 사용할 닉네임을 설정해주세요.
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="nickname" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
              닉네임
            </label>
            <input
              type="text"
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="2~20자, 한글/영문/숫자/밑줄"
              className="w-full px-3 py-2.5 sm:py-2 border-2 border-black text-sm sm:text-base focus:outline-none"
              maxLength={20}
              autoFocus
            />
            {error && (
              <p className="mt-1.5 text-xs text-red-500">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || nickname.trim().length < 2}
            className="w-full py-2.5 sm:py-2 bg-black text-white text-sm font-bold hover:bg-gray-800 active:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="animate-spin" size={16} />
                설정 중...
              </span>
            ) : (
              '설정 완료'
            )}
          </button>
        </form>

        <p className="mt-4 text-[10px] sm:text-xs text-gray-400 text-center">
          닉네임은 나중에 프로필에서 변경할 수 있습니다.
        </p>
      </div>
    </div>
  )
}
