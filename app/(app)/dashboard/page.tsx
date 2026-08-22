import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getMatchedPrograms } from '@/lib/matching';
import { getUpcomingEvents } from '@/lib/events';
import { getPlanStatus } from '@/lib/trial';
import { DashboardClient } from '@/components/DashboardClient';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
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

  const [programs, events, { data: savedRows }] = await Promise.all([
    getMatchedPrograms(supabase, profile as Profile),
    getUpcomingEvents(supabase, profile as Profile),
    supabase.from('saved_programs').select('program_id').eq('user_id', user.id),
  ]);

  const planStatus = getPlanStatus(profile.subscription, user.created_at);
  const isPro = planStatus !== 'free';

  return (
    <div>
      <div className="relative mb-xl min-h-28 overflow-hidden rounded-xl border border-hairline bg-surface p-lg pr-20 sm:flex sm:items-center sm:pr-36">
        <div className="flex flex-col gap-xs">
          <div className="flex flex-wrap items-center gap-sm">
            <h1 className="text-heading-sm text-ink">
              안녕하세요{profile.company_name ? `, ${profile.company_name}님` : ''}
            </h1>
            <Badge variant={planStatus === 'free' ? 'secondary' : planStatus === 'trial' ? 'success' : 'default'}>
              {planStatus === 'pro' ? 'Pro' : planStatus === 'trial' ? '무료체험 중' : '무료 플랜'}
            </Badge>
          </div>
          <p className="text-body-sm text-steel">
            {profile.industry_name ? `${profile.industry_name} · ` : ''}{profile.region} 사업에 맞는
            지원사업을 찾아드릴게요.
          </p>
        </div>
        <Image
          src="/mascot/wave.png"
          alt="인사하는 은원 마스코트"
          width={144}
          height={144}
          priority
          className="absolute -bottom-3 right-xs h-24 w-24 object-contain sm:-bottom-4 sm:right-md sm:h-32 sm:w-32"
        />
      </div>
      <DashboardClient
        userId={user.id}
        profile={profile as Profile}
        initialPrograms={programs}
        initialEvents={events}
        savedProgramIds={(savedRows ?? []).map((r) => r.program_id)}
        isPro={isPro}
        freeLimit={5}
      />
    </div>
  );
}
