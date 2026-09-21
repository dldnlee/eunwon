import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { checkBusinessStatus } from './business';

const unconfirmed = { status: 'not_found', taxType: null, closedAt: null };

function setup(t: TestContext, fetch: typeof globalThis.fetch) {
  const previousKey = process.env.BIZNO_API_KEY;
  process.env.BIZNO_API_KEY = 'test-bizno-key';
  t.after(() => {
    if (previousKey === undefined) delete process.env.BIZNO_API_KEY;
    else process.env.BIZNO_API_KEY = previousKey;
  });
  return t.mock.method(globalThis, 'fetch', fetch);
}

test('business verification normalizes the number and preserves successful status details', async (t) => {
  const fetch = setup(t, async () => Response.json({
    resultCode: 0,
    items: [{ bno: '1234567890', bsttcd: '03', taxtype: '일반과세자', EndDt: '20260920' }],
  }));

  assert.deepEqual(await checkBusinessStatus('123-45-67890'), {
    status: 'closed', taxType: '일반과세자', closedAt: '2026-09-20',
  });
  assert.equal(fetch.mock.callCount(), 1);
  const url = new URL(String(fetch.mock.calls[0].arguments[0]));
  assert.equal(url.searchParams.get('q'), '1234567890');
  assert.equal(url.searchParams.get('status'), 'Y');
});

for (const missing of ['number', 'key']) {
  test(`business verification skips requests with an invalid ${missing}`, async (t) => {
    const fetch = setup(t, async () => { throw new Error('Unexpected request'); });
    if (missing === 'key') delete process.env.BIZNO_API_KEY;

    assert.deepEqual(await checkBusinessStatus(missing === 'number' ? '123' : '1234567890'), unconfirmed);
    assert.equal(fetch.mock.callCount(), 0);
  });
}

test('business verification preserves unconfirmed results for provider errors and empty records', async (t) => {
  const responses = [
    new Response(null, { status: 503 }),
    Response.json({ resultCode: 1, resultMsg: 'quota exceeded' }),
    Response.json({ resultCode: 0, items: [] }),
  ];
  setup(t, async () => responses.shift()!);

  for (let index = 0; index < 3; index++) {
    assert.deepEqual(await checkBusinessStatus('1234567890'), unconfirmed);
  }
});

test('business verification propagates network and JSON failures so callers do not persist not_found', async (t) => {
  const networkError = new TypeError('fetch failed');
  const fetch = setup(t, async () => { throw networkError; });
  await assert.rejects(checkBusinessStatus('1234567890'), (error) => error === networkError);

  fetch.mock.mockImplementation(async () => new Response('invalid JSON'));
  await assert.rejects(checkBusinessStatus('1234567890'), SyntaxError);
});

for (const stalledPhase of ['request', 'body']) {
  test(`business verification aborts a stalled ${stalledPhase} within its timeout budget`, async (t) => {
    const controller = new AbortController();
    const timeoutError = new DOMException('Lookup timed out', 'TimeoutError');
    const timeout = t.mock.method(AbortSignal, 'timeout', () => controller.signal);
    const fetch = setup(t, async (_input, init) => {
      assert.equal(init?.signal, controller.signal);
      const stalled = () => new Promise<never>((_resolve, reject) => {
        init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason), { once: true });
        queueMicrotask(() => controller.abort(timeoutError));
      });
      if (stalledPhase === 'request') return stalled();
      const response = new Response();
      t.mock.method(response, 'json', stalled);
      return response;
    });

    await assert.rejects(checkBusinessStatus('1234567890'), (error) => error === timeoutError);
    assert.equal(timeout.mock.callCount(), 1);
    assert.deepEqual(timeout.mock.calls[0].arguments, [10_000]);
    assert.equal(fetch.mock.callCount(), 1);
  });
}
