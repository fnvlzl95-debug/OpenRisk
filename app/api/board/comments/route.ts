import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateComment, sanitizeHtml } from '@/lib/board/validation'
import { checkRateLimit, getRateLimitCookie } from '@/lib/board/rate-limiter'
import { cookies } from 'next/headers'

// POST /api/board/comments - 댓글 작성
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  // 인증 확인
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  // Rate Limit 확인
  const cookieStore = await cookies()
  const rateLimitCheck = checkRateLimit(cookieStore, 'comments')
  if (!rateLimitCheck.allowed) {
    return NextResponse.json(
      { error: '댓글 작성 제한에 도달했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 429 }
    )
  }

  const body = await request.json()
  const { post_id, content, parent_id } = body

  // post_id 검증
  if (!post_id || typeof post_id !== 'number') {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  // parent_id 검증 (대댓글인 경우)
  if (parent_id !== undefined && parent_id !== null) {
    if (typeof parent_id !== 'number') {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
    }

    // 부모 댓글 존재 확인
    const { data: parentComment } = await supabase
      .from('comments')
      .select('id, post_id, parent_id')
      .eq('id', parent_id)
      .is('deleted_at', null)
      .single()

    if (!parentComment) {
      return NextResponse.json({ error: '부모 댓글을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 부모 댓글이 같은 게시글에 속하는지 확인
    if (parentComment.post_id !== post_id) {
      return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
    }

    // 대대댓글 방지 (1단계 대댓글만 허용)
    if (parentComment.parent_id !== null) {
      return NextResponse.json({ error: '대댓글에는 답글을 달 수 없습니다.' }, { status: 400 })
    }
  }

  // 입력값 검증
  const validation = validateComment(content)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  // 게시글 존재 확인
  const { data: post } = await supabase
    .from('posts')
    .select('id')
    .eq('id', post_id)
    .is('deleted_at', null)
    .single()

  if (!post) {
    return NextResponse.json({ error: '게시글을 찾을 수 없습니다.' }, { status: 404 })
  }

  // 댓글 저장
  const { data: comment, error } = await supabase
    .from('comments')
    .insert({
      post_id,
      author_id: user.id,
      content: sanitizeHtml(content.trim()),
      parent_id: parent_id || null
    })
    .select(`
      *,
      profiles:author_id (
        nickname,
        profile_image,
        is_admin
      )
    `)
    .single()

  if (error) {
    console.error('Comment creation error:', error)
    return NextResponse.json({ error: '댓글 작성에 실패했습니다.' }, { status: 500 })
  }

  // Rate Limit 쿠키 업데이트
  const rateLimitCookie = getRateLimitCookie(cookieStore, 'comments')
  const response = NextResponse.json({
    success: true,
    comment: {
      ...comment,
      author_nickname: comment.profiles?.nickname,
      author_profile_image: comment.profiles?.profile_image,
      author_is_admin: comment.profiles?.is_admin
    }
  })
  response.cookies.set(rateLimitCookie.name, rateLimitCookie.value, rateLimitCookie.options)

  return response
}
