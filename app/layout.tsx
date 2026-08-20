import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "지원사업매칭 — 정부지원사업 AI 매칭 서비스",
  description:
    "내 사업 정보만 입력하면 신청 가능한 정부지원사업을 AI가 찾아드려요. 소상공인, 스타트업, 중소기업을 위한 지원사업 매칭 서비스.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${dmSans.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
