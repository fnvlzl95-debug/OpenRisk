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
      // 로그인 성공 - 원래 가려던 페이지로 리다이렉트
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // 오류 발생 시 게시판으로 리다이렉트
  return NextResponse.redirect(`${origin}/board?error=auth`)
}
