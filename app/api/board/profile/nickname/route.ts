import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PUT /api/board/profile/nickname - 닉네임 설정/변경
export async function PUT(request: NextRequest) {
  const supabase = await createClient()

  // 인증 확인
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = await request.json()
  const { nickname } = body

  if (!nickname || typeof nickname !== 'string') {
    return NextResponse.json({ error: '닉네임을 입력해주세요.' }, { status: 400 })
  }

  const trimmed = nickname.trim()

  // 닉네임 검증
  if (trimmed.length < 2) {
    return NextResponse.json({ error: '닉네임은 2자 이상이어야 합니다.' }, { status: 400 })
  }

  if (trimmed.length > 20) {
    return NextResponse.json({ error: '닉네임은 20자 이하여야 합니다.' }, { status: 400 })
  }

  // 한글, 영문, 숫자, 밑줄만 허용
  if (!/^[가-힣a-zA-Z0-9_]+$/.test(trimmed)) {
    return NextResponse.json({
      error: '닉네임은 한글, 영문, 숫자, 밑줄(_)만 사용 가능합니다.'
    }, { status: 400 })
  }

  // 금지어 체크 (기본적인 것만)
  const bannedWords = ['관리자', 'admin', 'administrator', '운영자', '시스템']
  const lowerNickname = trimmed.toLowerCase()
  if (bannedWords.some(word => lowerNickname.includes(word.toLowerCase()))) {
    return NextResponse.json({ error: '사용할 수 없는 닉네임입니다.' }, { status: 400 })
  }

  // 중복 체크
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('nickname', trimmed)
    .neq('id', user.id)
    .single()

  if (existing) {
    return NextResponse.json({ error: '이미 사용 중인 닉네임입니다.' }, { status: 409 })
  }

  // 닉네임 업데이트
  const { error } = await supabase
    .from('profiles')
    .update({ nickname: trimmed })
    .eq('id', user.id)

  if (error) {
    console.error('Nickname update error:', error)
    return NextResponse.json({ error: '닉네임 변경에 실패했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, nickname: trimmed })
}

// GET /api/board/profile/nickname - 현재 닉네임 조회
export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname')
    .eq('id', user.id)
    .single()

  return NextResponse.json({ nickname: profile?.nickname || null })
}
