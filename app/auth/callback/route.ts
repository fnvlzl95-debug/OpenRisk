import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/board'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // 사용자 프로필 확인 - 닉네임 설정 여부 체크
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('nickname')
          .eq('id', user.id)
          .single()

        // 닉네임이 없거나 카카오 기본값(kakao_*)이면 닉네임 설정 페이지로
        if (!profile?.nickname || profile.nickname.startsWith('kakao_')) {
          return NextResponse.redirect(`${origin}/board/setup-nickname`)
        }
      }

      // 닉네임이 이미 있으면 원래 가려던 페이지로
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // 오류 발생 시 게시판으로 리다이렉트
  return NextResponse.redirect(`${origin}/board?error=auth`)
}
