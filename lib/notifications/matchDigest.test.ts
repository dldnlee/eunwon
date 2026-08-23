import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMatchDigestEmail, getDigestConfig, selectDigestItems } from './matchDigest';
import type { Profile, Program } from '@/lib/types';

const profile = { region: '서울', entity_type: '법인', age_months: 24, extra_tags: [], certifications: [], interest_categories: [], business_traits: [], rnd_capability: [], tech_domains: [], investment_stage: null } as unknown as Profile;
function program(id: string, deadline = '2026-09-30'): Program {
  return { id, title: `사업 ${id}`, agency: '기관 & 공단', deadline_end: deadline, is_nationwide: true,
    required_extra_tags: [], required_certifications: [], required_business_traits: [], required_rnd_capability: [],
    required_tech_domains: [], required_investment_stage: null, category: null, max_age_months: null } as unknown as Program;
}

test('digest reserves AI-fit slots and fills remaining slots with normal matches', () => {
  const programs = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => program(id));
  const selected = selectDigestItems(programs, profile, {
    a: { matchRate: 99, reason: '최상' }, b: { matchRate: 95, reason: '높음' },
    c: { matchRate: 90, reason: '높음' }, d: { matchRate: 85, reason: '높음' },
  }, { maxItems: 5, maxAiItems: 3, minAiScore: 80 });
  assert.equal(selected.length, 5);
  assert.deepEqual(selected.slice(0, 3).map((item) => item.signal), ['ai', 'ai', 'ai']);
  assert.deepEqual(selected.slice(3).map((item) => item.signal), ['profile', 'profile']);
});

test('digest config is bounded and uses sensible defaults', () => {
  assert.deepEqual(getDigestConfig({ MATCH_DIGEST_MAX_ITEMS: '99' } as unknown as NodeJS.ProcessEnv), {
    maxItems: 5, maxAiItems: 3, minAiScore: 80,
  });
});

test('email is capped, escaped, and includes direct program and dashboard links', () => {
  const unsafe = program('abc'); unsafe.title = '<지원 & 사업>';
  const email = buildMatchDigestEmail({
    items: [{ program: unsafe, signal: 'profile', score: 72, reason: '기본 조건 일치' }],
    totalFresh: 28,
    appUrl: 'https://eunwon.com',
  });
  assert.match(email.subject, /1건/);
  assert.match(email.html, /나머지 27건/);
  assert.match(email.html, /https:\/\/eunwon\.com\/program\/abc\?source=email/);
  assert.match(email.html, /https:\/\/eunwon\.com\/dashboard\?source=email/);
  assert.doesNotMatch(email.html, /<지원 & 사업>/);
  assert.match(email.html, /&lt;지원 &amp; 사업&gt;/);
  assert.match(email.text, /https:\/\/eunwon\.com\/program\/abc/);
});
