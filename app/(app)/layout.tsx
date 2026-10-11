import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LogoutButton } from '@/components/LogoutButton';
import { Logo } from '@/components/Logo';
import { MobileNavMenu } from '@/components/MobileNavMenu';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-20 border-b border-hairline-soft bg-canvas">
        <div className="relative mx-auto flex max-w-6xl items-center justify-between px-xl py-sm">
          <Link href="/dashboard" className="flex items-center gap-xs text-card-title text-ink">
            <Logo className="h-6 w-auto" />
            eunwon AI
          </Link>
          {/* Full link row on desktop — collapses to MobileNavMenu's hamburger drawer below lg, per DESIGN.md's documented top-nav collapsing strategy. */}
          <nav aria-label="주요 메뉴" className="hidden items-center gap-lg text-body-sm font-medium text-steel lg:flex">
            <Link href="/dashboard" className="rounded-sm py-xs transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2">
              대시보드
            </Link>
            <Link href="/dashboard/saved" className="rounded-sm py-xs transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2">
              저장한 사업
            </Link>
            <Link href="/financial-health" className="rounded-sm py-xs transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2">
              재무·신용 관리
            </Link>
            <Link href="/events" className="rounded-sm py-xs transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2">
              행사
            </Link>
            <Link href="/settings/profile" className="rounded-sm py-xs transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2">
              설정
            </Link>
            <LogoutButton />
          </nav>
          <MobileNavMenu />
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-xl py-xxl focus:outline-none">{children}</main>
    </div>
  );
}
