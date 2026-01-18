import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    // 직접 환경 변수 확인
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    console.log('[Dashboard API] URL exists:', !!supabaseUrl)
    console.log('[Dashboard API] Key exists:', !!supabaseKey)

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        {
          success: false,
          error: '환경 변수 로드 실패',
          debug: {
            url: !!supabaseUrl,
            key: !!supabaseKey
          }
        },
        { status: 500 }
      )
    }

    // 직접 Supabase 클라이언트 생성
    const supabase = createSupabaseClient(supabaseUrl, supabaseKey)

    // 한국 시간 기준으로 날짜 계산 (UTC+9)
    const kstOffset = 9 * 60 * 60 * 1000
    const kstNow = new Date(Date.now() + kstOffset)
    const today = kstNow.toISOString().split('T')[0]
    const weekAgo = new Date(kstNow.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    console.log('[Dashboard API] today:', today, 'weekAgo:', weekAgo)

    // 총 통계
    const { data: total } = await supabase
      .from('visitor_stats')
      .select('visit_count, unique_visitors')
      .eq('id', 'total')
      .single()

    // 오늘 통계
    const { data: todayStats } = await supabase
      .from('visitor_stats')
      .select('visit_count')
      .eq('id', today)
      .single()

    // 주간 통계
    const { data: weeklyData } = await supabase
      .from('visitor_stats')
      .select('id, visit_count')
      .gte('id', weekAgo)
      .lte('id', today)
      .order('id', { ascending: false })

    // 시간대별 트래픽 (최근 24시간)
    const { data: hourlyTraffic } = await supabase
      .from('hourly_traffic')
      .select('*')
      .limit(24)

    // 인기 페이지 TOP 10
    const { data: popularPages } = await supabase
      .from('popular_pages')
      .select('*')
      .limit(10)

    // 유입 경로 분석
    const { data: referrerData } = await supabase
      .from('referrer_analysis')
      .select('*')
      .limit(10)

    return NextResponse.json({
      success: true,
      stats: {
        total: total?.visit_count || 0,
        today: todayStats?.visit_count || 0,
        weekly: weeklyData || [],
        hourlyTraffic: hourlyTraffic || [],
        popularPages: popularPages || [],
        referrers: referrerData || []
      }
    })
  } catch (error) {
    console.error('대시보드 조회 오류:', error)
    return NextResponse.json(
      { success: false, error: '대시보드 조회 실패' },
      { status: 500 }
    )
  }
}
