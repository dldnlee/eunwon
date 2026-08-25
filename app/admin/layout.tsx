import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { LogoutButton } from '@/components/LogoutButton';
import { createClient } from '@/lib/supabase/server';

/**
 * Admin workspace shell. Unlike the (app) layout there is deliberately no onboarding
 * redirect — operators may not be regular product users — but every child page must pass
 * its own capability gate; this layout only guarantees authentication.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-20 border-b border-hairline-soft bg-canvas">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-xl py-sm">
          <Link href="/admin/marketing" className="flex items-center gap-xs text-card-title text-ink">
            <Logo className="h-6 w-auto" />
            eunwon 관리자
          </Link>
          <nav className="flex items-center gap-lg text-body-sm font-medium text-steel">
            <Link href="/dashboard" className="rounded-sm py-xs transition-colors hover:text-ink">
              서비스로 돌아가기
            </Link>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-xl py-xxl">{children}</main>
    </div>
  );
}

export const dynamic = 'force-dynamic';
