import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateProgramMatches } from '@/lib/ai/rateProgramMatch';
import { isProUser } from '@/lib/trial';
import type { Profile } from '@/lib/types';

const MAX_PROGRAMS_PER_REQUEST = 30;

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  }

  const { programIds } = await request.json();
  if (!Array.isArray(programIds) || programIds.length === 0) {
    return NextResponse.json({ error: 'programIds가 필요합니다' }, { status: 400 });
  }

  const cleanedIds = programIds.filter((id): id is string => typeof id === 'string').slice(0, MAX_PROGRAMS_PER_REQUEST);
  if (cleanedIds.length === 0) {
    return NextResponse.json({ error: '유효한 programIds가 없습니다' }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile || !isProUser(profile.subscription, user.created_at)) {
    return NextResponse.json({ error: 'Pro 플랜이 필요합니다' }, { status: 403 });
  }

  // Re-fetch title/description server-side by id rather than trusting whatever text the client
  // sends — same pattern as /api/ai/explain and /api/ai/generate-document.
  const { data: programs } = await supabase
    .from('programs')
    .select('id, title, description')
    .in('id', cleanedIds);

  if (!programs || programs.length === 0) {
    return NextResponse.json({ error: '지원사업을 찾을 수 없습니다' }, { status: 404 });
  }

  try {
    const ratings = await rateProgramMatches(programs, profile as Profile);
    return NextResponse.json({ ratings });
  } catch (err) {
    console.error('rateProgramMatches failed:', err);
    return NextResponse.json({ error: 'AI 매칭도 분석에 실패했습니다' }, { status: 500 });
  }
}
