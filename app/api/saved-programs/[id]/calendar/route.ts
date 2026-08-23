import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildProgramDeadlineIcs } from '@/lib/program-calendar';
import { createClient } from '@/lib/supabase/server';
import type { Program } from '@/lib/types';

const idSchema = z.string().uuid();
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://eunwon.com';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (!idSchema.safeParse(params.id).success) {
    return NextResponse.json({ error: '올바르지 않은 저장 항목입니다.' }, { status: 400 });
  }

  const { data: saved } = await supabase
    .from('saved_programs')
    .select('program:programs(*)')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();
  const program = saved?.program as unknown as Program | null;
  if (!program) return NextResponse.json({ error: '저장한 지원사업을 찾을 수 없습니다.' }, { status: 404 });
  if (!program.deadline_end) {
    return NextResponse.json({ error: '확정된 마감일이 없어 캘린더에 추가할 수 없습니다.' }, { status: 422 });
  }

  const canonicalUrl = new URL(`/program/${program.id}`, APP_URL).toString();
  const calendar = buildProgramDeadlineIcs(program, canonicalUrl);
  return new NextResponse(calendar, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="eunwon-program-${program.id}.ics"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
