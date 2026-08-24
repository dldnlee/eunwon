import test from 'node:test';
import assert from 'node:assert/strict';
import type { Profile, Program } from '@/lib/types';
import type { EligibilityGapAnalysis } from '@/lib/eligibility/gap-analysis';
import { explainMatch } from './explainMatch';

const program = { title: '지원사업', ai_summary: '요약' } as Program;
const profile = { industry_name: 'IT', region: '서울', age_months: 12, employee_count: 3,
  business_description: null, business_traits: [], rnd_capability: [], investment_stage: null,
  business_tax_type: null } as unknown as Profile;

function gaps(status: 'met' | 'not_met' | 'unknown'): EligibilityGapAnalysis {
  return { status: 'available', counts: {
    met: status === 'met' ? 1 : 0, notMet: status === 'not_met' ? 1 : 0,
    unknown: status === 'unknown' ? 1 : 0,
  }, items: [{ id: 'r', requirement: '서울 소재', status, reason: '', profileField: 'region',
    profileIssue: status === 'not_met' ? 'mismatch' : null, verification: 'verified', confidence: 1,
    evidenceQuote: '서울 소재', sourceTitle: null, sourceUrl: null }] };
}

test('hard mismatch returns deterministic caution without calling AI', async () => {
  let called = false;
  const result = await explainMatch(program, profile, gaps('not_met'), async () => {
    called = true; return '잘 맞아요';
  });
  assert.equal(called, false);
  assert.match(result, /맞지 않을 수 있어요/);
  assert.doesNotMatch(result, /잘 맞아요/);
});

test('AI prompt includes met and unknown evidence with non-certainty instructions', async () => {
  let prompt = '';
  await explainMatch(program, profile, gaps('unknown'), async (params) => {
    prompt = params.prompt; return '확인이 필요해요';
  });
  assert.match(prompt, /확인 필요 조건: 서울 소재/);
  assert.match(prompt, /자격이나 선정\n가능성을 확정하지 마세요/);
});
