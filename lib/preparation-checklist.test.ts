import assert from 'node:assert/strict';
import test from 'node:test';
import { buildChecklistSeeds } from './preparation-checklist';

test('builds a cited verified preparation item', () => {
  const [item] = buildChecklistSeeds([{
    id: 'requirement-1',
    requirement_type: 'region',
    normalized_text: '서울 소재 기업',
    verification: 'verified',
    confidence: '0.95',
    evidence_quote: '사업장 소재지가 서울특별시인 기업',
    program_source_documents: {
      title: '2026년 지원사업 공고',
      source_url: 'https://example.go.kr/notice/1',
    },
  }]);

  assert.equal(item.label, '자격 증빙 준비 · 서울 소재 기업');
  assert.equal(item.verification, 'verified');
  assert.equal(item.confidence, 0.95);
  assert.equal(item.evidence_quote, '사업장 소재지가 서울특별시인 기업');
  assert.equal(item.source_url, 'https://example.go.kr/notice/1');
});

test('keeps inferred requirements uncertain and rejects unsafe source URLs', () => {
  const [item] = buildChecklistSeeds([{
    id: 'requirement-2',
    requirement_type: 'exclusion',
    normalized_text: '휴업 중인 기업 제외',
    verification: 'inferred',
    confidence: 4,
    evidence_quote: null,
    program_source_documents: [{
      title: null,
      source_url: 'javascript:alert(1)',
    }],
  }]);

  assert.equal(item.label, '제외 조건 확인 · 휴업 중인 기업 제외');
  assert.equal(item.verification, 'inferred');
  assert.equal(item.confidence, 1);
  assert.equal(item.source_url, null);
});
