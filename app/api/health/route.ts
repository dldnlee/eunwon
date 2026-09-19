import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { correlationHeaders, requestCorrelationId, serverLog } from '@/lib/observability/server';

export const dynamic = 'force-dynamic';
const REQUIRED_CONFIGURATION = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'] as const;

export async function GET(request: Request) {
  const requestId = requestCorrelationId(request);
  const configured = REQUIRED_CONFIGURATION.every((key) => Boolean(process.env[key]));
  let database = false;

  if (configured) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false } }
      );
      // Readiness needs only a reachable table, not a total count or retry traffic.
      const { error } = await supabase.from('programs')
        .select('id', { head: true }).limit(1)
        .abortSignal(controller.signal).retry(false);
      database = !error;
    } catch {
      database = false;
    } finally {
      clearTimeout(timeout);
    }
  }

  const ready = configured && database;
  serverLog(ready ? 'info' : 'warn', 'readiness.checked', { request_id: requestId, configured, database });
  return NextResponse.json(
    { status: ready ? 'ready' : 'not_ready', checks: { configuration: configured, database } },
    { status: ready ? 200 : 503, headers: correlationHeaders(requestId) }
  );
}
