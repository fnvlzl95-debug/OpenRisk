'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Post {
  id: number
  title: string
  view_count: number
  created_at: string
}

interface EditState {
  [key: number]: number
}

type SortType = 'latest' | 'views'

export default function AdminViewsPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [editValues, setEditValues] = useState<EditState>({})
  const [saving, setSaving] = useState<number | null>(null)
  const [saved, setSaved] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<SortType>('latest')

  useEffect(() => {
    let isActive = true

    const fetchPosts = async () => {
      const supabase = createClient()
      let query = supabase
        .from('posts')
        .select('id, title, view_count, created_at')

      // 삭제되지 않은 게시글만 조회
      query = query.is('deleted_at', null)

      if (sortBy === 'latest') {
        query = query.order('created_at', { ascending: false })
      } else {
        query = query.order('view_count', { ascending: false })
      }

      const { data } = await query.limit(50)

      if (!isActive) {
        return
      }

      setPosts(data || [])
      const initialEdit: EditState = {}
      data?.forEach(p => { initialEdit[p.id] = p.view_count })
      setEditValues(initialEdit)
      setLoading(false)
    }

    void fetchPosts()

    return () => {
      isActive = false
    }
  }, [sortBy])

  const handleChange = (postId: number, value: number | string) => {
    // 빈 문자열이면 0으로 설정 (입력 중 삭제 허용)
    const numValue = value === '' ? 0 : typeof value === 'string' ? parseInt(value) || 0 : value
    setEditValues(prev => ({ ...prev, [postId]: numValue }))
  }

  const handleInputChange = (postId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // 빈 문자열 허용, 숫자만 입력
    if (value === '' || /^\d+$/.test(value)) {
      setEditValues(prev => ({ ...prev, [postId]: value === '' ? 0 : parseInt(value) }))
    }
  }

  const handleSave = async (postId: number) => {
    const newCount = editValues[postId]
    if (newCount < 0) return

    setSaving(postId)
    try {
      const res = await fetch('/api/admin/views', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, viewCount: newCount })
      })

      if (res.ok) {
        setPosts(posts.map(p => p.id === postId ? { ...p, view_count: newCount } : p))
        setSaved(postId)
        setTimeout(() => setSaved(null), 1500)
      }
    } catch (error) {
      console.error('Save error:', error)
    }
    setSaving(null)
  }

  const isChanged = (postId: number) => {
    const post = posts.find(p => p.id === postId)
    return post && editValues[postId] !== post.view_count
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">조회수 관리</h1>
          <Link href="/ops-9f2" className="text-xs sm:text-sm text-blue-600 hover:underline">
            ← 관리자 메뉴
          </Link>
        </div>

        {/* 정렬 옵션 */}
        <div className="flex gap-1.5 mb-3 sm:mb-4">
          {[
            { key: 'latest', label: '최신순' },
            { key: 'views', label: '조회순' },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key as SortType)}
              className={`px-2.5 py-1 text-[10px] sm:text-xs rounded transition-colors ${
                sortBy === opt.key
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 모바일: 컴팩트 리스트 */}
        <div className="sm:hidden space-y-2">
          {posts.map((post) => (
            <div key={post.id} className="bg-white rounded-lg shadow p-2.5">
              <div className="flex items-center gap-2">
                {/* 제목 */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">
                    <span className="text-gray-400">#{post.id}</span> {post.title}
                  </p>
                </div>
                {/* 현재 조회수 */}
                <span className="text-sm font-semibold text-gray-600 whitespace-nowrap">{post.view_count}</span>
              </div>

              <div className="flex items-center gap-1.5 mt-2">
                <button
                  onClick={() => handleChange(post.id, (editValues[post.id] || 0) - 10)}
                  className="px-2 py-1 bg-gray-200 text-gray-900 rounded text-[10px] font-medium active:bg-gray-300"
                >
                  -10
                </button>
                <button
                  onClick={() => handleChange(post.id, (editValues[post.id] || 0) - 1)}
                  className="px-2 py-1 bg-gray-200 text-gray-900 rounded text-[10px] font-medium active:bg-gray-300"
                >
                  -1
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  value={editValues[post.id] ?? post.view_count}
                  onChange={(e) => handleInputChange(post.id, e)}
                  onFocus={(e) => e.target.select()}
                  className="w-14 py-1 border rounded text-center text-gray-900 text-xs"
                />
                <button
                  onClick={() => handleChange(post.id, (editValues[post.id] || 0) + 1)}
                  className="px-2 py-1 bg-gray-200 text-gray-900 rounded text-[10px] font-medium active:bg-gray-300"
                >
                  +1
                </button>
                <button
                  onClick={() => handleChange(post.id, (editValues[post.id] || 0) + 10)}
                  className="px-2 py-1 bg-gray-200 text-gray-900 rounded text-[10px] font-medium active:bg-gray-300"
                >
                  +10
                </button>
                {saved === post.id ? (
                  <span className="text-green-600 text-[10px] font-medium ml-auto">✓</span>
                ) : (
                  <button
                    onClick={() => handleSave(post.id)}
                    disabled={!isChanged(post.id) || saving === post.id}
                    className={`ml-auto px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                      isChanged(post.id)
                        ? 'bg-blue-500 text-white active:bg-blue-600'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {saving === post.id ? '...' : '적용'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 데스크톱: 테이블 레이아웃 */}
        <div className="hidden sm:block bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-gray-700">ID</th>
                <th className="px-4 py-3 text-left text-gray-700">제목</th>
                <th className="px-4 py-3 text-center text-gray-700">현재</th>
                <th className="px-4 py-3 text-center text-gray-700">변경</th>
                <th className="px-4 py-3 text-center text-gray-700">적용</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {posts.map((post) => (
                <tr key={post.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{post.id}</td>
                  <td className="px-4 py-3 truncate max-w-[200px] text-gray-900">{post.title}</td>
                  <td className="px-4 py-3 text-center text-gray-500">{post.view_count}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleChange(post.id, (editValues[post.id] || 0) - 10)}
                        className="px-2 py-1 bg-gray-200 text-gray-900 rounded hover:bg-gray-300 text-xs"
                      >
                        -10
                      </button>
                      <button
                        onClick={() => handleChange(post.id, (editValues[post.id] || 0) - 1)}
                        className="px-2 py-1 bg-gray-200 text-gray-900 rounded hover:bg-gray-300 text-xs"
                      >
                        -1
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editValues[post.id] ?? post.view_count}
                        onChange={(e) => handleInputChange(post.id, e)}
                        onFocus={(e) => e.target.select()}
                        className="w-16 px-2 py-1 border rounded text-center text-gray-900 text-sm"
                      />
                      <button
                        onClick={() => handleChange(post.id, (editValues[post.id] || 0) + 1)}
                        className="px-2 py-1 bg-gray-200 text-gray-900 rounded hover:bg-gray-300 text-xs"
                      >
                        +1
                      </button>
                      <button
                        onClick={() => handleChange(post.id, (editValues[post.id] || 0) + 10)}
                        className="px-2 py-1 bg-gray-200 text-gray-900 rounded hover:bg-gray-300 text-xs"
                      >
                        +10
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {saved === post.id ? (
                      <span className="text-green-600 text-xs font-medium">저장됨 ✓</span>
                    ) : (
                      <button
                        onClick={() => handleSave(post.id)}
                        disabled={!isChanged(post.id) || saving === post.id}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                          isChanged(post.id)
                            ? 'bg-blue-500 text-white hover:bg-blue-600'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {saving === post.id ? '저장중...' : '적용'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
