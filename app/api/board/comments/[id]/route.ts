import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateComment, sanitizeHtml } from '@/lib/board/validation'

// PUT /api/board/comments/[id] - 댓글 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const commentId = parseInt(id)

  if (isNaN(commentId)) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const supabase = await createClient()

  // 인증 확인
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  // 기존 댓글 확인
  const { data: existingComment, error: fetchError } = await supabase
    .from('comments')
    .select('author_id')
    .eq('id', commentId)
    .is('deleted_at', null)
    .single()

  if (fetchError || !existingComment) {
    return NextResponse.json({ error: '댓글을 찾을 수 없습니다.' }, { status: 404 })
  }

  // 권한 확인 (작성자 또는 관리자)
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (existingComment.author_id !== user.id && !profile?.is_admin) {
    return NextResponse.json({ error: '수정 권한이 없습니다.' }, { status: 403 })
  }

  const body = await request.json()
  const { content } = body

  // 입력값 검증
  const validation = validateComment(content)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  // 댓글 수정
  const { data: comment, error } = await supabase
    .from('comments')
    .update({
      content: sanitizeHtml(content.trim())
    })
    .eq('id', commentId)
    .select(`
      id,
      content,
      created_at,
      author_id,
      profiles:author_id (
        nickname,
        profile_image,
        is_admin
      )
    `)
    .single()

  if (error) {
    console.error('Comment update error:', error)
    return NextResponse.json({ error: '댓글 수정에 실패했습니다.' }, { status: 500 })
  }

  // 응답 형식 변환
  const profile_data = comment.profiles as unknown as { nickname: string; profile_image: string | null; is_admin: boolean }
  const formattedComment = {
    id: comment.id,
    content: comment.content,
    created_at: comment.created_at,
    author_id: comment.author_id,
    author_nickname: profile_data?.nickname || '알 수 없음',
    author_profile_image: profile_data?.profile_image || null,
    author_is_admin: profile_data?.is_admin || false
  }

  return NextResponse.json({ success: true, comment: formattedComment })
}

// DELETE /api/board/comments/[id] - 댓글 삭제 (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const commentId = parseInt(id)

  if (isNaN(commentId)) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const supabase = await createClient()

  // 인증 확인
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  // 기존 댓글 확인
  const { data: existingComment, error: fetchError } = await supabase
    .from('comments')
    .select('author_id')
    .eq('id', commentId)
    .is('deleted_at', null)
    .single()

  if (fetchError || !existingComment) {
    return NextResponse.json({ error: '댓글을 찾을 수 없습니다.' }, { status: 404 })
  }

  // 권한 확인 (작성자 또는 관리자)
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (existingComment.author_id !== user.id && !profile?.is_admin) {
    return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 })
  }

  // Soft Delete (deleted_at 설정)
  const { error } = await supabase
    .from('comments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', commentId)

  if (error) {
    console.error('Comment delete error:', error)
    return NextResponse.json({ error: '댓글 삭제에 실패했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
