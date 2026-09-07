import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "@/lib/site-url";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "정부지원사업 찾기·AI 맞춤 매칭 | eunwon AI",
    template: "%s | eunwon AI",
  },
  description:
    "소상공인·스타트업·중소기업의 업종, 지역, 업력과 인증 정보를 분석해 신청 가능한 정부지원사업과 창업지원사업을 찾아주는 AI 맞춤 매칭 서비스입니다.",
  keywords: [
    "정부지원사업",
    "정부지원사업 찾기",
    "정부지원금",
    "중소기업 지원사업",
    "소상공인 지원사업",
    "스타트업 지원사업",
    "창업지원사업",
    "기업지원사업",
    "사업자 지원금",
  ],
  applicationName: "eunwon AI",
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "eunwon AI",
    title: "정부지원사업 찾기·AI 맞춤 매칭 | eunwon AI",
    description: "사업 정보만 입력하면 신청 가능한 정부지원사업을 AI가 찾아드립니다.",
    images: [{ url: "/icon.png", width: 512, height: 512, alt: "eunwon AI" }],
  },
  twitter: {
    card: "summary",
    title: "정부지원사업 찾기·AI 맞춤 매칭 | eunwon AI",
    description: "소상공인·스타트업·중소기업을 위한 정부지원사업 AI 매칭 서비스",
    images: ["/icon.png"],
  },
  robots: { index: true, follow: true },
  category: "business",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${dmSans.variable} font-sans antialiased`}>
        <a
          href="#main-content"
          className="sr-only fixed left-md top-md z-50 rounded-full bg-primary px-xl py-sm text-button-md text-on-primary focus:not-sr-only focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2"
        >
          본문으로 바로가기
        </a>
        {children}
      </body>
    </html>
  );
}
