import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/home-b', '/board', '/board/*'],
      disallow: [
        '/api/',
        '/admin/',
        '/auth/',
        '/ops-9f2',
        '/ops-9f2/*',
        '/select',
        '/select/*',
        '/board/write',
        '/board/profile',
        '/board/setup-nickname',
        '/board/*/edit',
        '/board/design-a',
        '/board/design-b',
        '/board/design-c',
        '/board/design-d',
        '/board/design-e',
        '/board/design-f',
        '/board/design-g',
        '/board/design-h',
        '/board/design-i',
        '/board/design-x',
        '/board/design-game',
        '/board/newspaper-example',
      ],
    },
    sitemap: 'https://openrisk.info/sitemap.xml',
  }
}
