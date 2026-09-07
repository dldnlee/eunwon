import Link from 'next/link';
import { Footer } from '@/components/Footer';
import { Logo } from '@/components/Logo';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-hairline-soft px-md sm:px-xl" aria-label="사이트 헤더">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between">
          <Link href="/" aria-label="eunwon AI 홈으로 이동" className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2">
            <Logo className="h-7 w-auto" />
          </Link>
          <nav aria-label="법적 고지">
            <ul className="flex items-center gap-xxs sm:gap-md">
              <li><Link href="/privacy" className="inline-flex min-h-11 items-center rounded-full px-sm text-body-sm-medium text-slate hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep sm:px-md">개인정보처리방침</Link></li>
              <li><Link href="/terms" className="inline-flex min-h-11 items-center rounded-full px-sm text-body-sm-medium text-slate hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep sm:px-md">이용약관</Link></li>
            </ul>
          </nav>
        </div>
      </header>
      {children}
      <Footer />
    </div>
  );
}
