import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OnboardingForm } from '@/components/OnboardingForm';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '사업 정보 입력',
  robots: { index: false, follow: false },
};

export default async function OnboardingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_complete')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.onboarding_complete) redirect('/dashboard');

  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-screen items-center justify-center bg-surface p-md focus:outline-none">
      <div className="w-full max-w-lg">
        <h1 className="mb-xxl text-center text-heading-sm text-ink">사업 정보 입력</h1>
        <OnboardingForm
          userId={user.id}
          initialUserName={typeof user.user_metadata.user_name === 'string' ? user.user_metadata.user_name : ''}
          initialCompanyName={typeof user.user_metadata.company_name === 'string' ? user.user_metadata.company_name : ''}
        />
      </div>
    </main>
  );
}
