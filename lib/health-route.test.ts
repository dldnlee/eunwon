import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { GET } from '../app/api/health/route';

function setup(t: TestContext, fetch: typeof globalThis.fetch) {
  const keys = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'] as const;
  const previous = keys.map((key) => process.env[key]);
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://health-test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  t.after(() => keys.forEach((key, index) => {
    if (previous[index] === undefined) delete process.env[key];
    else process.env[key] = previous[index];
  }));
  t.mock.method(console, 'info', () => {});
  t.mock.method(console, 'warn', () => {});
  return t.mock.method(globalThis, 'fetch', fetch);
}

function request() {
  return new Request('https://example.com/api/health', {
    headers: { 'X-Request-ID': 'health-test-request' },
  });
}

test('health checks connectivity without counting or downloading program rows', async (t) => {
  const fetch = setup(t, async () => new Response(null, { status: 200 }));

  const response = await GET(request());

  assert.equal(fetch.mock.callCount(), 1);
  const [input, init] = fetch.mock.calls[0].arguments;
  const url = new URL(String(input));
  assert.equal(url.pathname, '/rest/v1/programs');
  assert.equal(url.searchParams.get('select'), 'id');
  assert.equal(url.searchParams.get('limit'), '1');
  assert.equal(init?.method, 'HEAD');
  assert.doesNotMatch(new Headers(init?.headers).get('prefer') ?? '', /count=/);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: 'ready', checks: { configuration: true, database: true },
  });
  assert.equal(response.headers.get('x-request-id'), 'health-test-request');
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('health considers an accessible empty programs table ready', async (t) => {
  setup(t, async () => new Response(null, {
    status: 200, headers: { 'content-range': '*/0' },
  }));

  const response = await GET(request());

  assert.equal(response.status, 200);
  assert.equal((await response.json()).checks.database, true);
});

for (const missingKey of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']) {
  test(`health skips the database when ${missingKey} is missing`, async (t) => {
    const fetch = setup(t, async () => { throw new Error('Unexpected database request'); });
    delete process.env[missingKey];

    const response = await GET(request());

    assert.equal(fetch.mock.callCount(), 0);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      status: 'not_ready', checks: { configuration: false, database: false },
    });
  });
}

test('health returns an unavailable response for invalid database configuration', async (t) => {
  const fetch = setup(t, async () => { throw new Error('Unexpected database request'); });
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'invalid-url';

  const response = await GET(request());

  assert.equal(fetch.mock.callCount(), 0);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).checks.database, false);
});

test('health reports database errors without exposing provider details', async (t) => {
  const fetch = setup(t, async () => new Response('Private provider error', { status: 503 }));

  const response = await GET(request());

  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    status: 'not_ready', checks: { configuration: true, database: false },
  });
  assert.equal(response.headers.get('x-request-id'), 'health-test-request');
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('health reports network failures without retrying', async (t) => {
  const fetch = setup(t, async () => { throw new TypeError('fetch failed'); });

  const response = await GET(request());

  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).checks.database, false);
});

test('health aborts a stalled database request and reports unavailable', async (t) => {
  const fetch = setup(t, async (_input, init) => new Promise<Response>((_resolve, reject) => {
    assert.ok(init?.signal);
    init.signal.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
  }));

  const response = await GET(request());

  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).checks.database, false);
});
