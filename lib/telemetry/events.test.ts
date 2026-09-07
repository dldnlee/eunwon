import assert from 'node:assert/strict';
import test from 'node:test';
import { productEventSchema } from './events';

const base = {
  name: 'program_opened',
  eventId: 'd0dd5ddd-8159-4e16-89dd-7e1db0658810',
  occurredAt: '2026-09-05T00:00:00.000Z',
};

test('accepts the exact allowlisted properties for an event', () => {
  assert.equal(productEventSchema.safeParse({ ...base, properties: { program_id: base.eventId } }).success, true);
});

test('rejects unknown events and nested or oversized telemetry payloads', () => {
  assert.equal(productEventSchema.safeParse({ ...base, name: 'email_captured', properties: {} }).success, false);
  assert.equal(productEventSchema.safeParse({ ...base, properties: { program_id: base.eventId, email: 'person@example.com' } }).success, false);
  assert.equal(productEventSchema.safeParse({ ...base, properties: { note: 'x'.repeat(101) } }).success, false);
});
