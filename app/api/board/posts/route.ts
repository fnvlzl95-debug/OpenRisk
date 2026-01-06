import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validatePost, sanitizeHtml } from '@/lib/board/validation'
import { checkRateLimit, getRateLimitCookie } from '@/lib/board/rate-limiter'
import { cookies } from 'next/headers'

// GET /api/board/posts - 게시글 목록
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = 20
  const offset = (page - 1) * limit

  const supabase = await createClient()

  // active_posts 뷰에서 조회 (soft delete 제외됨)
  const { data: posts, error, count } = await supabase
    .from('active_posts')
    .select('*', { count: 'exact' })
    .order('is_notice', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: '게시글 조회 실패' }, { status: 500 })
  }

  return NextResponse.json({
    posts,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit)
    }
  })
}

// POST /api/board/posts - 게시글 작성
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // 인증 확인
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  // Rate Limit 확인
  const cookieStore = await cookies()
  const rateLimitCheck = checkRateLimit(cookieStore, 'posts')
  if (!rateLimitCheck.allowed) {
    return NextResponse.json(
      { error: '글 작성 제한에 도달했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 429 }
    )
  }

  const body = await request.json()
  const { title, content, is_notice } = body

  // 입력값 검증
  const validation = validatePost(title, content)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  // 관리자 확인 (공지글 작성 시)
  if (is_notice) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: '공지글은 관리자만 작성할 수 있습니다.' }, { status: 403 })
    }
  }

  // 게시글 저장
  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      author_id: user.id,
      title: sanitizeHtml(title.trim()),
      content: sanitizeHtml(content.trim()),
      is_notice: is_notice || false
    })
    .select()
    .single()

  if (error) {
    console.error('Post creation error:', error)
    return NextResponse.json({ error: '게시글 작성에 실패했습니다.' }, { status: 500 })
  }

  // Rate Limit 쿠키 업데이트
  const rateLimitCookie = getRateLimitCookie(cookieStore, 'posts')
  const response = NextResponse.json({ success: true, post })
  response.cookies.set(rateLimitCookie.name, rateLimitCookie.value, rateLimitCookie.options)

  return response
}
