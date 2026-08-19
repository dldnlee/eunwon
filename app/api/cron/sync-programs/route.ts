import { NextResponse } from 'next/server';
import { syncPrograms } from '@/lib/sync/syncPrograms';

export const maxDuration = 300; // this can run long — many programs × AI enrichment calls
export const dynamic = 'force-dynamic';

/** Vercel Cron calls this nightly (see vercel.json) with an Authorization: Bearer <CRON_SECRET> header. */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const result = await syncPrograms();
    return NextResponse.json(result);
  } catch (err) {
    console.error('sync-programs cron failed:', err);
    return NextResponse.json({ error: 'sync failed' }, { status: 500 });
  }
}
