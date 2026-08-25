import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasAdminCapability } from '@/lib/admin-access';
import { generateDailyDrafts } from '@/lib/marketing/workflow';
import { MARKETING_CONTENT_TYPES, type MarketingContentType } from '@/lib/marketing/types';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * Admin-triggered draft generation (plan Phase 1: "Generate drafts manually from an
 * admin-only endpoint"). The scheduled variant lives at /api/cron/marketing-generate;
 * both share lib/marketing/workflow.ts.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  if (!(await hasAdminCapability(supabase, 'marketing_content_manage'))) {
    return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine — defaults apply
  }

  const rawCount = (body as { count?: unknown })?.count;
  const count = typeof rawCount === 'number' && Number.isInteger(rawCount) && rawCount >= 1 && rawCount <= 5 ? rawCount : 3;

  const rawContentType = (body as { contentType?: unknown })?.contentType;
  const contentType: MarketingContentType =
    typeof rawContentType === 'string' && (MARKETING_CONTENT_TYPES as readonly string[]).includes(rawContentType)
      ? (rawContentType as MarketingContentType)
      : 'program_spotlight';

  try {
    const summary = await generateDailyDrafts(supabase, { count, contentType });
    return NextResponse.json(summary);
  } catch (err) {
    console.error('Marketing draft generation failed:', err);
    return NextResponse.json({ error: '초안 생성 중 오류가 발생했습니다' }, { status: 500 });
  }
}
