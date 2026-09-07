import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '문의하기',
  description: 'eunwon AI 정부지원사업 매칭 서비스 이용, 제휴 및 오류에 관해 문의하세요.',
  alternates: { canonical: '/contact' },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
