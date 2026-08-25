import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Handles the Supabase email-confirmation / magic-link / OAuth (e.g. Kakao) redirect.
 * Defaults to /onboard rather than /dashboard — that page already redirects an
 * already-onboarded user straight to /dashboard, so it's a safe default for both a
 * brand-new signup and a returning user, without this route needing to know which.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next');
  const destination = next?.startsWith('/') && !next.startsWith('//') ? next : '/onboard';

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=oauth_callback', origin));
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error('OAuth code exchange failed:', error.message);
    return NextResponse.redirect(new URL('/login?error=oauth_callback', origin));
  }

  return NextResponse.redirect(new URL(destination, origin));
}
