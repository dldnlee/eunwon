import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { safeAuthRedirectPath } from '@/lib/auth-redirect';
import { SignupCompletionForm } from '@/components/SignupCompletionForm';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '가입 정보 입력',
  robots: { index: false, follow: false },
};

export default async function SignupCompletionPage({
  searchParams,
}: {
  searchParams: { next?: string | string[] };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const requestedNext = safeAuthRedirectPath(searchParams.next);
  const next = ['/signup', '/signup/complete', '/login', '/auth/callback'].some((path) => requestedNext.startsWith(path))
    ? '/onboard'
    : requestedNext;
  const metadata = user.user_metadata;
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_complete')
    .eq('id', user.id)
    .maybeSingle();
  const destination = profile?.onboarding_complete
    ? (next === '/onboard' ? '/dashboard' : next)
    : '/onboard';

  if (
    typeof metadata.user_name === 'string' &&
    metadata.user_name.trim() &&
    typeof metadata.privacy_consent_at === 'string'
  ) {
    redirect(destination);
  }
  const suggestedName = [metadata.user_name, metadata.full_name, metadata.name, metadata.nickname]
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0) ?? '';

  return (
    <SignupCompletionForm
      initialName={suggestedName}
      initialCompanyName={typeof metadata.company_name === 'string' ? metadata.company_name : ''}
      nextPath={destination}
    />
  );
}
