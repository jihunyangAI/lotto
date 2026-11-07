import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Nav from "@/components/nav";
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
  title: "로또대박기원",
  description: "로또 6/45 당첨번호 분석 대시보드: 번호별 출현 빈도, 홀짝 비율, 구간 분포, 최근 10회차 트렌드",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <Nav />
        {children}
        <footer className="mt-auto py-8 text-center text-xs text-ink-3">
          로또대박기원 · 통계는 재미로만 봐주세요. 모든 번호의 당첨 확률은 같습니다.
        </footer>
      </body>
    </html>
  );
}
