import type { SupabaseClient } from '@supabase/supabase-js';
import type { Event, Profile } from '@/lib/types';

/**
 * Upcoming business-support events relevant to a profile — same region logic
 * as getMatchedPrograms() in lib/matching.ts (nationwide or region match),
 * but events have no entity_type/age eligibility to filter on.
 */
export async function getUpcomingEvents(
  supabase: SupabaseClient,
  profile: Pick<Profile, 'region'>,
  options: { limit?: number } = {}
): Promise<Event[]> {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('is_active', true)
    .or(`event_end.is.null,event_end.gte.${today}`)
    .or(`is_nationwide.eq.true,region.cs.{"${profile.region}"}`)
    .order('event_start', { ascending: true, nullsFirst: false })
    .limit(options.limit ?? 50);

  if (error) throw error;
  return data ?? [];
}
