import { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://openrisk.info'

  // 정적 페이지
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/home-b`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/board`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ]

  // 게시글 목록 가져오기
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const posts: Array<{ id: number; created_at: string }> = []
    const pageSize = 1000
    let offset = 0

    while (true) {
      const { data, error } = await supabase
        .from('active_posts')
        .select('id, created_at')
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1)

      if (error) {
        throw error
      }

      if (!data || data.length === 0) {
        break
      }

      posts.push(...data)

      if (data.length < pageSize) {
        break
      }

      offset += pageSize
    }

    const postPages: MetadataRoute.Sitemap = posts.map((post) => ({
      url: `${baseUrl}/board/${post.id}`,
      lastModified: new Date(post.created_at),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }))

    return [...staticPages, ...postPages]
  } catch (error) {
    console.error('Sitemap generation error:', error)
    return staticPages
  }
}
