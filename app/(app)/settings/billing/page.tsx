import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BillingSection } from '@/components/settings/BillingSection';
import type { Profile } from '@/lib/types';

export default async function BillingSettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

  if (!profile) redirect('/onboard');

  return <BillingSection profile={profile as Profile} />;
}
