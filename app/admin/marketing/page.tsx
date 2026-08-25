import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasAdminCapability } from '@/lib/admin-access';
import type { MarketingPostRow } from '@/lib/marketing/types';
import { MarketingDashboard } from '@/components/admin/marketing/MarketingDashboard';

export const dynamic = 'force-dynamic';

/**
 * Marketing workflow management — docs/automated-instagram-marketing-plan.md Phase 3.
 * Reads go through the user-scoped client so RLS (has_admin_capability-backed policies)
 * is the enforcement layer, not just this page's check.
 */
export default async function AdminMarketingPage() {
  const supabase = createClient();
  if (!(await hasAdminCapability(supabase, 'marketing_content_manage'))) {
    redirect('/dashboard');
  }

  const { data: posts } = await supabase
    .from('marketing_posts')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(200);

  return <MarketingDashboard initialPosts={(posts ?? []) as unknown as MarketingPostRow[]} />;
}
