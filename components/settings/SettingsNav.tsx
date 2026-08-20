'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/settings/profile', label: '프로필' },
  { href: '/settings/notifications', label: '알림' },
  { href: '/settings/billing', label: '결제' },
  { href: '/settings/documents', label: '문서' },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-xs overflow-x-auto border-b border-hairline-soft pb-0" aria-label="설정 메뉴">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'shrink-0 rounded-t-md px-md py-sm text-body-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2',
              active
                ? 'border-b-2 border-ink text-ink'
                : 'border-b-2 border-transparent text-steel hover:text-ink'
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
