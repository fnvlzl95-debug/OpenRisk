'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Loader2, TrendingUp, Users, Calendar, Clock, FileText, Share2, BarChart3 } from 'lucide-react'

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin text-blue-600 mx-auto" size={48} />
          <p className="text-sm text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center space-y-4">
          <p className="text-gray-600 text-base">통계를 불러올 수 없습니다.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  const weeklyAverage = stats.weekly.length > 0
    ? Math.round(stats.weekly.reduce((sum, day) => sum + day.visit_count, 0) / stats.weekly.length)
    : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">방문자 통계</h1>
            <Link href="/ops-9f2" className="text-xs sm:text-sm text-blue-600 hover:underline">
              ← 관리자 메뉴
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6 lg:py-8 space-y-3 sm:space-y-6">
        {/* 주요 지표 카드 */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:gap-6">
          <StatCard
            icon={<Users className="text-blue-600" size={24} />}
            title="총 방문자"
            value={stats.total.toLocaleString()}
            subtitle="전체 누적 방문"
            bgColor="bg-blue-50"
            iconBgColor="bg-blue-100"
          />
          <StatCard
            icon={<Calendar className="text-green-600" size={24} />}
            title="오늘 방문자"
            value={stats.today.toLocaleString()}
            subtitle="금일 방문 횟수"
            bgColor="bg-green-50"
            iconBgColor="bg-green-100"
          />
          <StatCard
            icon={<TrendingUp className="text-purple-600" size={24} />}
            title="주간 평균"
            value={weeklyAverage.toLocaleString()}
            subtitle="일평균 (최근 7일)"
            bgColor="bg-purple-50"
            iconBgColor="bg-purple-100"
          />
        </div>

        {/* 주간 트렌드 차트 */}
        <ChartCard title="주간 트렌드" subtitle="일별 방문자 변화 추이" icon={<BarChart3 size={20} />}>
          <div className="flex items-end justify-between gap-1 sm:gap-2 h-48 sm:h-56 lg:h-64">
            {stats.weekly.slice().reverse().map((day) => {
              const maxCount = Math.max(...stats.weekly.map(d => d.visit_count))
              const height = maxCount > 0 ? (day.visit_count / maxCount) * 100 : 0
              const isToday = day.id === new Date().toISOString().split('T')[0]

              return (
                <div key={day.id} className="flex-1 flex flex-col items-center gap-1 sm:gap-1.5 min-w-0">
                  <div className="relative w-full flex items-end justify-center h-40 sm:h-48 lg:h-56">
                    <div
                      className={`w-full rounded-t-lg transition-all shadow-sm ${
                        isToday
                          ? 'bg-gradient-to-t from-blue-600 via-blue-500 to-blue-400'
                          : 'bg-gradient-to-t from-gray-400 via-gray-300 to-gray-200'
                      }`}
                      style={{ height: `${height}%`, minHeight: day.visit_count > 0 ? '10px' : '0' }}
                    >
                      {day.visit_count > 0 && (
                        <div className="absolute -top-5 sm:-top-6 left-0 right-0 text-center">
                          <span className="text-[9px] sm:text-[10px] lg:text-xs font-bold text-gray-900 bg-white/80 backdrop-blur-sm px-1 sm:px-1.5 py-0.5 rounded">
                            {day.visit_count}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-center w-full">
                    <div className="text-[9px] sm:text-[10px] lg:text-xs text-gray-600 truncate">
                      {new Date(day.id).toLocaleDateString('ko-KR', {
                        month: 'short',
                        day: 'numeric'
                      })}
                    </div>
                    {isToday && (
                      <div className="text-[7px] sm:text-[8px] lg:text-[9px] font-bold text-blue-600">TODAY</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </ChartCard>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
          {/* 인기 페이지 */}
          <ChartCard title="인기 페이지" subtitle="최근 30일 TOP 10" icon={<FileText size={20} />}>
            {stats.popularPages && stats.popularPages.length > 0 ? (
              <div className="space-y-2 sm:space-y-2.5">
                {stats.popularPages.slice(0, 10).map((page, index) => {
                  const maxViews = Math.max(...stats.popularPages.map(p => p.total_views))
                  const percentage = maxViews > 0 ? (page.total_views / maxViews) * 100 : 0

                  return (
                    <div key={page.page_path} className="space-y-1 sm:space-y-1.5">
                      <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                          <span className={`flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold ${
                            index === 0 ? 'bg-yellow-100 text-yellow-700' :
                            index === 1 ? 'bg-gray-200 text-gray-700' :
                            index === 2 ? 'bg-orange-100 text-orange-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {index + 1}
                          </span>
                          <span className="text-xs sm:text-sm text-gray-900 font-mono truncate">{page.page_path}</span>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <div className="text-xs sm:text-sm font-bold text-gray-900">{page.total_views.toLocaleString()}</div>
                          <div className="text-[10px] sm:text-xs text-gray-500">{page.unique_visitors}명</div>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-blue-600 h-1.5 sm:h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState message="데이터가 수집되는 중입니다" />
            )}
          </ChartCard>

          {/* 유입 경로 */}
          <ChartCard title="유입 경로" subtitle="트래픽 소스 분석" icon={<Share2 size={20} />}>
            {stats.referrers && stats.referrers.length > 0 ? (
              <div className="space-y-2 sm:space-y-2.5">
                {stats.referrers.map((referrer) => {
                  const maxVisits = Math.max(...stats.referrers.map(r => r.total_visits))
                  const percentage = maxVisits > 0 ? (referrer.total_visits / maxVisits) * 100 : 0

                  return (
                    <div key={referrer.source} className="space-y-1 sm:space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs sm:text-sm font-medium text-gray-900 truncate flex-1">{referrer.source}</span>
                        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                          <span className="text-[10px] sm:text-xs text-gray-500">{referrer.unique_visitors}명</span>
                          <span className="text-xs sm:text-sm font-bold text-gray-900">{referrer.total_visits.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-purple-500 to-purple-600 h-1.5 sm:h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState message="유입 경로 데이터가 없습니다" />
            )}
          </ChartCard>
        </div>

        {/* 시간대별 트래픽 */}
        <ChartCard title="시간대별 트래픽" subtitle="최근 24시간 활동" icon={<Clock size={20} />}>
          {stats.hourlyTraffic && stats.hourlyTraffic.length > 0 ? (
            <div className="space-y-1.5 sm:space-y-2">
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
                  <div key={traffic.hour} className="flex items-center gap-2 sm:gap-3">
                    <span className="text-[10px] sm:text-xs text-gray-600 w-20 sm:w-24 lg:w-32 flex-shrink-0">{hourStr}</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-5 sm:h-6 lg:h-7 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-5 sm:h-6 lg:h-7 rounded-full flex items-center justify-end pr-2 sm:pr-3 transition-all"
                        style={{ width: `${Math.max(percentage, 8)}%` }}
                      >
                        {traffic.total_visits > 0 && (
                          <span className="text-[10px] sm:text-xs font-bold text-white">
                            {traffic.total_visits}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] sm:text-xs text-gray-500 w-10 sm:w-12 lg:w-16 text-right flex-shrink-0">
                      {traffic.unique_visitors}명
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState message="시간대별 데이터가 없습니다" />
          )}
        </ChartCard>

        {/* 안내 메시지 */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg sm:rounded-xl p-3 sm:p-4 lg:p-6">
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-sm sm:text-base lg:text-lg">💡</span>
            </div>
            <div className="flex-1 space-y-0.5 sm:space-y-1">
              <p className="text-xs sm:text-sm font-semibold text-blue-900">데이터 수집 정보</p>
              <p className="text-[10px] sm:text-xs text-blue-800 leading-relaxed">
                쿠키 기반 중복 방지로 같은 방문자는 하루에 한 번만 카운트됩니다.
                모든 데이터는 실시간으로 수집되며, 개인정보는 해시 처리되어 안전하게 보관됩니다.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

// 통계 카드 컴포넌트
function StatCard({
  icon,
  title,
  value,
  subtitle,
  bgColor,
  iconBgColor
}: {
  icon: React.ReactNode
  title: string
  value: string
  subtitle: string
  bgColor: string
  iconBgColor: string
}) {
  return (
    <div className={`${bgColor} rounded-lg sm:rounded-xl p-3 sm:p-4 lg:p-6 shadow-sm border border-gray-200`}>
      <div className="flex items-start justify-between mb-2 sm:mb-3">
        <div className={`${iconBgColor} p-2 sm:p-2.5 lg:p-3 rounded-lg`}>
          <div className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6">
            {icon}
          </div>
        </div>
      </div>
      <div className="space-y-0.5 sm:space-y-1">
        <h3 className="text-xs sm:text-sm font-medium text-gray-600">{title}</h3>
        <p className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-gray-900">{value}</p>
        <p className="text-[10px] sm:text-xs text-gray-500">{subtitle}</p>
      </div>
    </div>
  )
}

// 차트 카드 컴포넌트
function ChartCard({
  title,
  subtitle,
  icon,
  children
}: {
  title: string
  subtitle: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-3 sm:px-4 lg:px-6 py-2.5 sm:py-3 lg:py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="text-gray-600 w-4 h-4 sm:w-5 sm:h-5">{icon}</div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-gray-900">{title}</h2>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">{subtitle}</p>
          </div>
        </div>
      </div>
      <div className="p-3 sm:p-4 lg:p-6">
        {children}
      </div>
    </div>
  )
}

// 빈 상태 컴포넌트
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 sm:py-8 lg:py-12 text-center">
      <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3 sm:mb-4">
        <BarChart3 className="text-gray-400" size={24} />
      </div>
      <p className="text-xs sm:text-sm text-gray-500">{message}</p>
    </div>
  )
}
