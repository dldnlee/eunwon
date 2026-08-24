import test from 'node:test';
import assert from 'node:assert/strict';
import type { Program } from './types';
import { buildProgramComparisonItem, parseComparisonIds } from './program-comparison';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';

test('comparison IDs are unique, valid, and bounded to two through four', () => {
  assert.deepEqual(parseComparisonIds(`${A},${B},${A}`), [A, B]);
  assert.deepEqual(parseComparisonIds(A), []);
  assert.deepEqual(parseComparisonIds(`${A},not-an-id`), []);
  assert.deepEqual(parseComparisonIds(`${A},${B},${C},44444444-4444-4444-8444-444444444444,55555555-5555-4555-8555-555555555555`), []);
});

test('projection keeps unknown values explicit and mismatch authoritative', () => {
  const item = buildProgramComparisonItem({
    program: { id: A, title: '사업', agency: '기관', category: null, apply_url: null,
      funding_type: null, funding_amount_krw: null, deadline_end: null } as Program,
    gaps: { status: 'available', items: [], counts: { met: 2, notMet: 1, unknown: 3 } },
    confidence: null,
    checklist: null,
    saved: null,
  });
  assert.equal(item.eligibility.status, 'mismatch');
  assert.equal(item.qualityScore, null);
  assert.equal(item.preparation, null);
  assert.equal(item.application, null);
});
