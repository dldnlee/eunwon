'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { dashboardCacheTag } from '@/lib/dashboard-cache';
import { createClient } from '@/lib/supabase/server';

export async function refreshDashboardData(): Promise<{ ok: boolean }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false };

  revalidateTag(dashboardCacheTag(user.id));
  revalidatePath('/dashboard');
  return { ok: true };
}
