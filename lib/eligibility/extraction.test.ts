import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractEligibilityRequirements,
  prepareEligibilitySources,
  sourceFingerprint,
  validateEligibilityRequirements,
} from './extraction';

const sources = prepareEligibilitySources([
  {
    sourceKey: 'target',
    sourceType: 'api_text',
    contentText: '서울 소재 창업 7년 이내 중소기업을 지원합니다.',
  },
  {
    sourceKey: 'application',
    sourceType: 'api_text',
    contentText: '온라인으로 신청하며 사업자등록증을 제출합니다.',
  },
]);

test('source fingerprint is stable regardless of input order', () => {
  assert.equal(sourceFingerprint(sources), sourceFingerprint([...sources].reverse()));
});

test('verified requirements retain exact source offsets', () => {
  const [requirement] = validateEligibilityRequirements([{
    requirement_type: 'business_age',
    operator: 'lte',
    value: { max: 84, unit: 'month' },
    normalized_text: '업력 7년 이내',
    source_key: 'target',
    evidence_quote: '창업 7년 이내',
    verification: 'verified',
    confidence: 0.98,
  }], sources);

  assert.equal(requirement.verification, 'verified');
  assert.equal(requirement.evidenceQuote, '창업 7년 이내');
  assert.equal(
    sources[0].contentText.slice(requirement.evidenceStart!, requirement.evidenceEnd!),
    requirement.evidenceQuote
  );
});

test('a fabricated citation is downgraded and invalid structures are discarded', () => {
  const requirements = validateEligibilityRequirements([
    {
      requirement_type: 'region', operator: 'in', value: ['부산'],
      normalized_text: '부산 소재', source_key: 'target', evidence_quote: '부산 소재',
      verification: 'verified', confidence: 0.8,
    },
    {
      requirement_type: 'made_up', operator: 'eq', value: true,
      normalized_text: '잘못된 유형', verification: 'inferred', confidence: 2,
    },
  ], sources);

  assert.equal(requirements.length, 1);
  assert.equal(requirements[0].verification, 'inferred');
  assert.equal(requirements[0].evidenceQuote, null);
});

test('AI extraction response passes through deterministic evidence validation', async () => {
  const result = await extractEligibilityRequirements(sources, async () => JSON.stringify({
    requirements: [{
      requirement_type: 'region', operator: 'in', value: ['서울'],
      normalized_text: '서울 소재', source_key: 'target', evidence_quote: '서울 소재',
      verification: 'verified', confidence: 0.99,
    }],
  }));

  assert.equal(result.requirements[0].verification, 'verified');
  assert.match(result.sourceFingerprint, /^[0-9a-f]{64}$/);
});

test('an empty extraction cannot silently succeed when a target source exists', async () => {
  await assert.rejects(
    extractEligibilityRequirements(sources, async () => JSON.stringify({ requirements: [] })),
    /no requirements/
  );
});
