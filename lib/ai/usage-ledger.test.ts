import test from 'node:test';
import assert from 'node:assert/strict';
import { recordAiUsage, usageCorrelationHash } from './usage-ledger';

test('usage correlation values are irreversible fixed-length hashes', () => {
  const hash = usageCorrelationHash('request-123');
  assert.equal(hash.length, 64);
  assert.notEqual(hash, 'request-123');
  assert.equal(hash, usageCorrelationHash('request-123'));
});

test('user attribution cannot be detached from a user', async () => {
  await assert.rejects(() => recordAiUsage({} as never, {
    userId: null, attributionClass: 'user', feature: 'match_explanation', action: 'generate',
    provider: 'upstage', model: 'solar', inputTokens: null, outputTokens: null,
    outcome: 'succeeded', correlationHash: usageCorrelationHash('x'),
    startedAt: '2026-08-25T00:00:00Z', completedAt: '2026-08-25T00:00:01Z',
  }), /requires a user ID/);
});

test('duplicate correlation is idempotent without storing content', async () => {
  let inserted: Record<string, unknown> | null = null;
  const supabase = { from: () => ({ insert: async (row: Record<string, unknown>) => { inserted = row; return { error: { code: '23505' } }; } }) };
  await recordAiUsage(supabase as never, {
    userId: null, attributionClass: 'system_import', feature: 'eligibility_extraction', action: 'extract',
    provider: 'upstage', model: 'solar', inputTokens: null, outputTokens: null,
    outcome: 'provider_error', errorCategory: 'provider', correlationHash: usageCorrelationHash('same'),
    startedAt: '2026-08-25T00:00:00Z', completedAt: '2026-08-25T00:00:01Z',
  });
  assert.ok(inserted);
  assert.deepEqual(Object.keys(inserted!).sort(), ['action','attribution_class','completed_at','correlation_hash','error_category','feature','input_tokens','model','outcome','output_tokens','provider','started_at','user_id'].sort());
});
