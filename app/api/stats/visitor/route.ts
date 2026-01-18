import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export const runtime = 'edge'

// GET: 현재 방문자 수 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const statId = searchParams.get('id') || 'total'

    const { data, error } = await supabase
      .from('visitor_stats')
      .select('visit_count, unique_visitors, last_updated')
      .eq('id', statId)
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      stats: data
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: '통계 조회 실패' },
      { status: 500 }
    )
  }
}

// POST: 방문자 수 증가 + 상세 로그 저장
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const visitorId = cookieStore.get('visitor_id')?.value
    const today = new Date().toISOString().split('T')[0]

    // 요청 정보 추출
    const body = await request.json().catch(() => ({}))
    const pagePath = body.page_path || request.headers.get('referer') || '/'
    const referrer = request.headers.get('referer')
    const userAgent = request.headers.get('user-agent')
    const sessionId = cookieStore.get('session_id')?.value || crypto.randomUUID()

    // IP 해싱 (개인정보 보호)
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0] : 'unknown'
    const ipHash = ip !== 'unknown'
      ? await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip))
          .then(buf => Array.from(new Uint8Array(buf))
            .map(b => b.toString(16).padStart(2, '0')).join(''))
      : 'unknown'

    // 오늘 이미 카운트했는지 확인
    const alreadyCounted = visitorId && cookieStore.get(`counted_${today}`)?.value === 'true'

    if (alreadyCounted) {
      // 이미 카운트됨 - 로그만 저장
      const adminClient = createAdminClient()
      const { error: logError } = await adminClient.from('visitor_logs').insert({
        visitor_id: visitorId,
        page_path: pagePath,
        referrer,
        user_agent: userAgent,
        ip_hash: ipHash,
        session_id: sessionId
      })

      if (logError) {
        console.error('visitor_logs INSERT 실패 (already counted):', logError)
      }

      const supabase = await createClient()
      const { data } = await supabase
        .from('visitor_stats')
        .select('visit_count')
        .eq('id', 'total')
        .single()

      return NextResponse.json({
        success: true,
        counted: false,
        count: data?.visit_count || 0
      })
    }

    // 카운터 증가
    const adminClient = createAdminClient()

    // 총 방문자 증가
    const { data: totalCount } = await adminClient
      .rpc('increment_visitor_count', { p_stat_id: 'total' })

    // 일별 방문자 증가
    await adminClient
      .rpc('increment_visitor_count', { p_stat_id: today })

    // 상세 로그 저장
    const { error: logError } = await adminClient.from('visitor_logs').insert({
      visitor_id: visitorId || crypto.randomUUID(),
      page_path: pagePath,
      referrer,
      user_agent: userAgent,
      ip_hash: ipHash,
      session_id: sessionId
    })

    if (logError) {
      console.error('visitor_logs INSERT 실패 (new visitor):', logError)
    }

    // 쿠키 설정
    const response = NextResponse.json({
      success: true,
      counted: true,
      count: totalCount
    })

    const newVisitorId = visitorId || crypto.randomUUID()
    response.cookies.set('visitor_id', newVisitorId, {
      maxAge: 60 * 60 * 24 * 365,  // 1년
      httpOnly: true,
      sameSite: 'lax'
    })

    response.cookies.set('session_id', sessionId, {
      maxAge: 60 * 60 * 24,  // 24시간
      httpOnly: true,
      sameSite: 'lax'
    })

    response.cookies.set(`counted_${today}`, 'true', {
      maxAge: 60 * 60 * 24,  // 24시간
      httpOnly: true,
      sameSite: 'lax'
    })

    return response
  } catch (error) {
    console.error('방문자 추적 오류:', error)
    return NextResponse.json(
      { success: false, error: '카운트 증가 실패' },
      { status: 500 }
    )
  }
}
