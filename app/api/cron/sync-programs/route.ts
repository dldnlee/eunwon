import { NextResponse } from 'next/server';
import { isAuthorizedCronRequest } from '@/lib/cron-auth';
import { syncPrograms } from '@/lib/sync/syncPrograms';
import { correlationHeaders, requestCorrelationId, serverLog } from '@/lib/observability/server';

export const maxDuration = 300; // this can run long — many programs × AI enrichment calls
export const dynamic = 'force-dynamic';

/** Vercel Cron calls this nightly (see vercel.json) with an Authorization: Bearer <CRON_SECRET> header. */
export async function GET(request: Request) {
  const requestId = requestCorrelationId(request);
  const startedAt = Date.now();
  if (!isAuthorizedCronRequest(request)) {
    serverLog('warn', 'cron.sync_programs.unauthorized', { request_id: requestId });
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: correlationHeaders(requestId) });
  }

  try {
    serverLog('info', 'cron.sync_programs.started', { request_id: requestId });
    const result = await syncPrograms();
    serverLog('info', 'cron.sync_programs.completed', { request_id: requestId, duration_ms: Date.now() - startedAt, synced: result.synced, skipped: result.skipped });
    return NextResponse.json(result, { headers: correlationHeaders(requestId) });
  } catch (err) {
    serverLog('error', 'cron.sync_programs.failed', { request_id: requestId, duration_ms: Date.now() - startedAt, error_type: err instanceof Error ? err.name : 'unknown' });
    return NextResponse.json({ error: 'sync failed' }, { status: 500, headers: correlationHeaders(requestId) });
  }
}
