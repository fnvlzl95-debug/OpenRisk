import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});

export const metadata: Metadata = {
  title: "오픈리스크 - 상권 리스크 분석",
  description: "상권의 진짜 리스크를 번역합니다. 초보 창업자를 위한 상권 분석 서비스.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${notoSansKr.variable} ${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ fontFamily: 'var(--font-noto-sans-kr), sans-serif' }}
      >
        {children}
      </body>
    </html>
  );
}
