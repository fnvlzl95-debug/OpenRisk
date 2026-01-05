import { NextRequest, NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { rating, comment, address, category, riskScore } = body

    // 유효성 검사
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: '별점은 1~5 사이여야 합니다.' },
        { status: 400 }
      )
    }

    const supabase = getSupabase()

    // 피드백 저장
    const { error } = await supabase
      .from('feedbacks')
      .insert({
        rating,
        comment: comment?.trim() || null,
        address: address || null,
        category: category || null,
        risk_score: riskScore || null,
        created_at: new Date().toISOString(),
      })

    if (error) {
      console.error('Feedback save error:', error)
      return NextResponse.json(
        { error: '피드백 저장에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Feedback API error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
