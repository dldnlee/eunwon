import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMatchedPrograms } from '@/lib/matching';
import { DashboardClient } from '@/components/DashboardClient';
import { Badge } from '@/components/ui/badge';
import type { Profile } from '@/lib/types';

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || !profile.onboarding_complete) redirect('/onboard');

  const [programs, { data: savedRows }] = await Promise.all([
    getMatchedPrograms(supabase, profile as Profile),
    supabase.from('saved_programs').select('program_id').eq('user_id', user.id),
  ]);

  const isPro = profile.subscription === 'pro';

  return (
    <div>
      <div className="mb-xl flex flex-col gap-xs">
        <div className="flex items-center gap-sm">
          <h1 className="text-heading-sm text-ink">
            안녕하세요{profile.company_name ? `, ${profile.company_name}님` : ''}
          </h1>
          <Badge variant={isPro ? 'default' : 'secondary'}>{isPro ? 'Pro' : '무료 플랜'}</Badge>
        </div>
        <p className="text-body-sm text-steel">
          {profile.industry_name ? `${profile.industry_name} · ` : ''}{profile.region} 사업에 맞는
          지원사업을 찾아드릴게요.
        </p>
      </div>
      <DashboardClient
        userId={user.id}
        profile={profile as Profile}
        initialPrograms={programs}
        savedProgramIds={(savedRows ?? []).map((r) => r.program_id)}
        isPro={isPro}
        freeLimit={5}
      />
    </div>
  );
}
