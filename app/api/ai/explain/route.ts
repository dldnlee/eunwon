import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { explainMatch } from '@/lib/ai/explainMatch';
import type { Profile, Program } from '@/lib/types';

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  }

  const { programId } = await request.json();
  if (!programId) {
    return NextResponse.json({ error: 'programId가 필요합니다' }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile || profile.subscription !== 'pro') {
    return NextResponse.json({ error: 'Pro 플랜이 필요합니다' }, { status: 403 });
  }

  const { data: program } = await supabase
    .from('programs')
    .select('*')
    .eq('id', programId)
    .single();

  if (!program) {
    return NextResponse.json({ error: '지원사업을 찾을 수 없습니다' }, { status: 404 });
  }

  try {
    const explanation = await explainMatch(program as Program, profile as Profile);
    return NextResponse.json({ explanation });
  } catch (err) {
    console.error('explainMatch failed:', err);
    return NextResponse.json({ error: 'AI 설명 생성에 실패했습니다' }, { status: 500 });
  }
}
