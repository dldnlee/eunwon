import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { hasAdminCapability } from '@/lib/admin-access';
import { generateDraftForProgram, GENERATION_VERSION } from '@/lib/marketing/generate-draft';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approve'),
  }),
  z.object({
    action: z.literal('reject'),
    reason: z.string().min(3).max(500),
  }),
  z.object({
    action: z.literal('schedule'),
    scheduledFor: z.string().datetime(),
  }),
  z.object({
    action: z.literal('update_caption'),
    caption: z.string().min(1).max(2200),
  }),
]);

/**
 * Post workflow actions for /admin/marketing (plan §4 step 6). Every transition is
 * capability-checked in server code and again by RLS; approvals/rejections are recorded
 * to the append-only admin audit trail.
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  if (!(await hasAdminCapability(supabase, 'marketing_content_manage'))) {
    return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
  }

  const parsedBody = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다' }, { status: 400 });
  }

  const { data: post } = await supabase
    .from('marketing_posts')
    .select('id, status, program_id, generated_content, fact_snapshot')
    .eq('id', params.id)
    .maybeSingle();

  if (!post) {
    return NextResponse.json({ error: '게시물을 찾을 수 없습니다' }, { status: 404 });
  }

  const body = parsedBody.data;
  const nowIso = new Date().toISOString();
  let update: Record<string, unknown> | null = null;
  let auditAction: string;
  let auditSummary: Record<string, unknown>;

  switch (body.action) {
    case 'approve': {
      if (post.status !== 'awaiting_approval') {
        return NextResponse.json({ error: `승인 대기 상태가 아닙니다 (현재: ${post.status})` }, { status: 409 });
      }
      const { data: { user } } = await supabase.auth.getUser();
      update = { status: 'approved', approved_at: nowIso, approved_by: user!.id };
      auditAction = 'marketing_post.approved';
      auditSummary = { status: post.status };
      break;
    }
    case 'reject': {
      if (!['awaiting_approval', 'validation_failed', 'approved', 'scheduled'].includes(post.status)) {
        return NextResponse.json({ error: `이 상태에서는 거절할 수 없습니다 (현재: ${post.status})` }, { status: 409 });
      }
      update = { status: 'rejected', rejected_reason: body.reason };
      auditAction = 'marketing_post.rejected';
      auditSummary = { reason: body.reason };
      break;
    }
    case 'schedule': {
      if (post.status !== 'approved') {
        return NextResponse.json({ error: `승인된 게시물만 예약할 수 있습니다 (현재: ${post.status})` }, { status: 409 });
      }
      if (new Date(body.scheduledFor).getTime() < Date.now()) {
        return NextResponse.json({ error: '예약 시각은 현재 이후여야 합니다' }, { status: 422 });
      }
      update = { status: 'scheduled', scheduled_for: body.scheduledFor };
      auditAction = 'marketing_post.scheduled';
      auditSummary = { scheduledFor: body.scheduledFor };
      break;
    }
    case 'update_caption': {
      if (!['awaiting_approval', 'rejected'].includes(post.status)) {
        return NextResponse.json({ error: `이 상태에서는 수정할 수 없습니다 (현재: ${post.status})` }, { status: 409 });
      }
      update = { caption: body.caption };
      auditAction = 'marketing_post.caption_edited';
      auditSummary = { length: body.caption.length };
      break;
    }
  }

  const { error: updateError } = await supabase
    .from('marketing_posts')
    .update(update!)
    .eq('id', params.id);

  if (updateError) {
    console.error('Marketing post update failed:', updateError.message);
    return NextResponse.json({ error: '업데이트에 실패했습니다' }, { status: 500 });
  }

  await supabase.rpc('record_admin_audit_event', {
    event_action: auditAction,
    event_target_type: 'marketing_post',
    event_target_id: params.id,
    event_safe_summary: auditSummary,
  });

  return NextResponse.json({ ok: true });
}

/** Regenerate a draft from its underlying program — plan §4 step 6 "regenerate". */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  if (!(await hasAdminCapability(supabase, 'marketing_content_manage'))) {
    return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
  }

  const { data: post } = await supabase
    .from('marketing_posts')
    .select('id, status, program_id')
    .eq('id', params.id)
    .maybeSingle();

  if (!post) {
    return NextResponse.json({ error: '게시물을 찾을 수 없습니다' }, { status: 404 });
  }
  if (!['awaiting_approval', 'validation_failed', 'rejected'].includes(post.status)) {
    return NextResponse.json({ error: `이 상태에서는 재생성할 수 없습니다 (현재: ${post.status})` }, { status: 409 });
  }
  if (!post.program_id) {
    return NextResponse.json({ error: '연결된 지원사업이 없어 재생성할 수 없습니다' }, { status: 422 });
  }

  const [{ data: program }] = await Promise.all([
    supabase.from('programs').select('*').eq('id', post.program_id).maybeSingle(),
  ]);
  if (!program) {
    return NextResponse.json({ error: '원본 지원사업을 찾을 수 없습니다' }, { status: 404 });
  }

  await supabase.from('marketing_posts').update({ status: 'generating', validation_errors: null }).eq('id', params.id);

  try {
    const result = await generateDraftForProgram(supabase, program as Parameters<typeof generateDraftForProgram>[1]);
    const failed = result.validationErrors.length > 0 || result.content === null;
    await supabase
      .from('marketing_posts')
      .update({
        status: failed ? 'validation_failed' : 'awaiting_approval',
        generated_content: result.content,
        fact_snapshot: result.factSnapshot,
        validation_errors: failed ? result.validationErrors : null,
        caption: result.content?.caption ?? null,
        generation_version: GENERATION_VERSION,
      })
      .eq('id', params.id);
  } catch (err) {
    await supabase
      .from('marketing_posts')
      .update({
        status: 'validation_failed',
        validation_errors: [err instanceof Error ? err.message : '재생성 중 알 수 없는 오류'],
      })
      .eq('id', params.id);
    return NextResponse.json({ error: '재생성 중 오류가 발생했습니다' }, { status: 500 });
  }

  await supabase.rpc('record_admin_audit_event', {
    event_action: 'marketing_post.regenerated',
    event_target_type: 'marketing_post',
    event_target_id: params.id,
    event_safe_summary: {},
  });

  return NextResponse.json({ ok: true });
}
