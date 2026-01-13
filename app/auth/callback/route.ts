import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/board'
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  // OAuth 오류 처리
  if (error) {
    console.error('OAuth error:', error, errorDescription)
    return NextResponse.redirect(`${origin}/home-b?error=${encodeURIComponent(errorDescription || error)}`)
  }

  if (code) {
    const supabase = await createClient()
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      console.error('Code exchange error:', exchangeError)
      return NextResponse.redirect(`${origin}/home-b?error=${encodeURIComponent(exchangeError.message)}`)
    }

    if (data.session) {
      // 닉네임 확인
      const { data: profile } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', data.session.user.id)
        .single()

      if (!profile?.nickname || profile.nickname.startsWith('kakao_')) {
        return NextResponse.redirect(`${origin}/board/setup-nickname`)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // 코드가 없거나 세션 생성 실패시
  return NextResponse.redirect(`${origin}/home-b`)
}
