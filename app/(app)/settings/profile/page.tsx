import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProfileForm } from '@/components/settings/ProfileForm';
import type { Profile } from '@/lib/types';

export default async function ProfileSettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

  if (!profile) redirect('/onboard');

  return <ProfileForm profile={profile as Profile} />;
}
