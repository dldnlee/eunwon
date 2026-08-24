import test from 'node:test';
import assert from 'node:assert/strict';
import { assessDuplicateBenefit } from './duplicate-benefit';

const program = { title: '서울 AI 사업', agency: '서울산업진흥원', category: '기술', funding_type: '보조금' };
const cited = [{ clause: '동일 또는 유사 사업으로 지원받은 기업은 중복 지원 불가', verification: 'verified' as const, sourceUrl: 'https://example.com' }];

test('cited duplicate rule plus overlapping prior benefit is a possible conflict', () => {
  const result = assessDuplicateBenefit({ program, restrictions: cited, priorBenefits: [
    { title: '다른 AI 사업', agency: '서울산업진흥원', category: '기술', fundingType: '보조금', status: 'selected' },
  ] });
  assert.equal(result?.level, 'possible_conflict');
  assert.equal(result?.clause, cited[0].clause);
});

test('cited broad rule with unrelated prior application remains ambiguous', () => {
  const result = assessDuplicateBenefit({ program, restrictions: cited, priorBenefits: [
    { title: '부산 수출 교육', agency: '부산기관', category: '교육', fundingType: '교육', status: 'submitted' },
  ] });
  assert.equal(result?.level, 'needs_confirmation');
});

test('category overlap alone never warns without an explicit verified duplicate clause', () => {
  const prior = [{ title: '기술 사업', agency: '다른 기관', category: '기술', fundingType: null, status: 'selected' }];
  assert.equal(assessDuplicateBenefit({ program, restrictions: [], priorBenefits: prior }), null);
  assert.equal(assessDuplicateBenefit({ program, restrictions: [
    { clause: '휴업 기업 제외', verification: 'verified', sourceUrl: null },
  ], priorBenefits: prior }), null);
  assert.equal(assessDuplicateBenefit({ program, restrictions: [
    { clause: '중복 지원 불가', verification: 'inferred', sourceUrl: null },
  ], priorBenefits: prior }), null);
});
