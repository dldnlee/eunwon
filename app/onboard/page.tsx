import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OnboardingForm } from '@/components/OnboardingForm';

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
    <div className="flex min-h-screen items-center justify-center bg-surface p-md">
      <div className="w-full max-w-lg">
        <h1 className="mb-xxl text-center text-heading-sm text-ink">사업 정보 입력</h1>
        <OnboardingForm userId={user.id} />
      </div>
    </div>
  );
}
