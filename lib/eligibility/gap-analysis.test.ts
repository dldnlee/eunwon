import test from 'node:test';
import assert from 'node:assert/strict';
import type { Profile } from '@/lib/types';
import { evaluateEligibilityGaps, type EligibilityGapRequirement } from './gap-analysis';

const profile = {
  entity_type: '법인', region: '서울', age_months: 24, employee_count: null,
  annual_revenue_krw: 300_000_000, certifications: ['벤처기업'], extra_tags: [],
  business_traits: ['B2B'], tech_domains: ['AI'], rnd_capability: [],
  investment_stage: null, industry_name: '정보통신업',
} as unknown as Profile;

function requirement(overrides: Partial<EligibilityGapRequirement>): EligibilityGapRequirement {
  return {
    id: 'r1', requirementType: 'entity_type', operator: 'in', value: ['법인'],
    normalizedText: '법인', verification: 'verified', confidence: 0.95,
    evidenceQuote: '법인', sourceTitle: '지원 대상', sourceUrl: 'https://example.com/program',
    ...overrides,
  };
}

test('evaluates deterministic met, mismatch, missing, and inferred states separately', () => {
  const analysis = evaluateEligibilityGaps([
    requirement({ id: 'entity', value: ['법인'] }),
    requirement({ id: 'region', requirementType: 'region', value: ['부산'] }),
    requirement({ id: 'employees', requirementType: 'employee_count', operator: 'gte', value: { min: 5 } }),
    requirement({ id: 'inferred', verification: 'inferred', requirementType: 'region', value: ['서울'] }),
  ], profile);

  assert.equal(analysis.status, 'available');
  assert.deepEqual(analysis.counts, { met: 1, notMet: 1, unknown: 2 });
  assert.equal(analysis.items[1].profileIssue, 'mismatch');
  assert.equal(analysis.items[2].profileIssue, 'missing');
  assert.equal(analysis.items[3].status, 'unknown');
});

test('converts year-based business age thresholds to profile months', () => {
  const [item] = evaluateEligibilityGaps([
    requirement({ requirementType: 'business_age', operator: 'lte', value: { max: 3, unit: 'year' } }),
  ], profile).items;
  assert.equal(item.status, 'met');
});

test('never treats unsupported exclusions as eligible or ineligible', () => {
  const [item] = evaluateEligibilityGaps([
    requirement({ requirementType: 'exclusion', operator: 'excludes', value: '휴업기업' }),
  ], profile).items;
  assert.equal(item.status, 'unknown');
  assert.equal(item.profileIssue, null);
});

test('does not compare SME class or city-level geography against incompatible profile fields', () => {
  const analysis = evaluateEligibilityGaps([
    requirement({ id: 'sme', requirementType: 'entity_type', value: '중소기업' }),
    requirement({ id: 'city', requirementType: 'region', value: '구미시' }),
  ], profile);
  assert.deepEqual(analysis.counts, { met: 0, notMet: 0, unknown: 2 });
});

test('returns an explicit unavailable state when no reviewed evidence exists', () => {
  assert.deepEqual(evaluateEligibilityGaps([], profile), {
    status: 'unavailable', items: [], counts: { met: 0, notMet: 0, unknown: 0 },
  });
});
