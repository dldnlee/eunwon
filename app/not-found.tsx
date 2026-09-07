import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, SearchX } from 'lucide-react';
import { Logo } from '@/components/Logo';

export const metadata: Metadata = {
  title: '페이지를 찾을 수 없어요',
  description: '요청하신 페이지를 찾을 수 없습니다. 홈에서 정부지원사업 매칭을 계속해 보세요.',
  robots: { index: false, follow: false },
};

const linkClassName =
  'inline-flex min-h-11 items-center justify-center gap-xs rounded-full px-xl py-sm text-button-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-hairline-soft px-md sm:px-xl" aria-label="사이트 헤더">
        <div className="mx-auto flex h-16 max-w-6xl items-center">
          <Link href="/" aria-label="eunwon AI 홈으로 이동" className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2">
            <Logo className="h-7 w-auto" />
          </Link>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="flex flex-1 items-center px-md py-section focus:outline-none sm:px-xl sm:py-section-lg">
        <section className="mx-auto w-full max-w-2xl text-center" aria-labelledby="not-found-title">
          <div className="mx-auto mb-xl flex h-16 w-16 items-center justify-center rounded-full bg-surface" aria-hidden="true">
            <SearchX className="h-7 w-7 text-slate" strokeWidth={1.75} />
          </div>
          <p className="mb-xs text-caption-bold text-steel">오류 404</p>
          <h1 id="not-found-title" className="text-heading-md text-ink sm:text-heading-lg">페이지를 찾을 수 없어요</h1>
          <p className="mx-auto mt-md max-w-lg text-body-md text-slate">주소가 잘못 입력되었거나 페이지가 이동되었을 수 있어요. 홈으로 돌아가거나 로그인해 맞춤 지원사업을 확인해 보세요.</p>
          <div className="mt-xxl flex flex-col justify-center gap-sm sm:flex-row">
            <Link href="/" className={`${linkClassName} bg-primary text-on-primary hover:bg-charcoal`}>홈으로 이동</Link>
            <Link href="/login" className={`${linkClassName} border border-ink bg-canvas text-ink hover:bg-surface`}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> 로그인으로 이동
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
