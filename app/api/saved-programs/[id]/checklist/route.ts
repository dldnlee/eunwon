import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildChecklistSeeds, type RequirementForChecklist } from '@/lib/preparation-checklist';
import { createClient } from '@/lib/supabase/server';

const idSchema = z.string().uuid();
const createSchema = z.object({ label: z.string().trim().min(1).max(500) });
const updateSchema = z.object({ itemId: z.string().uuid(), completed: z.boolean() });
const deleteSchema = z.object({ itemId: z.string().uuid() });

async function context(savedProgramId: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 }) };
  if (!idSchema.safeParse(savedProgramId).success) {
    return { response: NextResponse.json({ error: '올바르지 않은 저장 항목입니다.' }, { status: 400 }) };
  }
  const { data: saved } = await supabase
    .from('saved_programs')
    .select('id,program_id')
    .eq('id', savedProgramId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!saved) {
    return { response: NextResponse.json({ error: '저장한 지원사업을 찾을 수 없습니다.' }, { status: 404 }) };
  }
  return { supabase, user, saved };
}

function serialize(item: Record<string, unknown>) {
  return {
    id: item.id,
    label: item.label,
    completed: item.completed,
    verification: item.verification,
    confidence: item.confidence == null ? null : Number(item.confidence),
    evidenceQuote: item.evidence_quote,
    sourceTitle: item.source_title,
    sourceUrl: item.source_url,
  };
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const ctx = await context(params.id);
  if ('response' in ctx) return ctx.response;
  const { supabase, user, saved } = ctx;

  let { data: items, error } = await supabase
    .from('saved_program_checklist_items')
    .select('id,label,completed,verification,confidence,evidence_quote,source_title,source_url')
    .eq('saved_program_id', saved.id)
    .order('completed')
    .order('created_at');
  if (error) return NextResponse.json({ error: '준비 목록을 불러오지 못했어요.' }, { status: 500 });

  const { data: latestRun } = await supabase
    .from('program_extraction_runs')
    .select('id,status')
    .eq('program_id', saved.program_id)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if ((items ?? []).length === 0 && latestRun?.status === 'succeeded') {
    const { data: requirements } = await supabase
      .from('program_eligibility_requirements')
      .select('id,requirement_type,normalized_text,verification,confidence,evidence_quote,program_source_documents(title,source_url)')
      .eq('extraction_run_id', latestRun.id)
      .order('created_at');
    const seeds = buildChecklistSeeds((requirements ?? []) as unknown as RequirementForChecklist[]);
    if (seeds.length > 0) {
      const { error: seedError } = await supabase
        .from('saved_program_checklist_items')
        .upsert(seeds.map((seed) => ({
          ...seed,
          saved_program_id: saved.id,
          user_id: user.id,
        })), { onConflict: 'saved_program_id,source_requirement_id', ignoreDuplicates: true });
      if (seedError) {
        return NextResponse.json({ error: '출처 기반 준비 목록을 만들지 못했어요.' }, { status: 500 });
      }
      const refreshed = await supabase
        .from('saved_program_checklist_items')
        .select('id,label,completed,verification,confidence,evidence_quote,source_title,source_url')
        .eq('saved_program_id', saved.id)
        .order('completed')
        .order('created_at');
      items = refreshed.data;
      error = refreshed.error;
      if (error) return NextResponse.json({ error: '준비 목록을 불러오지 못했어요.' }, { status: 500 });
    }
  }

  const sourceStatus = latestRun?.status === 'running'
    ? 'pending'
    : latestRun?.status === 'succeeded'
      ? ((items ?? []).some((item) => item.verification !== 'user') ? 'ready' : 'unavailable')
      : 'unavailable';
  return NextResponse.json({ items: (items ?? []).map(serialize), sourceStatus });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const ctx = await context(params.id);
  if ('response' in ctx) return ctx.response;
  const body = createSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: '준비할 내용을 500자 이내로 입력해주세요.' }, { status: 400 });
  const { data, error } = await ctx.supabase
    .from('saved_program_checklist_items')
    .insert({ saved_program_id: ctx.saved.id, user_id: ctx.user.id, label: body.data.label, verification: 'user' })
    .select('id,label,completed,verification,confidence,evidence_quote,source_title,source_url')
    .single();
  if (error) return NextResponse.json({ error: '항목을 추가하지 못했어요.' }, { status: 500 });
  return NextResponse.json({ item: serialize(data) }, { status: 201 });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const ctx = await context(params.id);
  if ('response' in ctx) return ctx.response;
  const body = updateSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: '올바르지 않은 항목입니다.' }, { status: 400 });
  const { data, error } = await ctx.supabase
    .from('saved_program_checklist_items')
    .update({ completed: body.data.completed, updated_at: new Date().toISOString() })
    .eq('id', body.data.itemId)
    .eq('saved_program_id', ctx.saved.id)
    .eq('user_id', ctx.user.id)
    .select('id')
    .maybeSingle();
  if (error) return NextResponse.json({ error: '항목을 변경하지 못했어요.' }, { status: 500 });
  if (!data) return NextResponse.json({ error: '항목을 찾을 수 없습니다.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const ctx = await context(params.id);
  if ('response' in ctx) return ctx.response;
  const body = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: '올바르지 않은 항목입니다.' }, { status: 400 });
  const { data, error } = await ctx.supabase
    .from('saved_program_checklist_items')
    .delete()
    .eq('id', body.data.itemId)
    .eq('saved_program_id', ctx.saved.id)
    .eq('user_id', ctx.user.id)
    .select('id')
    .maybeSingle();
  if (error) return NextResponse.json({ error: '항목을 삭제하지 못했어요.' }, { status: 500 });
  if (!data) return NextResponse.json({ error: '항목을 찾을 수 없습니다.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
