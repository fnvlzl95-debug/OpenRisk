import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/board', '/board/*', '/home-b'],
      disallow: [
        '/api/',
        '/admin/',
        '/auth/',
        '/board/write',
        '/board/profile',
        '/board/setup-nickname',
        '/board/*/edit',
      ],
    },
    sitemap: 'https://openrisk.info/sitemap.xml',
  }
}
