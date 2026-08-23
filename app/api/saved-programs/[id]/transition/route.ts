import { NextResponse } from 'next/server';
import { z } from 'zod';
import { SAVED_STATUSES } from '@/lib/application-status';
import { createClient } from '@/lib/supabase/server';

const bodySchema = z.object({ status: z.enum(SAVED_STATUSES) });
const idSchema = z.string().uuid();

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  if (!idSchema.safeParse(params.id).success) {
    return NextResponse.json({ error: '올바르지 않은 저장 항목입니다.' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '올바른 진행 상태를 선택해주세요.' }, { status: 400 });
  }

  const { data, error } = await supabase.rpc('transition_saved_program', {
    p_saved_program_id: params.id,
    p_to_status: parsed.data.status,
  });

  if (error) {
    const notFound = error.code === 'P0002';
    return NextResponse.json(
      { error: notFound ? '저장한 지원사업을 찾을 수 없습니다.' : '진행 상태를 변경하지 못했어요.' },
      { status: notFound ? 404 : 409 }
    );
  }

  return NextResponse.json({ savedProgram: data });
}
