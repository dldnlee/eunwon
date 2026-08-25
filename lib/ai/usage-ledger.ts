import { createHash, randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export type AiUsageAttribution = 'user' | 'workspace' | 'system_import' | 'admin_operation';
export type AiUsageFeature = 'match_explanation' | 'match_rating' | 'document_draft' | 'eligibility_extraction' | 'program_enrichment' | 'consultation_chat' | 'marketing_content_generation';

export function usageCorrelationHash(value: string = randomUUID()): string {
  return createHash('sha256').update(value).digest('hex');
}

export async function recordAiUsage(supabase: SupabaseClient, event: {
  userId: string | null; attributionClass: AiUsageAttribution; feature: AiUsageFeature; action: string;
  provider: string; model: string; inputTokens: number | null; outputTokens: number | null;
  outcome: 'succeeded' | 'provider_error' | 'timeout' | 'cancelled' | 'rejected_limit';
  errorCategory?: 'auth' | 'rate_limit' | 'provider' | 'timeout' | 'invalid_response' | 'internal' | 'limit' | null;
  correlationHash: string; startedAt: string; completedAt: string;
}) {
  if (event.attributionClass === 'user' && !event.userId) throw new Error('User-attributed AI usage requires a user ID');
  const { error } = await supabase.from('ai_usage_events').insert({
    user_id: event.userId, attribution_class: event.attributionClass, feature: event.feature,
    action: event.action, provider: event.provider, model: event.model,
    input_tokens: event.inputTokens, output_tokens: event.outputTokens, outcome: event.outcome,
    error_category: event.errorCategory ?? null, correlation_hash: event.correlationHash,
    started_at: event.startedAt, completed_at: event.completedAt,
  });
  if (error && error.code !== '23505') throw error;
}
