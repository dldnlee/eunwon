import assert from 'node:assert/strict';
import test from 'node:test';
import fixture from './fixtures/bizinfo-event.documented.json';
import { crawlEventPages, normalizeBizinfoEvent, parseEventDateRange } from './importer';

test('normalizes the documented local event fixture deterministically', () => {
  const first = normalizeBizinfoEvent(fixture);
  const second = normalizeBizinfoEvent(fixture);
  assert.equal(first.external_id, 'LOCAL-EVENT-001');
  assert.deepEqual(first.region, ['서울']);
  assert.equal(first.event_start, '2026-09-10');
  assert.equal(first.apply_end, '2026-09-05');
  assert.equal(first.is_online, true);
  assert.equal(first.content_sha256, second.content_sha256);
  assert.match(first.content_sha256, /^[0-9a-f]{64}$/);
});

test('date ranges tolerate compact and hyphenated source dates', () => {
  assert.deepEqual(parseEventDateRange('20260901~20260903'), { start: '2026-09-01', end: '2026-09-03' });
  assert.deepEqual(parseEventDateRange('2026-09-01 ~ 2026-09-03'), { start: '2026-09-01', end: '2026-09-03' });
});

test('crawl refuses a truncated response so callers cannot deactivate unseen rows', async () => {
  await assert.rejects(
    crawlEventPages(async (page) => page === 1
      ? { items: ['one'], totalCount: 3 }
      : { items: [], totalCount: 3 }, 1, 5),
    /ended before reported totalCount/
  );
});

test('crawl enforces its page safety cap', async () => {
  await assert.rejects(
    crawlEventPages(async () => ({ items: ['one'], totalCount: 99 }), 1, 2),
    /exceeded safety cap/
  );
});

test('crawl rejects a nonempty but incomplete final page', async () => {
  await assert.rejects(
    crawlEventPages(async () => ({ items: ['one'], totalCount: 2 }), 100),
    /reported totalCount/
  );
});

test('crawl rejects missing rows on an earlier nonempty page', async () => {
  await assert.rejects(
    crawlEventPages(async (page) => ({ items: [`page-${page}`], totalCount: 3 }), 2),
    /reported totalCount/
  );
});

test('crawl rejects a changing total even when collected rows match the last count', async () => {
  await assert.rejects(
    crawlEventPages(async (page) => ({ items: [`page-${page}`], totalCount: page === 1 ? 3 : 2 }), 1),
    /totalCount changed/
  );
});

test('crawl rejects more rows than reported', async () => {
  await assert.rejects(
    crawlEventPages(async () => ({ items: ['one', 'two'], totalCount: 1 }), 100),
    /reported totalCount/
  );
});

test('crawl rejects invalid row counts', async () => {
  for (const totalCount of [-1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(
      crawlEventPages(async () => ({ items: ['one', 'two'], totalCount }), 100),
      /invalid totalCount/
    );
  }
});

test('crawl returns all rows for complete pages and a partial final page', async () => {
  const pages: number[] = [];
  const rows = await crawlEventPages(async (page) => {
    pages.push(page);
    return { items: page === 1 ? ['one', 'two'] : ['three'], totalCount: 3 };
  }, 2);
  assert.deepEqual(rows, ['one', 'two', 'three']);
  assert.deepEqual(pages, [1, 2]);
});

test('crawl accepts an empty source and stops after the first page', async () => {
  const pages: number[] = [];
  assert.deepEqual(await crawlEventPages(async (page) => {
    pages.push(page);
    return { items: [], totalCount: 0 };
  }), []);
  assert.deepEqual(pages, [1]);
});
