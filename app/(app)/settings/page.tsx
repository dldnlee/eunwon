import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SettingsForm } from '@/components/SettingsForm';
import type { Profile } from '@/lib/types';

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

  if (!profile) redirect('/onboarding');

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-xl text-heading-sm text-ink">설정</h1>
      <SettingsForm profile={profile as Profile} />
    </div>
  );
}
