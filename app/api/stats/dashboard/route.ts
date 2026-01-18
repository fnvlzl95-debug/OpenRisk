import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    // 환경 변수 확인
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { success: false, error: '환경 변수 로드 실패' },
        { status: 500 }
      )
    }

    // Supabase 클라이언트 생성
    const supabase = createSupabaseClient(supabaseUrl, supabaseKey)

    // 한국 시간 기준 날짜 계산 (UTC+9)
    const kstOffset = 9 * 60 * 60 * 1000
    const kstNow = new Date(Date.now() + kstOffset)
    const today = kstNow.toISOString().split('T')[0]
    const weekAgo = new Date(kstNow.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // 병렬 쿼리 실행으로 성능 최적화
    const [
      totalResult,
      todayResult,
      weeklyResult,
      hourlyResult,
      pagesResult,
      referrerResult
    ] = await Promise.all([
      // 총 통계
      supabase
        .from('visitor_stats')
        .select('visit_count, unique_visitors')
        .eq('id', 'total')
        .single(),

      // 오늘 통계
      supabase
        .from('visitor_stats')
        .select('visit_count')
        .eq('id', today)
        .single(),

      // 주간 통계
      supabase
        .from('visitor_stats')
        .select('id, visit_count')
        .gte('id', weekAgo)
        .lte('id', today)
        .order('id', { ascending: false }),

      // 시간대별 트래픽 (최근 24시간)
      supabase
        .from('hourly_traffic')
        .select('*')
        .limit(24),

      // 인기 페이지 TOP 10
      supabase
        .from('popular_pages')
        .select('*')
        .limit(10),

      // 유입 경로 분석
      supabase
        .from('referrer_analysis')
        .select('*')
        .limit(10)
    ])

    return NextResponse.json(
      {
        success: true,
        stats: {
          total: totalResult.data?.visit_count || 0,
          today: todayResult.data?.visit_count || 0,
          weekly: weeklyResult.data || [],
          hourlyTraffic: hourlyResult.data || [],
          popularPages: pagesResult.data || [],
          referrers: referrerResult.data || []
        }
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
        }
      }
    )
  } catch (error) {
    console.error('대시보드 조회 오류:', error)
    return NextResponse.json(
      { success: false, error: '대시보드 조회 실패' },
      { status: 500 }
    )
  }
}
