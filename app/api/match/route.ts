import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMatchedPrograms } from '@/lib/matching';
import type { Profile } from '@/lib/types';

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: '사업 프로필을 먼저 등록해주세요' }, { status: 400 });
  }

  const programs = await getMatchedPrograms(supabase, profile as Profile);
  return NextResponse.json({ programs });
}
