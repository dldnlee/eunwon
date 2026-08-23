import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { EventExplorer } from '@/components/EventExplorer';
import { rankEventForProfile } from '@/lib/events';
import type { Event, Profile } from '@/lib/types';

export default async function EventsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: events, error }, { data: savedRows }, { data: profile }] = await Promise.all([
    supabase.from('events').select('*').eq('is_active', true).or(`event_end.is.null,event_end.gte.${today}`).order('event_start', { ascending: true, nullsFirst: false }).limit(200),
    supabase.from('saved_events').select('event_id').eq('user_id', user.id),
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
  ]);
  if (error) throw error;
  if (!profile || !profile.onboarding_complete) redirect('/onboard');
  const rankedEvents = ((events ?? []) as Event[]).map((event) => {
    const ranked = rankEventForProfile(event, profile as Profile);
    return { ...event, relevance_score: ranked.relevanceScore, relevance_reasons: ranked.relevanceReasons };
  });
  return <EventExplorer events={rankedEvents} userId={user.id} savedEventIds={(savedRows ?? []).map((row) => row.event_id)} />;
}
