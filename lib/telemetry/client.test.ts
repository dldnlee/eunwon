import assert from 'node:assert/strict';
import test from 'node:test';
import { trackProductEvent } from './client';
import { productEventSchema } from './events';

test('client telemetry sends a valid event without waiting for delivery', (t) => {
  let finish!: (response: Response) => void;
  const fetch = t.mock.method(globalThis, 'fetch', () => new Promise<Response>((resolve) => { finish = resolve; }));
  try {
    const result = trackProductEvent('signup_completed', { method: 'email' });

    assert.equal(result, undefined);
    assert.equal(fetch.mock.callCount(), 1);
    const [url, init] = fetch.mock.calls[0].arguments as Parameters<typeof globalThis.fetch>;
    assert.equal(url, '/api/telemetry');
    assert.equal(init?.method, 'POST');
    assert.equal(init?.keepalive, true);
    assert.equal(new Headers(init?.headers).get('content-type'), 'application/json');
    const event = productEventSchema.parse(JSON.parse(String(init?.body)));
    assert.equal(event.name, 'signup_completed');
    assert.deepEqual(event.properties, { method: 'email' });
  } finally {
    finish?.(new Response(null, { status: 202 }));
  }
});

test('client telemetry defaults properties and gives each event its own identity', (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 202 }));
  trackProductEvent('dashboard_viewed');
  trackProductEvent('dashboard_viewed');

  const events = fetch.mock.calls.map((call) => {
    const [, init] = call.arguments as Parameters<typeof globalThis.fetch>;
    return productEventSchema.parse(JSON.parse(String(init?.body)));
  });
  assert.equal(events.length, 2);
  assert.deepEqual(events[0].properties, {});
  assert.notEqual(events[0].eventId, events[1].eventId);
});

for (const [label, crypto] of [['crypto', undefined], ['crypto.randomUUID', {}]] as const) {
  test(`client telemetry lets the caller continue when ${label} is unavailable`, (t) => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto')!;
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: crypto });
    t.after(() => Object.defineProperty(globalThis, 'crypto', descriptor));
    const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 202 }));

    assert.doesNotThrow(() => trackProductEvent('onboarding_completed', { entity_type: '법인' }));
    assert.equal(fetch.mock.callCount(), 0);
  });
}

test('client telemetry contains synchronous request failures', (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new TypeError('Request blocked'); });

  assert.doesNotThrow(() => trackProductEvent('program_saved', { program_id: '11111111-1111-4111-8111-111111111111' }));
  assert.equal(fetch.mock.callCount(), 1);
});

test('client telemetry contains payload serialization failures', (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 202 }));
  const properties = { get method(): string { throw new Error('Unavailable property'); } };

  assert.doesNotThrow(() => trackProductEvent('signup_completed', properties));
  assert.equal(fetch.mock.callCount(), 0);
});

test('client telemetry handles rejected requests without an unhandled rejection', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Network unavailable'); });

  assert.doesNotThrow(() => trackProductEvent('dashboard_viewed'));
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(fetch.mock.callCount(), 1);
});
