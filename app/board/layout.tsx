import { Metadata } from 'next'

export const metadata: Metadata = {
  title: '커뮤니티 - 오픈리스크',
  description: '창업 준비생들의 실제 경험과 노하우를 공유하는 커뮤니티. 상권 분석, 창업 후기, 입지 선정 팁 등 다양한 정보를 나눠보세요.',
  keywords: ['창업 커뮤니티', '상권분석 후기', '창업 경험', '소상공인 커뮤니티', '창업 정보'],
  openGraph: {
    title: '커뮤니티 - 오픈리스크',
    description: '창업 준비생들의 실제 경험과 노하우를 공유하는 커뮤니티',
    url: 'https://openrisk.info/board',
    type: 'website',
    siteName: '오픈리스크',
    locale: 'ko_KR',
  },
  twitter: {
    card: 'summary',
    title: '커뮤니티 - 오픈리스크',
    description: '창업 준비생들의 실제 경험과 노하우를 공유하는 커뮤니티',
  },
  alternates: {
    canonical: '/board',
  },
}

export default function BoardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
