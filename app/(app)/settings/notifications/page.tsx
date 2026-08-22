import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { NotificationSettingsForm } from '@/components/settings/NotificationSettingsForm';
import { isProUser } from '@/lib/trial';

export default async function NotificationSettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('notify_email, subscription')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) redirect('/onboard');

  return (
    <NotificationSettingsForm
      userId={user.id}
      initialNotifyEmail={profile.notify_email}
      isPro={isProUser(profile.subscription, user.created_at)}
    />
  );
}
