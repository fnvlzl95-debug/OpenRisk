import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "오픈리스크 - 창업 리스크 분석",
  description: "지금, 창업해도 될까? 서울/경기/인천 상권 데이터 기반 창업 리스크 분석. 경쟁 밀도, 유동인구, 임대료, 생존율 등 7대 지표로 창업 위험도를 분석합니다.",
  keywords: ["창업", "상권분석", "창업리스크", "소상공인", "상권", "오픈리스크", "서울상권", "경기상권", "인천상권", "폐업률", "유동인구"],
  authors: [{ name: "OpenRisk" }],
  creator: "OpenRisk",
  metadataBase: new URL("https://openrisk.info"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "오픈리스크 - 창업 리스크 분석",
    description: "지금, 창업해도 될까? 데이터 기반 창업 리스크 분석 서비스.",
    url: "https://openrisk.info",
    images: [
      {
        url: "https://openrisk.info/MetaImg.png",
        width: 1200,
        height: 630,
        alt: "오픈리스크 - 창업 리스크 분석",
      },
    ],
    type: "website",
    siteName: "오픈리스크",
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: "오픈리스크 - 창업 리스크 분석",
    description: "지금, 창업해도 될까? 데이터 기반 창업 리스크 분석 서비스.",
    images: ["https://openrisk.info/MetaImg.png"],
  },
  verification: {
    google: "YOUR_GOOGLE_VERIFICATION_CODE",
    other: {
      "naver-site-verification": "YOUR_NAVER_VERIFICATION_CODE",
    },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        {/* Pretendard 폰트 */}
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        {/* Kakao Maps SDK - 전역 로드 */}
        <Script
          src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_KEY}&autoload=false`}
          strategy="beforeInteractive"
        />
        {/* Kakao JS SDK - 공유 기능 */}
        <Script
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js"
          strategy="afterInteractive"
        />
        {/* Google Analytics */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-6SLW36N6YY"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-6SLW36N6YY');
          `}
        </Script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ fontFamily: '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
      >
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
