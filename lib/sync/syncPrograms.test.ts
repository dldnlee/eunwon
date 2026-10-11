import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { syncPrograms } from './syncPrograms';

function setupSync(t: TestContext, options: {
  failProgram?: string;
  failEvidence?: boolean;
  deadlines?: string[];
} = {}) {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://program-test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
    BIZINFO_API_KEY: 'test-bizinfo-key',
    UPSTAGE_API_KEY: 'test-upstage-key',
  };
  for (const [key, value] of Object.entries(env)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
  t.mock.method(console, 'error', () => {});
  t.mock.method(console, 'warn', () => {});

  const requests: { path: string; method: string; body: Record<string, unknown> | null }[] = [];
  const unexpected: string[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const bodyText = await request.text();
    const body = bodyText ? JSON.parse(bodyText) : null;
    const { method } = request;
    requests.push({ path: url.pathname, method, body });
    if (url.hostname === 'apis.data.go.kr') {
      const deadlines = options.deadlines ?? ['', ''];
      return Response.json({ response: { body: { totalCount: deadlines.length, items: { item: deadlines.map((deadline, index) => ({
        pblancId: ['first', 'second'][index] ?? `program-${index}`, pblancNm: '지원사업', pblancUrl: 'https://example.com/program',
        jrsdInsttNm: '지원기관', bsnsSumryCn: '사업 지원', reqstBeginEndDe: deadline,
        trgetNm: '중소기업', hashtags: '서울', reqstMthPapersCn: '',
      })) } } } });
    }
    if (url.hostname === 'api.upstage.ai') {
      return Response.json({ choices: [{ message: { content: '{}' } }] });
    }
    if (url.pathname === '/rest/v1/programs' && method === 'POST') {
      if (body.external_id === options.failProgram) {
        return Response.json({ code: '23514', message: 'program constraint failed' }, { status: 400 });
      }
      return Response.json({ id: body.external_id });
    }
    if (url.pathname === '/rest/v1/program_source_documents' && method === 'POST') {
      if (options.failEvidence) {
        return Response.json({ code: '23514', message: 'source constraint failed' }, { status: 400 });
      }
      return Response.json([{ id: 'source', source_key: 'summary' }]);
    }
    if (url.pathname === '/rest/v1/program_extraction_runs' && method === 'GET') {
      return Response.json({ id: 'cached-extraction' });
    }
    if (url.pathname === '/rest/v1/programs' && method === 'PATCH') {
      assert.equal(url.searchParams.get('source'), 'eq.bizinfo');
      assert.match(url.searchParams.get('updated_at') ?? '', /^lt\./);
      return new Response(null, { status: 204 });
    }
    unexpected.push(`${method} ${url.pathname}`);
    return Response.json({ message: 'unexpected request' }, { status: 400 });
  });
  t.after(() => assert.deepEqual(unexpected, []));
  return requests;
}

for (const failProgram of ['first', 'second']) {
  test(`a failed ${failProgram} program write aborts sync before stale deactivation`, async (t) => {
    const requests = setupSync(t, { failProgram });
    const logs: string[] = [];

    await assert.rejects(syncPrograms((message) => logs.push(message)), /program constraint failed/);

    const writes = requests.filter(({ path, method }) => path === '/rest/v1/programs' && method === 'POST');
    assert.deepEqual(writes.map(({ body }) => body?.external_id), failProgram === 'first' ? ['first'] : ['first', 'second']);
    assert.equal(requests.some(({ method }) => method === 'PATCH'), false);
    assert.equal(logs.some((message) => message.includes('Done.')), false);
    const evidenceWrites = requests.filter(({ path }) => path === '/rest/v1/program_source_documents');
    assert.equal(evidenceWrites.length, failProgram === 'first' ? 0 : 1);
  });
}

test('successful program writes allow stale deactivation and accurate counts', async (t) => {
  const requests = setupSync(t);
  assert.deepEqual(await syncPrograms(() => {}), { synced: 2, skipped: 0 });
  const deactivations = requests.filter(({ method }) => method === 'PATCH');
  assert.equal(deactivations.length, 1);
  assert.deepEqual(deactivations[0].body, { is_active: false });
  assert.equal(requests.at(-1), deactivations[0]);
});

test('additive eligibility evidence failures still allow persisted programs to complete', async (t) => {
  const requests = setupSync(t, { failEvidence: true });
  assert.deepEqual(await syncPrograms(() => {}), { synced: 2, skipped: 0 });
  assert.equal(requests.filter(({ method }) => method === 'PATCH').length, 1);
});

for (const now of ['2026-10-10T15:00:00Z', '2026-10-11T00:00:01Z', '2026-10-11T14:59:59Z']) {
  test(`programs remain active throughout their Korean deadline day at ${now}`, async (t) => {
    t.mock.timers.enable({ apis: ['Date'], now: Date.parse(now) });
    const requests = setupSync(t, { deadlines: ['2026-10-01 ~ 2026-10-11'] });

    assert.deepEqual(await syncPrograms(() => {}), { synced: 1, skipped: 0 });
    const writes = requests.filter(({ path, method }) => path === '/rest/v1/programs' && method === 'POST');
    assert.equal(writes.length, 1);
    assert.equal(writes[0].body?.deadline_end, '2026-10-11');
    assert.equal(writes[0].body?.is_active, true);
  });
}

test('Korean midnight skips yesterday while preserving today, future, and open-ended programs', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-11T15:00:00Z') });
  const requests = setupSync(t, { deadlines: [
    '2026-10-01 ~ 2026-10-11',
    '2026-10-01 ~ 2026-10-12',
    '2026-10-01 ~ 2026-10-13',
    '예산 소진시까지',
  ] });

  assert.deepEqual(await syncPrograms(() => {}), { synced: 3, skipped: 1 });
  const writes = requests.filter(({ path, method }) => path === '/rest/v1/programs' && method === 'POST');
  assert.deepEqual(writes.map(({ body }) => body?.deadline_end), ['2026-10-12', '2026-10-13', null]);
  assert.equal(requests.filter(({ method }) => method === 'PATCH').length, 1);
});
