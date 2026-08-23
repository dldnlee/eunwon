'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { LogoutButton } from '@/components/LogoutButton';

const NAV_LINKS = [
  { href: '/dashboard', label: '대시보드' },
  { href: '/dashboard/saved', label: '저장한 사업' },
  { href: '/events', label: '행사' },
  { href: '/settings/profile', label: '설정' },
];

// Below the desktop breakpoint the horizontal link row doesn't fit next to
// the wordmark — DESIGN.md's own responsive spec calls for the top nav to
// collapse into a hamburger drawer under 1024px, so this swaps in for the
// inline <nav> at the `md` breakpoint.
export function MobileNavMenu() {
  const [open, setOpen] = useState(false);

  // Close on route change / outside interaction is handled by unmounting on
  // link click below; this just guards against dangling open state if the
  // viewport is resized back to desktop while the drawer is open.
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 768) setOpen(false);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? '메뉴 닫기' : '메뉴 열기'}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2"
      >
        {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
      </button>

      {open && (
        <div
          id="mobile-nav-panel"
          className="absolute inset-x-0 top-full z-20 flex flex-col gap-xxs border-b border-hairline-soft bg-canvas px-xl py-md text-body-sm font-medium text-steel shadow-card"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center rounded-sm px-xs py-sm transition-colors hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-deep focus-visible:ring-offset-2"
            >
              {link.label}
            </Link>
          ))}
          <div className="flex min-h-11 items-center px-xs py-sm" onClick={() => setOpen(false)}>
            <LogoutButton />
          </div>
        </div>
      )}
    </div>
  );
}
