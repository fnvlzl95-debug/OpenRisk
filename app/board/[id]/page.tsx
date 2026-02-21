import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PostDetailClient from './PostDetailClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PostDetailPage({ params }: Props) {
  const { id } = await params

  if (!/^\d+$/.test(id)) {
    notFound()
  }

  const postId = parseInt(id, 10)
  const supabase = await createClient()

  const { data: post, error } = await supabase
    .from('active_posts')
    .select('id')
    .eq('id', postId)
    .maybeSingle()

  if (error || !post) {
    notFound()
  }

  return <PostDetailClient id={id} />
}
