'use client';

import type { ProductEventName } from './events';
type Property = string | number | boolean | null;

/** Best-effort telemetry. Never include PII, free text, document contents, or URLs. */
export function trackProductEvent(name: ProductEventName, properties: Record<string, Property> = {}): void {
  void fetch('/api/telemetry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, eventId: crypto.randomUUID(), occurredAt: new Date().toISOString(), properties }),
    keepalive: true,
  }).catch(() => undefined);
}
