import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeAuthRedirectPath } from '@/lib/auth-redirect';

/**
 * Handles the Supabase email-confirmation / magic-link / OAuth (e.g. Kakao) redirect.
 * Defaults to /onboard rather than /dashboard — that page already redirects an
 * already-onboarded user straight to /dashboard, so it's a safe default for both a
 * brand-new signup and a returning user, without this route needing to know which.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const destination = safeAuthRedirectPath(searchParams.get('next'));

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=oauth_callback', origin));
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error('OAuth code exchange failed:', error.message);
    return NextResponse.redirect(new URL('/login?error=oauth_callback', origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // OAuth providers cannot collect eunwon-specific required consent. Route any account that
  // has not completed it through the short post-login form before allowing onboarding.
  if (
    user &&
    (typeof user.user_metadata.user_name !== 'string' ||
      !user.user_metadata.user_name.trim() ||
      typeof user.user_metadata.privacy_consent_at !== 'string')
  ) {
    const completionUrl = new URL('/signup/complete', origin);
    completionUrl.searchParams.set('next', destination);
    return NextResponse.redirect(completionUrl);
  }

  return NextResponse.redirect(new URL(destination, origin));
}
