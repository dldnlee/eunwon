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

  if (code) {
    const supabase = createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${next ?? '/onboard'}`);
}
