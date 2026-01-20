import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(request: NextRequest) {
  try {
    const { postId, viewCount } = await request.json()

    if (!postId || viewCount === undefined || viewCount < 0) {
      return NextResponse.json(
        { error: 'Invalid parameters' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('posts')
      .update({ view_count: viewCount })
      .eq('id', postId)

    if (error) {
      console.error('View count update error:', error)
      return NextResponse.json(
        { error: 'Failed to update view count' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
