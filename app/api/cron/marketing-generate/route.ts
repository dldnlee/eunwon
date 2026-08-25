import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { generateDailyDrafts } from '@/lib/marketing/workflow';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/** Daily candidate generation (plan §6: 18:00 KST → 09:00 UTC in vercel.json). */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const summary = await generateDailyDrafts(createServiceClient(), { count: 3 });
    return NextResponse.json(summary);
  } catch (err) {
    console.error('Marketing generation cron failed:', err);
    return NextResponse.json({ error: 'generation failed' }, { status: 500 });
  }
}
