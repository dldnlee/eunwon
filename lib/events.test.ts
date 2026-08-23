import assert from 'node:assert/strict';
import test from 'node:test';
import { rankEventForProfile } from './events';
import type { Event, Profile } from './types';

const profile = {
  region: '서울', interest_categories: ['기술'], industry_name: '소프트웨어 개발',
  tech_domains: ['AI/소프트웨어'], current_challenges: 'AI 도입',
} as Profile;
const base = {
  title: 'AI 소프트웨어 도입 세미나', description: '중소기업 AI 도입 사례', category: '기술',
  region: ['서울'], is_nationwide: false, is_online: false, apply_end: '2099-01-01', event_start: '2099-01-10',
} as Event;

test('event relevance rewards profile region, category, and subject overlap', () => {
  const strong = rankEventForProfile(base, profile);
  const weak = rankEventForProfile({ ...base, title: '수산물 박람회', description: '', category: '수산', region: ['부산'] }, profile);
  assert.ok(strong.relevanceScore > weak.relevanceScore);
  assert.ok(strong.relevanceReasons.some((reason) => reason.includes('서울')));
  assert.ok(strong.relevanceReasons.some((reason) => reason.includes('기술')));
});

test('online nationwide events remain discoverable without local-region points', () => {
  const ranked = rankEventForProfile({ ...base, region: ['전국'], is_nationwide: true, is_online: true }, profile);
  assert.ok(ranked.relevanceScore >= 20);
  assert.ok(ranked.relevanceReasons.some((reason) => reason.includes('온라인')));
});
