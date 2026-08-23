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
    .select('notify_email, notify_opportunity_digest, notify_deadline_reminders, deadline_reminder_days, notify_event_reminders, event_reminder_days, subscription')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) redirect('/onboard');

  return (
    <NotificationSettingsForm
      userId={user.id}
      initialOpportunityDigest={profile.notify_opportunity_digest ?? profile.notify_email}
      initialDeadlineReminders={profile.notify_deadline_reminders ?? profile.notify_email}
      initialDeadlineReminderDays={profile.deadline_reminder_days ?? [7, 3, 1]}
      initialEventReminders={profile.notify_event_reminders ?? false}
      initialEventReminderDays={profile.event_reminder_days ?? [7, 1]}
      isPro={isProUser(profile.subscription, user.created_at)}
    />
  );
}
