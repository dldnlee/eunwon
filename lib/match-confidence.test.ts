import test from 'node:test';
import assert from 'node:assert/strict';
import type { EligibilityGapAnalysis, EligibilityGapItem } from './eligibility/gap-analysis';
import { calculateMatchConfidence } from './match-confidence';

function item(id: string, status: EligibilityGapItem['status'], verification: EligibilityGapItem['verification']): EligibilityGapItem {
  return { id, status, verification, requirement: id, reason: '', profileField: null,
    profileIssue: null, confidence: 0.9, evidenceQuote: id, sourceTitle: null, sourceUrl: null };
}

function analysis(items: EligibilityGapItem[]): EligibilityGapAnalysis {
  return { status: items.length ? 'available' : 'unavailable', items, counts: {
    met: items.filter((entry) => entry.status === 'met').length,
    notMet: items.filter((entry) => entry.status === 'not_met').length,
    unknown: items.filter((entry) => entry.status === 'unknown').length,
  } };
}

const base = {
  profileUpdatedAt: '2026-08-20T00:00:00Z', programUpdatedAt: '2026-08-20T00:00:00Z',
  extractionRunId: 'run-1', extractionFingerprint: 'abc', extractionCompletedAt: '2026-08-20T00:00:00Z',
  now: new Date('2026-08-25T00:00:00Z'),
};

test('score components are deterministic and describe coverage, not eligibility probability', () => {
  const first = calculateMatchConfidence({ ...base, analysis: analysis([
    item('a', 'met', 'verified'), item('b', 'unknown', 'inferred'),
  ]) });
  const second = calculateMatchConfidence({ ...base, analysis: analysis([
    item('a', 'met', 'verified'), item('b', 'unknown', 'inferred'),
  ]) });
  assert.deepEqual(first, second);
  assert.equal(first.evidenceCoverage, 0.5);
  assert.equal(first.profileCoverage, 0.5);
  assert.equal(first.uncertaintyRatio, 0.5);
  assert.equal(first.resultState, 'unknown');
  assert.equal(first.confidenceScore, 60);
});

test('one deterministic mismatch controls state regardless of the score', () => {
  const result = calculateMatchConfidence({ ...base, analysis: analysis([
    item('a', 'met', 'verified'), item('b', 'not_met', 'verified'),
  ]) });
  assert.equal(result.resultState, 'mismatch');
  assert.equal(result.components.notMet, 1);
});

test('stale evidence loses freshness points and never becomes aligned when evidence is absent', () => {
  const stale = calculateMatchConfidence({ ...base, analysis: analysis([item('a', 'met', 'verified')]),
    extractionCompletedAt: '2026-01-01T00:00:00Z' });
  const absent = calculateMatchConfidence({ ...base, analysis: analysis([]), extractionCompletedAt: null });
  assert.equal(stale.components.freshnessScore, 0);
  assert.equal(absent.resultState, 'unknown');
  assert.equal(absent.confidenceScore, 0);
});

test('evidence older than the program update is stale even when recently extracted', () => {
  const result = calculateMatchConfidence({ ...base, analysis: analysis([item('a', 'met', 'verified')]),
    extractionCompletedAt: '2026-08-24T00:00:00Z', programUpdatedAt: '2026-08-25T00:00:00Z' });
  assert.equal(result.components.freshnessScore, 0);
});
