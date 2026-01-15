import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validatePost, sanitizeHtml } from '@/lib/board/validation'

// GET /api/board/posts/[id] - 게시글 상세
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const postId = parseInt(id)

  if (isNaN(postId)) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const supabase = await createClient()

  // 게시글 조회
  const { data: post, error } = await supabase
    .from('active_posts')
    .select('*')
    .eq('id', postId)
    .single()

  if (error || !post) {
    return NextResponse.json({ error: '게시글을 찾을 수 없습니다.' }, { status: 404 })
  }

  // 댓글 조회
  const { data: comments } = await supabase
    .from('active_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })

  // 조회수 증가 여부 확인 (헤더로 전달)
  const shouldIncrementView = request.headers.get('x-increment-view') === 'true'

  if (shouldIncrementView) {
    try {
      // service_role로 조회수 증가 (RPC 사용)
      const adminClient = createAdminClient()
      await adminClient.rpc('increment_view_count', { p_post_id: postId })
    } catch (err) {
      // 조회수 증가 실패해도 게시글 조회는 정상 진행
      console.error('View count increment error:', err)
    }
  }

  return NextResponse.json({
    post: {
      ...post,
      view_count: shouldIncrementView ? post.view_count + 1 : post.view_count
    },
    comments: comments || []
  })
}

// PUT /api/board/posts/[id] - 게시글 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const postId = parseInt(id)

  if (isNaN(postId)) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const supabase = await createClient()

  // 인증 확인
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  // 기존 게시글 확인
  const { data: existingPost, error: fetchError } = await supabase
    .from('posts')
    .select('author_id')
    .eq('id', postId)
    .is('deleted_at', null)
    .single()

  if (fetchError || !existingPost) {
    return NextResponse.json({ error: '게시글을 찾을 수 없습니다.' }, { status: 404 })
  }

  // 권한 확인 (작성자 또는 관리자)
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (existingPost.author_id !== user.id && !profile?.is_admin) {
    return NextResponse.json({ error: '수정 권한이 없습니다.' }, { status: 403 })
  }

  const body = await request.json()
  const { title, content, is_notice } = body

  // 입력값 검증
  const validation = validatePost(title, content)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  // 공지글 권한 확인
  if (is_notice && !profile?.is_admin) {
    return NextResponse.json({ error: '공지글은 관리자만 설정할 수 있습니다.' }, { status: 403 })
  }

  // 게시글 수정
  const { data: post, error } = await supabase
    .from('posts')
    .update({
      title: sanitizeHtml(title.trim()),
      content: sanitizeHtml(content.trim()),
      is_notice: profile?.is_admin ? (is_notice || false) : false
    })
    .eq('id', postId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: '게시글 수정에 실패했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, post })
}

// DELETE /api/board/posts/[id] - 게시글 삭제 (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const postId = parseInt(id)

  if (isNaN(postId)) {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const supabase = await createClient()

  // 인증 확인
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  // 기존 게시글 확인
  const { data: existingPost, error: fetchError } = await supabase
    .from('posts')
    .select('author_id')
    .eq('id', postId)
    .is('deleted_at', null)
    .single()

  if (fetchError || !existingPost) {
    return NextResponse.json({ error: '게시글을 찾을 수 없습니다.' }, { status: 404 })
  }

  // 권한 확인 (작성자 또는 관리자)
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (existingPost.author_id !== user.id && !profile?.is_admin) {
    return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 })
  }

  // Soft Delete (deleted_at 설정)
  const { error } = await supabase
    .from('posts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', postId)

  if (error) {
    return NextResponse.json({ error: '게시글 삭제에 실패했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
