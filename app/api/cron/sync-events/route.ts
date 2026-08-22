import { NextResponse } from 'next/server';
import { syncEvents } from '@/lib/sync/syncEvents';

export const maxDuration = 120; // no AI enrichment involved — should finish well under this
export const dynamic = 'force-dynamic';

/** Vercel Cron calls this nightly (see vercel.json) with an Authorization: Bearer <CRON_SECRET> header. */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const result = await syncEvents();
    return NextResponse.json(result);
  } catch (err) {
    console.error('sync-events cron failed:', err);
    return NextResponse.json({ error: 'sync failed' }, { status: 500 });
  }
}
