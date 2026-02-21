import { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'

interface Props {
  params: Promise<{ id: string }>
}

const getMissingPostMetadata = (canonicalPath: string): Metadata => ({
  title: '게시글을 찾을 수 없습니다 - 오픈리스크',
  description: '요청한 게시글이 없거나 삭제되었습니다.',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      'max-snippet': 0,
      'max-image-preview': 'none',
      'max-video-preview': 0,
    },
  },
  alternates: {
    canonical: canonicalPath,
  },
  openGraph: {
    title: '게시글을 찾을 수 없습니다 - 오픈리스크',
    description: '요청한 게시글이 없거나 삭제되었습니다.',
    url: `https://openrisk.info${canonicalPath}`,
    type: 'website',
    siteName: '오픈리스크',
    locale: 'ko_KR',
  },
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const postId = parseInt(id, 10)

  if (isNaN(postId)) {
    return getMissingPostMetadata('/board')
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: post } = await supabase
      .from('active_posts')
      .select('title, content, author_nickname, created_at')
      .eq('id', postId)
      .single()

    if (!post) {
      return getMissingPostMetadata(`/board/${postId}`)
    }

    const description = post.content.slice(0, 150).replace(/\n/g, ' ') + (post.content.length > 150 ? '...' : '')

    return {
      title: `${post.title} - 오픈리스크 커뮤니티`,
      description,
      openGraph: {
        title: post.title,
        description,
        url: `https://openrisk.info/board/${postId}`,
        type: 'article',
        siteName: '오픈리스크',
        locale: 'ko_KR',
        publishedTime: post.created_at,
        authors: [post.author_nickname],
      },
      twitter: {
        card: 'summary',
        title: post.title,
        description,
      },
      alternates: {
        canonical: `/board/${postId}`,
      },
    }
  } catch (error) {
    console.error('Metadata generation error:', error)
    return getMissingPostMetadata('/board')
  }
}

export default function PostLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
