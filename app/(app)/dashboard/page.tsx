import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMatchedPrograms } from '@/lib/matching';
import { DashboardClient } from '@/components/DashboardClient';
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

  if (!profile) redirect('/onboarding');

  const [programs, { data: savedRows }] = await Promise.all([
    getMatchedPrograms(supabase, profile as Profile),
    supabase.from('saved_programs').select('program_id').eq('user_id', user.id),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">
        {profile.business_name ?? '내 사업'}에 맞는 지원사업
      </h1>
      <DashboardClient
        userId={user.id}
        initialPrograms={programs}
        savedProgramIds={(savedRows ?? []).map((r) => r.program_id)}
        isPro={profile.subscription === 'pro'}
        freeLimit={5}
      />
    </div>
  );
}
