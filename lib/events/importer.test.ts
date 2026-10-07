import assert from 'node:assert/strict';
import test from 'node:test';
import fixture from './fixtures/bizinfo-event.documented.json';
import { crawlEventPages, normalizeBizinfoEvent, parseEventDate, parseEventDateRange } from './importer';

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

test('event dates reject impossible calendar days instead of accepting JavaScript rollover', () => {
  for (const value of ['2026-02-29', '2025-02-30', '2026-04-31', '2026-06-31', '1900-02-29']) {
    assert.equal(parseEventDate(value), null, value);
    assert.equal(parseEventDate(value.replaceAll('-', '')), null, `compact ${value}`);
  }
});

test('event dates reject year zero and malformed dates', () => {
  for (const value of [undefined, '', ' ', '0000-01-01', '00000101', '2026-00-01', '2026-13-01',
    '2026-01-00', '2026-01-32', '2026-1-1', '2026-01-01T00:00:00Z', '미정']) {
    assert.equal(parseEventDate(value), null, String(value));
  }
});

test('event dates preserve valid leap days and boundary dates in both source formats', () => {
  for (const value of ['2024-02-29', '2000-02-29', '2026-04-30', '2026-12-31', '0001-01-01', '9999-12-31']) {
    assert.equal(parseEventDate(value), value);
    assert.equal(parseEventDate(value.replaceAll('-', '')), value);
    assert.equal(parseEventDate(` ${value} `), value);
  }
});

test('event date ranges retain valid endpoints when the other endpoint is invalid', () => {
  assert.deepEqual(parseEventDateRange('20260228~20260229'), { start: '2026-02-28', end: null });
  assert.deepEqual(parseEventDateRange('2026-04-31 ∼ 2026-05-01'), { start: null, end: '2026-05-01' });
  assert.deepEqual(parseEventDateRange('2026-02-29'), { start: null, end: null });
});

test('normalization keeps impossible source dates out of persisted event fields', () => {
  const normalized = normalizeBizinfoEvent({
    ...fixture,
    eventBeginEndDe: '20260229~20260431',
    rceptPd: '20260631~20260931',
    updtPnttm: '0000-01-01',
  });
  for (const field of ['event_start', 'event_end', 'apply_start', 'apply_end', 'source_updated_at'] as const) {
    assert.equal(normalized[field], null, field);
  }
  assert.equal(normalized.external_id, fixture.eventInfoId);
  assert.equal(normalized.title, fixture.nttNm);
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
