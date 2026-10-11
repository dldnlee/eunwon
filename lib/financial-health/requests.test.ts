import assert from 'node:assert/strict';
import test from 'node:test';
import { handleAnalyzeRequest, handleExtractRequest } from './requests';
import { samplePlan, sampleStatement } from './fixtures';

const headers = { 'Content-Type': 'application/json' };
const validBody = { statement: sampleStatement, confirmed: true, consent: true };
function request(body: unknown = validBody) {
  return new Request('https://example.com/api/financial-health/analyze', { method: 'POST', headers, body: JSON.stringify(body) });
}
const authorized = { authorize: async () => 'test-user', acquire: () => () => {} };

test('both financial endpoints reject unauthenticated requests before any provider calls', async () => {
  for (const handler of [handleAnalyzeRequest, handleExtractRequest]) {
    const response = await handler(request(), { authorize: async () => null, analyze: async () => { throw new Error('must not run'); } });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }
});

test('cross-origin requests cannot use the signed-in financial API', async () => {
  const req = request();
  req.headers.set('origin', 'https://untrusted.example');
  assert.equal((await handleAnalyzeRequest(req, { authorize: async () => { throw new Error('must not run'); } })).status, 403);
});

test('consent, confirmation and balanced inputs are required before provider calls', async () => {
  let calls = 0;
  for (const body of [
    { ...validBody, confirmed: false }, { ...validBody, consent: false },
    { ...validBody, statement: { ...sampleStatement, equity: 999 } },
    { ...validBody, statement: { ...sampleStatement, unit: null } },
  ]) {
    const response = await handleAnalyzeRequest(request(body), { ...authorized, analyze: async () => { calls++; return samplePlan; } });
    assert.equal(response.status, 400);
  }
  assert.equal(calls, 0);
});

test('analysis supplies server-computed metrics, warnings, source references and original figures', async () => {
  const response = await handleAnalyzeRequest(request({ ...validBody, metrics: [{ value: 999 }] }), {
    ...authorized, analyze: async (statement, metrics, warnings) => {
      assert.deepEqual(statement, sampleStatement);
      assert.equal(metrics.find(({ id }) => id === 'debtRatio')?.value, 233.33);
      assert.ok(warnings.some((warning) => warning.includes('현금흐름')));
      return samplePlan;
    },
  });
  assert.equal(response.status, 200);
  const report = await response.json();
  assert.deepEqual(report.statement, sampleStatement);
  assert.deepEqual(report.plan, samplePlan);
  assert.match(report.disclaimer, /공식 신용등급 평가가 아닙니다/);
  assert.equal(report.sources.length, 2);
});

test('provider failures are retryable and do not leak financial or provider details', async () => {
  let released = false;
  const response = await handleAnalyzeRequest(request(), {
    ...authorized, acquire: () => () => { released = true; },
    analyze: async () => { throw new Error('SECRET COMPANY DATA'); },
  });
  assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /SECRET/);
  assert.equal(released, true);
});

test('malformed, absent, oversized and wrongly typed bodies return input errors', async () => {
  for (const [body, type, expected] of [
    ['{', 'application/json', 400], ['null', 'application/json', 400],
    ['{}', 'text/plain', 415], ['x'.repeat(170_000), 'application/json', 413],
  ] as const) {
    const response = await handleAnalyzeRequest(new Request('https://example.com', { method: 'POST', headers: { 'Content-Type': type }, body }), authorized);
    assert.equal(response.status, expected);
  }
});

test('extraction handles pasted text and uploaded files but always requires consent', async () => {
  const text = '가상회사 2025년 단위 백만원 자산총계 1000 부채총계 700 자본총계 300';
  let calls = 0;
  const deps = { ...authorized, extract: async (input: string) => {
    assert.equal(input, text); calls++; return { statement: sampleStatement, warnings: [] };
  }, readDocument: async (file: File) => { assert.equal(file.name, 'test.pdf'); return text; } };
  assert.equal((await handleExtractRequest(request({ text, consent: true }), deps)).status, 200);
  assert.equal((await handleExtractRequest(request({ text, consent: false }), deps)).status, 400);
  const form = new FormData();
  form.set('file', new Blob(['%PDF-test'], { type: 'application/pdf' }), 'test.pdf');
  form.set('consent', 'true');
  assert.equal((await handleExtractRequest(new Request('https://example.com', { method: 'POST', body: form }), deps)).status, 200);
  assert.equal(calls, 2);
});

test('local request budget rejects the thirteenth call and concurrent requests', async () => {
  const deps = { authorize: async () => 'budget-test-user', analyze: async () => samplePlan };
  for (let i = 0; i < 12; i++) assert.equal((await handleAnalyzeRequest(request(), deps)).status, 200);
  assert.equal((await handleAnalyzeRequest(request(), deps)).status, 429);

  let finish!: () => void;
  let started!: () => void;
  const waiting = new Promise<void>((resolve) => { finish = resolve; });
  const ready = new Promise<void>((resolve) => { started = resolve; });
  const concurrent = { authorize: async () => 'concurrency-test-user', analyze: async () => { started(); await waiting; return samplePlan; } };
  const first = handleAnalyzeRequest(request(), concurrent);
  await ready;
  assert.equal((await handleAnalyzeRequest(request(), concurrent)).status, 429);
  finish();
  assert.equal((await first).status, 200);
});
