import test from 'node:test';
import assert from 'node:assert/strict';
import type { Program } from './types';
import { rankSimilarPrograms } from './similar-programs';

function program(id: string, overrides: Partial<Program> = {}): Program {
  return { id, title: 'AI 기술 지원 사업', agency: '기관', category: '기술', funding_type: '보조금',
    region: ['서울'], is_nationwide: false, entity_types: ['법인'], ai_tags: ['AI'],
    deadline_end: '2026-12-31', is_active: true, ...overrides } as Program;
}

test('ranking excludes the current, closed, and inactive programs', () => {
  const current = program('current');
  const ranked = rankSimilarPrograms(current, [
    current,
    program('closed', { deadline_end: '2026-01-01' }),
    program('inactive', { is_active: false }),
    program('eligible'),
  ], { today: '2026-08-25' });
  assert.deepEqual(ranked.map((item) => item.program.id), ['eligible']);
});

test('structured overlap ranks stronger candidates and explains differences', () => {
  const current = program('current');
  const strong = program('strong');
  const weak = program('weak', { agency: '다른 기관', category: '수출', funding_type: '융자',
    region: ['부산'], entity_types: ['예비창업자'], ai_tags: [], title: '해외 판로 지원 공고' });
  const ranked = rankSimilarPrograms(current, [weak, strong], { today: '2026-08-25' });
  assert.equal(ranked[0].program.id, 'strong');
  assert.ok(ranked[0].reasons.length > 0);
  assert.ok(ranked.find((item) => item.program.id === 'weak')?.differences.some((text) => text.startsWith('분야:')));
});
