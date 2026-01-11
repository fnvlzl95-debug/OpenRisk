'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Loader2, Check, User } from 'lucide-react'

interface Profile {
  nickname: string
  profile_image: string | null
  is_admin: boolean
  created_at: string
}

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [nickname, setNickname] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const loadProfile = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/board')
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('nickname, profile_image, is_admin, created_at')
        .eq('id', user.id)
        .single()

      if (data) {
        setProfile(data)
        setNickname(data.nickname)
      }
      setLoading(false)
    }

    loadProfile()
  }, [router])

  const handleSave = async () => {
    setError('')
    setSuccess(false)

    const trimmed = nickname.trim()

    if (trimmed === profile?.nickname) {
      setEditing(false)
      return
    }

    // 클라이언트 검증
    if (trimmed.length < 2) {
      setError('닉네임은 2자 이상이어야 합니다.')
      return
    }

    if (trimmed.length > 20) {
      setError('닉네임은 20자 이하여야 합니다.')
      return
    }

    if (!/^[가-힣a-zA-Z0-9_]+$/.test(trimmed)) {
      setError('닉네임은 한글, 영문, 숫자, 밑줄(_)만 사용 가능합니다.')
      return
    }

    setSaving(true)

    try {
      const res = await fetch('/api/board/profile/nickname', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: trimmed }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '닉네임 변경에 실패했습니다.')
        setSaving(false)
        return
      }

      setProfile(prev => prev ? { ...prev, nickname: trimmed } : null)
      setEditing(false)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      setError('오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setNickname(profile?.nickname || '')
    setEditing(false)
    setError('')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8]">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8]">
        <p className="text-gray-600 text-sm">프로필을 불러올 수 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* 헤더 */}
      <header className="border-b-2 border-black sticky top-0 bg-[#FAFAF8] z-50">
        <div className="max-w-2xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center gap-3 sm:gap-4">
          <Link href="/board" className="text-gray-700 hover:text-black transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-base sm:text-lg font-bold text-gray-900">내 프로필</h1>
        </div>
      </header>

      {/* 프로필 카드 */}
      <main className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <div className="bg-white border-2 border-black p-4 sm:p-8">
          {/* 프로필 이미지 & 기본 정보 */}
          <div className="flex items-center gap-3 sm:gap-5 mb-5 sm:mb-8 pb-5 sm:pb-8 border-b border-gray-200">
            {profile.profile_image ? (
              <img
                src={profile.profile_image}
                alt={profile.nickname}
                className="w-14 h-14 sm:w-20 sm:h-20 rounded-full border border-gray-200"
              />
            ) : (
              <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200">
                <User size={28} className="text-gray-400 sm:hidden" />
                <User size={36} className="text-gray-400 hidden sm:block" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-bold text-base sm:text-xl text-gray-900 truncate">{profile.nickname}</p>
              {profile.is_admin && (
                <span className="inline-block mt-0.5 sm:mt-1 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium text-red-600 bg-red-50 rounded">관리자</span>
              )}
              <p className="text-[11px] sm:text-sm text-gray-500 mt-1 sm:mt-2">
                가입일: {new Date(profile.created_at).toLocaleDateString('ko-KR')}
              </p>
            </div>
          </div>

          {/* 닉네임 수정 섹션 */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-2 sm:mb-3">
              닉네임 변경
            </label>

            {editing ? (
              <div>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 border-2 border-black text-sm sm:text-base text-gray-900 focus:outline-none mb-2 sm:mb-3"
                  maxLength={20}
                  autoFocus
                  placeholder="새 닉네임 입력"
                />
                {error && (
                  <p className="text-xs sm:text-sm text-red-600 mb-2 sm:mb-3">{error}</p>
                )}
                <div className="flex gap-2 sm:gap-3">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 sm:px-5 py-2 sm:py-2.5 bg-black text-white text-xs sm:text-sm font-bold hover:bg-gray-800 active:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    {saving ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="animate-spin" size={14} />
                        저장 중...
                      </span>
                    ) : (
                      '저장'
                    )}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="px-4 sm:px-5 py-2 sm:py-2.5 border border-gray-300 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 disabled:cursor-not-allowed transition-colors"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between py-2.5 sm:py-3 px-3 sm:px-4 bg-gray-50 border border-gray-200">
                <span className="text-sm sm:text-base text-gray-900 font-medium truncate">{profile.nickname}</span>
                <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                  {success && (
                    <span className="flex items-center gap-1 text-[11px] sm:text-sm text-green-600 font-medium">
                      <Check size={14} />
                      <span className="hidden sm:inline">저장됨</span>
                    </span>
                  )}
                  <button
                    onClick={() => setEditing(true)}
                    className="px-3 sm:px-4 py-1.5 sm:py-2 bg-white border border-gray-300 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  >
                    변경
                  </button>
                </div>
              </div>
            )}

            <p className="mt-2 sm:mt-3 text-[10px] sm:text-sm text-gray-500">
              2~20자, 한글/영문/숫자/밑줄(_) 사용 가능
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
