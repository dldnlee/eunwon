import { createClient } from '@/lib/supabase/server';
import { isProUser } from '@/lib/trial';

export interface BusinessPlanExportContext {
  companyName: string;
  programTitle: string;
  agency: string;
  programId: string;
}

export type BusinessPlanExportResult =
  | { ok: true; context: BusinessPlanExportContext }
  | { ok: false; status: number; error: string };

/** Shared auth/ownership/Pro-gating for the .docx and .hwpx export routes. */
export async function resolveBusinessPlanExportContext(programId: string): Promise<BusinessPlanExportResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: 401, error: '로그인이 필요합니다' };

  const [{ data: profile }, { data: program }] = await Promise.all([
    supabase.from('profiles').select('company_name, subscription').eq('id', user.id).maybeSingle(),
    supabase.from('programs').select('id, title, agency').eq('id', programId).maybeSingle(),
  ]);

  if (!profile || !isProUser(profile.subscription, user.created_at)) {
    return { ok: false, status: 403, error: 'Pro 플랜이 필요합니다' };
  }
  if (!program) return { ok: false, status: 404, error: '지원사업을 찾을 수 없습니다' };

  return {
    ok: true,
    context: {
      companyName: profile.company_name ?? '신청 기업',
      programTitle: program.title,
      agency: program.agency,
      programId: program.id,
    },
  };
}
