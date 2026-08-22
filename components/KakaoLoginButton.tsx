'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/** Kakao's own brand guideline colors for the login button — #FEE500 background,
 *  #191919 text/icon — kept as-is rather than mapped onto this app's own button
 *  variants, since third-party auth buttons (Kakao/Google/Apple) are expected to
 *  keep the provider's official styling regardless of the host app's design system. */
export function KakaoLoginButton({ nextPath }: { nextPath?: string }) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const supabase = createClient();
    const redirectTo = new URL('/auth/callback', window.location.origin);
    if (nextPath) redirectTo.searchParams.set('next', nextPath);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: redirectTo.toString() },
    });

    // On success the browser is redirected to Kakao immediately — this only
    // returns to unset `loading` in the (rare) case the request itself failed.
    if (error) setLoading(false);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[#FEE500] text-button-md text-[#191919] transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-60 max-sm:min-h-11"
    >
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M10 1C4.928 1 1 4.36 1 8.5c0 2.635 1.706 4.95 4.29 6.29-.19.68-.68 2.44-.78 2.82 0 0-.02.16.08.22a.3.3 0 0 0 .24 0c.32-.05 2.76-1.83 3.36-2.26.59.08 1.2.13 1.81.13 5.07 0 9-3.36 9-7.5S15.07 1 10 1Z"
          fill="#191919"
        />
      </svg>
      {loading ? '이동 중...' : '카카오로 계속하기'}
    </button>
  );
}
