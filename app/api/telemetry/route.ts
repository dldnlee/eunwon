import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { productEventSchema } from '@/lib/telemetry/events';
import { correlationHeaders, requestCorrelationId, serverLog } from '@/lib/observability/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const requestId = requestCorrelationId(request);
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ accepted: false }, { status: 401, headers: correlationHeaders(requestId) });
  const parsed = productEventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ accepted: false }, { status: 400, headers: correlationHeaders(requestId) });

  const { error } = await createServiceClient().from('product_events').insert({
    id: parsed.data.eventId,
    user_id: user.id,
    name: parsed.data.name,
    occurred_at: parsed.data.occurredAt,
    properties: parsed.data.properties,
  });
  if (error && error.code !== '23505') {
    serverLog('error', 'telemetry.insert_failed', { request_id: requestId, code: error.code });
    return NextResponse.json({ accepted: false }, { status: 503, headers: correlationHeaders(requestId) });
  }
  return NextResponse.json({ accepted: true }, { status: 202, headers: correlationHeaders(requestId) });
}
