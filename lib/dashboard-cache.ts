import 'server-only';

import { unstable_cache } from 'next/cache';
import { getUpcomingEvents } from '@/lib/events';
import { getMatchedPrograms } from '@/lib/matching';
import { createServiceClient } from '@/lib/supabase/server';
import type { Event, Profile, Program } from '@/lib/types';

export const DASHBOARD_CACHE_SECONDS = 5 * 60;

export interface DashboardCachedData {
  programs: Program[];
  events: Event[];
  updatedAt: string;
}

export function dashboardCacheTag(userId: string) {
  return `dashboard-data:${userId}`;
}

/**
 * Cache only the expensive public program/event projections. The authenticated
 * page still reads the current session, profile, and saved rows on every render.
 * A per-user key/tag prevents one user's profile-derived result set from being
 * served to another user.
 */
export function getCachedDashboardData(userId: string, profile: Profile) {
  const load = unstable_cache(
    async (): Promise<DashboardCachedData> => {
      const supabase = createServiceClient();
      const [programs, events] = await Promise.all([
        getMatchedPrograms(supabase, profile),
        getUpcomingEvents(supabase, profile),
      ]);

      return { programs, events, updatedAt: new Date().toISOString() };
    },
    ['dashboard-data', userId, profile.updated_at ?? 'profile-without-updated-at'],
    {
      revalidate: DASHBOARD_CACHE_SECONDS,
      tags: [dashboardCacheTag(userId)],
    }
  );

  return load();
}
