import { randomUUID } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { serverLog } from '@/lib/observability/server';
import { productEventSchema, type ProductEventName } from './events';

/** Records an event after an authoritative server-side success. Never throws into product flows. */
export async function recordProductEvent(input: {
  userId: string;
  name: ProductEventName;
  properties?: Record<string, string | number | boolean | null>;
}): Promise<void> {
  const event = productEventSchema.safeParse({
    name: input.name,
    eventId: randomUUID(),
    occurredAt: new Date().toISOString(),
    properties: input.properties ?? {},
  });
  if (!event.success) {
    serverLog('error', 'telemetry.server_event_invalid', { event_name: input.name });
    return;
  }

  try {
    const { error } = await createServiceClient().from('product_events').insert({
      id: event.data.eventId,
      user_id: input.userId,
      name: event.data.name,
      occurred_at: event.data.occurredAt,
      properties: event.data.properties,
    });
    if (error && error.code !== '23505') {
      serverLog('error', 'telemetry.server_insert_failed', { event_name: input.name, code: error.code });
    }
  } catch (error) {
    serverLog('error', 'telemetry.server_insert_failed', {
      event_name: input.name,
      error_type: error instanceof Error ? error.name : 'unknown',
    });
  }
}
