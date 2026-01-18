'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, TrendingUp, Users, Calendar } from 'lucide-react'

interface DashboardStats {
  total: number
  today: number
  weekly: Array<{
    id: string
    visit_count: number
  }>
  hourlyTraffic: Array<{
    hour: string
    unique_visitors: number
    total_visits: number
  }>
  popularPages: Array<{
    page_path: string
    unique_visitors: number
    total_views: number
    last_visited: string
  }>
  referrers: Array<{
    source: string
    unique_visitors: number
    total_visits: number
  }>
}

export default function StatsAdminPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadStats = async () => {
      try {
        const res = await fetch('/api/stats/dashboard')
        const data = await res.json()

        if (data.success) {
          setStats(data.stats)
        }
      } catch (error) {
        console.error('통계 조회 실패:', error)
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8]">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8]">
        <p className="text-gray-600 text-sm">통계를 불러올 수 없습니다.</p>
      </div>
    )
  }

  // 주간 평균 계산
  const weeklyAverage = stats.weekly.length > 0
    ? Math.round(stats.weekly.reduce((sum, day) => sum + day.visit_count, 0) / stats.weekly.length)
    : 0

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      {/* 헤더 */}
      <header className="border-b-2 border-black sticky top-0 bg-[#FAFAF8] z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/board" className="text-gray-700 hover:text-black transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-lg font-bold text-gray-900">방문자 통계 대시보드</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* 총 방문자 */}
          <div className="bg-white border-2 border-black p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Users className="text-blue-600" size={20} />
              </div>
              <h3 className="text-sm font-semibold text-gray-600">총 방문자</h3>
            </div>
            <p className="text-3xl font-bold text-blue-600">{stats.total.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">전체 누적 방문 횟수</p>
          </div>

          {/* 오늘 방문자 */}
          <div className="bg-white border-2 border-black p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Calendar className="text-green-600" size={20} />
              </div>
              <h3 className="text-sm font-semibold text-gray-600">오늘 방문자</h3>
            </div>
            <p className="text-3xl font-bold text-green-600">{stats.today.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">금일 방문 횟수</p>
          </div>

          {/* 주간 평균 */}
          <div className="bg-white border-2 border-black p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <TrendingUp className="text-purple-600" size={20} />
              </div>
              <h3 className="text-sm font-semibold text-gray-600">주간 평균</h3>
            </div>
            <p className="text-3xl font-bold text-purple-600">{weeklyAverage.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">일평균 방문 횟수 (7일)</p>
          </div>
        </div>

        {/* 주간 통계 테이블 */}
        <div className="bg-white border-2 border-black">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-base font-bold text-gray-900">최근 7일 방문자 추이</h2>
            <p className="text-xs text-gray-500 mt-1">일별 방문 횟수를 확인할 수 있습니다</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    날짜
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    방문자 수
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    비율
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stats.weekly.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-8 text-center text-sm text-gray-500">
                      아직 데이터가 없습니다
                    </td>
                  </tr>
                ) : (
                  stats.weekly.map((day, index) => {
                    const maxCount = Math.max(...stats.weekly.map(d => d.visit_count))
                    const percentage = maxCount > 0 ? (day.visit_count / maxCount) * 100 : 0
                    const isToday = day.id === new Date().toISOString().split('T')[0]

                    return (
                      <tr key={day.id} className={isToday ? 'bg-blue-50' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900">
                              {new Date(day.id).toLocaleDateString('ko-KR', {
                                month: 'long',
                                day: 'numeric',
                                weekday: 'short'
                              })}
                            </span>
                            {isToday && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold text-blue-600 bg-blue-100 rounded">
                                TODAY
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-sm font-bold text-gray-900">
                            {day.visit_count.toLocaleString()}
                          </span>
                          <span className="text-xs text-gray-500 ml-1">명</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-24 bg-gray-200 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-blue-600 h-2 rounded-full transition-all"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600 w-12 text-right">
                              {percentage.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 푸터 정보 */}
          {stats.weekly.length > 0 && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span>
                  총 <span className="font-bold text-gray-900">{stats.weekly.length}</span>일 데이터
                </span>
                <span>
                  최고: <span className="font-bold text-gray-900">
                    {Math.max(...stats.weekly.map(d => d.visit_count)).toLocaleString()}명
                  </span>
                  {' / '}
                  최저: <span className="font-bold text-gray-900">
                    {Math.min(...stats.weekly.map(d => d.visit_count)).toLocaleString()}명
                  </span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 시간대별 트래픽 */}
        {stats.hourlyTraffic && stats.hourlyTraffic.length > 0 && (
          <div className="mt-8 bg-white border-2 border-black">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-bold text-gray-900">시간대별 트래픽 (최근 24시간)</h2>
              <p className="text-xs text-gray-500 mt-1">시간당 방문자 추이를 확인할 수 있습니다</p>
            </div>
            <div className="p-6">
              <div className="space-y-2">
                {stats.hourlyTraffic.slice(0, 12).map((traffic) => {
                  const maxVisits = Math.max(...stats.hourlyTraffic.map(t => t.total_visits))
                  const percentage = maxVisits > 0 ? (traffic.total_visits / maxVisits) * 100 : 0
                  const hourStr = new Date(traffic.hour).toLocaleString('ko-KR', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })

                  return (
                    <div key={traffic.hour} className="flex items-center gap-3">
                      <span className="text-xs text-gray-600 w-32 flex-shrink-0">{hourStr}</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-6 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-blue-600 h-6 rounded-full flex items-center justify-end pr-2 transition-all"
                          style={{ width: `${Math.max(percentage, 5)}%` }}
                        >
                          {traffic.total_visits > 0 && (
                            <span className="text-[10px] font-bold text-white">
                              {traffic.total_visits}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 w-16 text-right">
                        {traffic.unique_visitors}명
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* 인기 페이지 TOP 10 */}
        {stats.popularPages && stats.popularPages.length > 0 && (
          <div className="mt-8 bg-white border-2 border-black">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-bold text-gray-900">인기 페이지 TOP 10</h2>
              <p className="text-xs text-gray-500 mt-1">최근 30일 기준 가장 많이 방문한 페이지</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      순위
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      페이지
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      총 조회수
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      고유 방문자
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {stats.popularPages.map((page, index) => (
                    <tr key={page.page_path} className={index < 3 ? 'bg-yellow-50' : ''}>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span className={`text-sm font-bold ${
                          index === 0 ? 'text-yellow-600' :
                          index === 1 ? 'text-gray-500' :
                          index === 2 ? 'text-orange-600' :
                          'text-gray-400'
                        }`}>
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <span className="text-sm text-gray-900 font-mono">{page.page_path}</span>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-right">
                        <span className="text-sm font-bold text-gray-900">
                          {page.total_views.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-right">
                        <span className="text-sm text-gray-600">
                          {page.unique_visitors.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 유입 경로 분석 */}
        {stats.referrers && stats.referrers.length > 0 && (
          <div className="mt-8 bg-white border-2 border-black">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-bold text-gray-900">유입 경로 분석</h2>
              <p className="text-xs text-gray-500 mt-1">방문자들이 어디에서 유입되었는지 확인할 수 있습니다</p>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {stats.referrers.map((referrer) => {
                  const maxVisits = Math.max(...stats.referrers.map(r => r.total_visits))
                  const percentage = maxVisits > 0 ? (referrer.total_visits / maxVisits) * 100 : 0

                  return (
                    <div key={referrer.source} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">{referrer.source}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">
                            {referrer.unique_visitors}명
                          </span>
                          <span className="text-sm font-bold text-gray-900">
                            {referrer.total_visits.toLocaleString()}회
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-purple-500 to-purple-600 h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* 주간 트렌드 차트 */}
        {stats.weekly && stats.weekly.length > 0 && (
          <div className="mt-8 bg-white border-2 border-black">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-bold text-gray-900">주간 트렌드</h2>
              <p className="text-xs text-gray-500 mt-1">일별 방문자 변화 추이</p>
            </div>
            <div className="p-6">
              <div className="flex items-end justify-between gap-2 h-48">
                {stats.weekly.slice().reverse().map((day) => {
                  const maxCount = Math.max(...stats.weekly.map(d => d.visit_count))
                  const height = maxCount > 0 ? (day.visit_count / maxCount) * 100 : 0
                  const isToday = day.id === new Date().toISOString().split('T')[0]

                  return (
                    <div key={day.id} className="flex-1 flex flex-col items-center gap-2">
                      <div className="relative w-full flex items-end justify-center h-40">
                        <div
                          className={`w-full rounded-t transition-all ${
                            isToday ? 'bg-gradient-to-t from-blue-600 to-blue-400' : 'bg-gradient-to-t from-gray-400 to-gray-300'
                          }`}
                          style={{ height: `${height}%`, minHeight: day.visit_count > 0 ? '8px' : '0' }}
                        >
                          {day.visit_count > 0 && (
                            <div className="absolute -top-6 left-0 right-0 text-center">
                              <span className="text-[10px] font-bold text-gray-900">
                                {day.visit_count}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-[10px] text-gray-600">
                          {new Date(day.id).toLocaleDateString('ko-KR', {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                        {isToday && (
                          <div className="text-[9px] font-bold text-blue-600">TODAY</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* 안내 메시지 */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
          <p className="text-xs text-blue-800">
            💡 <span className="font-semibold">쿠키 기반 중복 방지:</span> 같은 방문자는 하루에 한 번만 카운트됩니다.
            데이터는 실시간으로 수집되며, 상세 분석 정보가 표시됩니다.
          </p>
        </div>
      </main>
    </div>
  )
}
