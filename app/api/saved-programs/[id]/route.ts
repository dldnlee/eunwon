import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const optionalDate = z.union([
  z.literal(''),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식이 올바르지 않습니다.'),
  z.null(),
]);
const idSchema = z.string().uuid();

const updateSchema = z.object({
  notes: z.string().max(5000).optional(),
  outcome: z.string().max(2000).nullable().optional(),
  receivedAt: optionalDate.optional(),
  amountKrw: z.number().int().min(0).max(2147483647).nullable().optional(),
  nextAction: z.string().trim().max(500).nullable().optional(),
  nextActionDueAt: optionalDate.optional(),
}).refine((value) => Object.keys(value).length > 0, '변경할 내용이 없습니다.');

export async function PATCH(
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
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? '입력값을 확인해주세요.' },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.notes !== undefined) updates.notes = input.notes;
  if (input.outcome !== undefined) updates.outcome = input.outcome || null;
  if (input.receivedAt !== undefined) updates.received_at = input.receivedAt || null;
  if (input.amountKrw !== undefined) updates.amount_krw = input.amountKrw;
  if (input.nextAction !== undefined) updates.next_action = input.nextAction || null;
  if (input.nextActionDueAt !== undefined) updates.next_action_due_at = input.nextActionDueAt || null;

  const { data, error } = await supabase
    .from('saved_programs')
    .update(updates)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select('id,status,notes,outcome,received_at,amount_krw,submitted_at,next_action,next_action_due_at,updated_at')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: '저장하지 못했어요. 잠시 후 다시 시도해주세요.' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: '저장한 지원사업을 찾을 수 없습니다.' }, { status: 404 });
  }

  return NextResponse.json({ savedProgram: data });
}
