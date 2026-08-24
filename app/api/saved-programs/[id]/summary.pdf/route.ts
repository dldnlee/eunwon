import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildApplicationSummarySnapshot, type SummaryChecklistItem } from '@/lib/application-summary';
import { renderApplicationSummaryPdf } from '@/lib/application-summary-pdf';
import { loadEligibilityGapAnalysis } from '@/lib/eligibility/load-gap-analysis';
import { createClient } from '@/lib/supabase/server';
import type { Profile, Program, SavedStatus } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const idSchema = z.string().uuid();

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (!idSchema.safeParse(params.id).success) {
    return NextResponse.json({ error: '올바르지 않은 저장 항목입니다.' }, { status: 400 });
  }

  const [{ data: saved, error: savedError }, { data: profile, error: profileError }] = await Promise.all([
    supabase.from('saved_programs')
      .select('status,notes,outcome,submitted_at,next_action,next_action_due_at,program:programs(*)')
      .eq('id', params.id).eq('user_id', user.id).maybeSingle(),
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
  ]);
  if (savedError || profileError) return NextResponse.json({ error: '신청 요약을 불러오지 못했어요.' }, { status: 500 });
  const program = saved?.program as unknown as Program | null;
  if (!saved || !program) return NextResponse.json({ error: '저장한 지원사업을 찾을 수 없습니다.' }, { status: 404 });
  if (!profile) return NextResponse.json({ error: '사업자 프로필을 먼저 완성해 주세요.' }, { status: 422 });

  const [{ data: checklist, error: checklistError }, gap] = await Promise.all([
    supabase.from('saved_program_checklist_items')
      .select('label,completed,verification,confidence,evidence_quote,source_title,source_url')
      .eq('saved_program_id', params.id).eq('user_id', user.id).order('completed').order('created_at'),
    loadEligibilityGapAnalysis(supabase, program.id, profile as Profile),
  ]);
  if (checklistError) return NextResponse.json({ error: '준비 목록을 불러오지 못했어요.' }, { status: 500 });

  const snapshot = buildApplicationSummarySnapshot({
    generatedAt: new Date().toISOString(), program,
    saved: {
      status: saved.status as SavedStatus,
      notes: saved.notes, outcome: saved.outcome, submittedAt: saved.submitted_at,
      nextAction: saved.next_action, nextActionDueAt: saved.next_action_due_at,
    },
    checklist: (checklist ?? []).map((item) => ({
      label: item.label, completed: item.completed,
      verification: item.verification, confidence: item.confidence == null ? null : Number(item.confidence),
      evidenceQuote: item.evidence_quote, sourceTitle: item.source_title, sourceUrl: item.source_url,
    })) as SummaryChecklistItem[],
    eligibility: gap.analysis,
  });
  const font = await readFile(path.join(process.cwd(), 'assets/fonts/NanumGothic-Regular.ttf'));
  const pdf = await renderApplicationSummaryPdf(snapshot, font);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="eunwon-application-${program.id}.pdf"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
