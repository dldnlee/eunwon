import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApplicationSummarySnapshot } from './application-summary';
import type { Program } from './types';

const program = { id: 'p1', title: '수출 지원', agency: '중소벤처기업부', deadline_end: '2026-09-01',
  apply_url: 'https://example.com/apply', detail_url: 'javascript:alert(1)' } as Program;

test('summary snapshot is deterministic and strips non-http URLs from exported evidence', () => {
    const input = {
      generatedAt: '2026-08-25T00:00:00.000Z', program,
      saved: { status: 'preparing' as const, notes: '초안 준비', outcome: null, submittedAt: null, nextAction: '서류 확인', nextActionDueAt: null },
      checklist: [{ label: '사업자등록증', completed: false, verification: 'verified' as const, confidence: 0.9,
        evidenceQuote: '사업자등록증 제출', sourceTitle: '공고문', sourceUrl: 'file:///private/document.pdf' }],
      eligibility: { status: 'available' as const, counts: { met: 0, notMet: 0, unknown: 1 }, items: [{
        id: 'r1', requirement: '서울 소재 기업', status: 'unknown' as const, reason: '확인 필요', profileField: 'region', profileIssue: null,
        verification: 'verified' as const, confidence: 0.9, evidenceQuote: '서울 소재 기업', sourceTitle: '공고문', sourceUrl: 'https://example.com/source',
      }] },
    };
    const first = buildApplicationSummarySnapshot(input);
    assert.deepEqual(first, buildApplicationSummarySnapshot(input));
    assert.equal(first.program.detail_url, null);
    assert.equal(first.checklist[0].sourceUrl, null);
    assert.equal(first.eligibility.items[0].sourceUrl, 'https://example.com/source');
});
