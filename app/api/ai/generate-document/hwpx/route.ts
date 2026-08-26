import { NextResponse } from 'next/server';
import { z } from 'zod';
import { renderBusinessPlanHwpx } from '@/lib/business-plan-hwpx';
import { resolveBusinessPlanExportContext } from '@/lib/business-plan-export';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  programId: z.string().uuid(),
  document: z.string().min(1).max(20000),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 });
  }

  const result = await resolveBusinessPlanExportContext(parsed.data.programId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const hwpx = await renderBusinessPlanHwpx({
    companyName: result.context.companyName,
    programTitle: result.context.programTitle,
    agency: result.context.agency,
    generatedAt: new Date(),
    markdown: parsed.data.document,
  });

  return new NextResponse(Buffer.from(hwpx), {
    headers: {
      'Content-Type': 'application/hwp+zip',
      'Content-Disposition': `attachment; filename="eunwon-business-plan-${result.context.programId}.hwpx"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
