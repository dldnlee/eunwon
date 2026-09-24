import assert from 'node:assert/strict';
import test from 'node:test';
import { syncEvents } from './syncEvents';

test('incomplete nonempty event responses fail the sync before any event writes', async (t) => {
  const keys = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'BIZINFO_EVENT_API_KEY'] as const;
  const previous = keys.map((key) => process.env[key]);
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://event-test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  process.env.BIZINFO_EVENT_API_KEY = 'test-event-key';
  t.after(() => keys.forEach((key, index) => {
    if (previous[index] === undefined) delete process.env[key];
    else process.env[key] = previous[index];
  }));

  const requests: { path: string; method: string; body: Record<string, unknown> | null }[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
    requests.push({ path: url.pathname, method, body });
    if (url.hostname === 'www.bizinfo.go.kr') {
      return Response.json({ jsonArray: [{ eventInfoId: 'one', title: '행사' }], totalCount: 2 });
    }
    if (url.pathname === '/rest/v1/event_sync_runs' && method === 'POST') {
      return Response.json({ id: 'test-run' });
    }
    if (url.pathname === '/rest/v1/event_sync_runs' && method === 'PATCH') {
      return new Response(null, { status: 204 });
    }
    // Record unexpected writes too, so the assertion catches both upserts and deactivation.
    return new Response(null, { status: 204 });
  });

  await assert.rejects(syncEvents(() => {}), /reported totalCount/);
  assert.equal(requests.filter(({ path }) => path === '/rest/v1/events').length, 0);
  const completion = requests.filter(({ path, method }) => path === '/rest/v1/event_sync_runs' && method === 'PATCH');
  assert.equal(completion.length, 1);
  assert.equal(completion[0].body?.status, 'failed');
  assert.match(String(completion[0].body?.error_message), /reported totalCount/);
});
