import test from 'node:test';
import assert from 'node:assert/strict';
import {
  audienceRelevance,
  benefitClarity,
  contentNovelty,
  deadlineUrgency,
  scoreCandidate,
  sourceCompleteness,
} from './candidate-selection';
import type { Program } from '@/lib/types';

const NOW = new Date('2026-08-25T00:00:00Z');

function program(overrides: Partial<Program> = {}): Program {
  return {
    id: 'p1',
    external_id: 'ext-1',
    source: 'bizinfo',
    title: '초기 스타트업 지원',
    agency: '서울시',
    exec_agency: null,
    category: '창업',
    target_raw: '초기 스타트업',
    description: null,
    apply_method: '온라인 신청',
    apply_steps: [],
    apply_url: 'https://apply.example.com',
    detail_url: 'https://detail.example.com',
    deadline_start: '2026-08-01',
    deadline_end: '2026-09-05',
    region: ['서울'],
    entity_types: ['법인'],
    is_nationwide: false,
    hashtags_raw: null,
    max_age_months: 36,
    min_age_months: null,
    min_employees: null,
    max_employees: null,
    min_annual_revenue_krw: null,
    max_annual_revenue_krw: null,
    funding_amount_krw: 50_000_000,
    funding_type: '융자',
    required_business_traits: [],
    required_tech_domains: [],
    required_certifications: [],
    required_extra_tags: [],
    required_rnd_capability: [],
    required_investment_stage: null,
    ai_summary: '요약',
    ai_tags: [],
    is_active: true,
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    ...overrides,
  } as Program;
}

test('deadline urgency peaks in the 3–14 day window', () => {
  const soon = new Date(NOW);
  soon.setDate(soon.getDate() + 7);
  assert.equal(deadlineUrgency(soon.toISOString().slice(0, 10), NOW), 1);

  const today = NOW.toISOString().slice(0, 10);
  assert.equal(deadlineUrgency(today, NOW), 0.6);
  assert.equal(deadlineUrgency(null, NOW), 0.1);
  assert.equal(deadlineUrgency('2020-01-01', NOW), 0);
});

test('benefit clarity rewards concrete amounts and summaries', () => {
  assert.ok(benefitClarity({ funding_amount_krw: 10_000_000, funding_type: '보조금', ai_summary: 's' }) > 0.9);
  assert.equal(benefitClarity({ funding_amount_krw: null, funding_type: null, ai_summary: null }), 0);
});

test('source completeness averages its six checks', () => {
  assert.equal(sourceCompleteness(program()), 1);
  assert.equal(sourceCompleteness(program({ region: [], target_raw: null })), 4 / 6);
});

test('audience relevance and novelty are bounded', () => {
  assert.ok(audienceRelevance(program()) <= 1);
  assert.equal(contentNovelty(null), 1);
  assert.equal(contentNovelty(new Date(NOW.getTime() - 60 * 86_400_000).toISOString(), NOW), 1);
  assert.equal(contentNovelty(NOW.toISOString(), NOW), 0);
});

test('total score respects the documented weights', () => {
  const score = scoreCandidate(program(), null, NOW);
  const expected =
    score.audienceRelevance * 0.3 +
    score.deadlineUrgency * 0.25 +
    score.benefitClarity * 0.2 +
    score.sourceCompleteness * 0.15 +
    score.contentNovelty * 0.1;
  assert.ok(Math.abs(score.total - expected) < 1e-9);
});
