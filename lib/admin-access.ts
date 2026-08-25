import type { SupabaseClient } from '@supabase/supabase-js';

export type AdminCapability =
  | 'admin_access' | 'user_read' | 'notification_read' | 'import_read'
  | 'eligibility_review' | 'billing_read' | 'billing_manage' | 'role_manage'
  | 'marketing_content_manage'
  | 'audit_read' | 'audit_write';

export async function hasAdminCapability(supabase: SupabaseClient, capability: AdminCapability): Promise<boolean> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return false;
  const { data, error } = await supabase.rpc('has_admin_capability', { requested_capability: capability });
  return !error && data === true;
}
