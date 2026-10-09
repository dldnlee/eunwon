import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import {
  audienceRelevance,
  benefitClarity,
  contentNovelty,
  deadlineUrgency,
  scoreCandidate,
  selectCandidates,
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

type PostHistory = { program_id: string; updated_at: string };
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

function candidateClient(programs: Program[], history: PostHistory[]) {
  return createClient('https://candidates-test.supabase.co', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input) => {
        const url = new URL(String(input));
        if (url.pathname === '/rest/v1/programs') return Response.json(programs);
        assert.equal(url.pathname, '/rest/v1/marketing_posts');
        const filter = url.searchParams.get('updated_at');
        assert.ok(filter && filter.startsWith('gte.'));
        const cutoff = Date.parse(filter.slice(4));
        return Response.json(history.filter((post) => Date.parse(post.updated_at) >= cutoff));
      },
    },
  });
}

for (const recentPostCutoffDays of [undefined, 7]) {
  test(`candidate selection excludes the full 14-day repeat window (lookback ${recentPostCutoffDays ?? 'default'})`, async () => {
    const programs = [8, 13, 14].map((age) => program({ id: `age-${age}` }));
    const history = [8, 13, 14].map((age) => ({ program_id: `age-${age}`, updated_at: daysAgo(age) }));
    const { candidates } = await selectCandidates(candidateClient(programs, history), {
      now: NOW, recentPostCutoffDays,
    });

    assert.deepEqual(candidates.map(({ program }) => program.id), ['age-14']);
  });
}

test('candidate selection retains history throughout the novelty scoring window', async () => {
  const ages = [14, 20, 29, 30];
  const programs = [...ages.map((age) => program({ id: `age-${age}` })), program({ id: 'never-used' })];
  const history = ages.map((age) => ({ program_id: `age-${age}`, updated_at: daysAgo(age) }));
  const { candidates } = await selectCandidates(candidateClient(programs, history), { now: NOW });
  const novelty = new Map(candidates.map(({ program, score }) => [program.id, score.contentNovelty]));

  for (const age of ages) assert.equal(novelty.get(`age-${age}`), age / 30);
  assert.equal(novelty.get('never-used'), 1);
  assert.ok(candidates.findIndex(({ program }) => program.id === 'never-used') <
    candidates.findIndex(({ program }) => program.id === 'age-14'));
});

test('candidate selection uses the latest history row regardless of query order', async () => {
  for (const ages of [[20, 10], [10, 20]]) {
    const history = ages.map((age) => ({ program_id: 'p1', updated_at: daysAgo(age) }));
    const { candidates } = await selectCandidates(candidateClient([program()], history), { now: NOW });
    assert.deepEqual(candidates, []);
  }
});
