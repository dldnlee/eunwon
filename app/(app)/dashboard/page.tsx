import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCachedDashboardData } from '@/lib/dashboard-cache';
import { isProUser } from '@/lib/trial';
import { DashboardClient } from '@/components/DashboardClient';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import type { Profile } from '@/lib/types';
import { TrackProductEvent } from '@/components/TrackProductEvent';

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

  const [{ programs, events, updatedAt }, { data: savedRows }] = await Promise.all([
    getCachedDashboardData(user.id, profile as Profile),
    supabase.from('saved_programs').select('program_id').eq('user_id', user.id),
  ]);

  const isPro = isProUser(profile.subscription, user.created_at);

  return (
    <div>
      <TrackProductEvent name="dashboard_viewed" />
      <TrackProductEvent name="matches_viewed" properties={{ result_count: programs.length }} />
      <div className="relative mb-xl min-h-28 overflow-hidden rounded-xl border border-hairline bg-surface p-lg pr-20 sm:flex sm:items-center sm:pr-36">
        <div className="flex flex-col gap-xs">
          <div className="flex flex-wrap items-center gap-sm">
            <h1 className="text-heading-sm text-ink">
              안녕하세요, {typeof user.user_metadata.user_name === 'string' ? user.user_metadata.user_name : '고객'}님
            </h1>
            <Badge variant="success">모든 기능 무료</Badge>
          </div>
          <p className="text-body-sm text-steel">
            {profile.company_name ? `${profile.company_name} · ` : ''}{profile.industry_name ? `${profile.industry_name} · ` : ''}{profile.region} 사업에 맞는
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
        lastUpdatedAt={updatedAt}
        savedProgramIds={(savedRows ?? []).map((r) => r.program_id)}
        isPro={isPro}
        freeLimit={5}
      />
    </div>
  );
}
