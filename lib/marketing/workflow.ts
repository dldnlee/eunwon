import type { SupabaseClient } from '@supabase/supabase-js';
import type { Program } from '@/lib/types';
import { selectCandidates } from './candidate-selection';
import { generateDraftForProgram, GENERATION_VERSION, type DraftGenerationResult } from './generate-draft';
import { buildFactSnapshot, type MarketingContentType, type MarketingPostRow } from './types';

export interface GenerateDraftsSummary {
  generated: number;
  validationFailed: number;
  skipped: number;
  errors: string[];
  postIds: string[];
}

/**
 * Daily draft pipeline (plan §4 steps 1–4): select ranked candidates → freeze fact snapshot
 * → generate structured copy → validate → persist as awaiting_approval or validation_failed.
 *
 * Idempotent per run window: candidate selection already excludes programs with recent posts,
 * and each generated post carries a unique idempotency key so a retried insert can't dupe.
 */
export async function generateDailyDrafts(
  supabase: SupabaseClient,
  options: { count?: number; contentType?: MarketingContentType; now?: Date } = {},
): Promise<GenerateDraftsSummary> {
  const now = options.now ?? new Date();
  const summary: GenerateDraftsSummary = { generated: 0, validationFailed: 0, skipped: 0, errors: [], postIds: [] };

  let candidates;
  try {
    candidates = await selectCandidates(supabase, {
      limit: Math.max(options.count ?? 3, 1),
      now,
    });
  } catch (err) {
    summary.errors.push(err instanceof Error ? err.message : String(err));
    return summary;
  }

  for (const { program, score } of candidates.candidates) {
    try {
      const result = await generateAndPersist(supabase, program, score.total, options.contentType ?? 'program_spotlight', now);
      if (result) {
        summary.postIds.push(result);
        summary.generated += 1;
      }
      const status = await getPostStatus(supabase, result);
      if (status === 'validation_failed') summary.validationFailed += 1;
    } catch (err) {
      summary.skipped += 1;
      summary.errors.push(`${program.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return summary;
}

async function generateAndPersist(
  supabase: SupabaseClient,
  program: Program,
  candidateScore: number,
  contentType: MarketingContentType,
  now: Date,
): Promise<string | null> {
  const idempotencyKey = `instagram:eunwon:${program.id}:${now.toISOString().slice(0, 10)}`;

  // Mark in-flight first so concurrent runs can't double-generate for the same program/day.
  const { data: inserted, error: insertError } = await supabase
    .from('marketing_posts')
    .insert({
      program_id: program.id,
      content_type: contentType,
      status: 'generating',
      candidate_score: candidateScore,
      fact_snapshot: buildFactSnapshot(program),
      source_url: program.detail_url ?? program.apply_url,
      generation_version: GENERATION_VERSION,
      idempotency_key: idempotencyKey,
    })
    .select('id')
    .single();

  if (insertError) {
    if (insertError.code === '23505') return null; // already generated today for this program
    throw new Error(`post insert failed: ${insertError.message}`);
  }

  const postId = inserted!.id as string;

  let result: DraftGenerationResult;
  try {
    result = await generateDraftForProgram(supabase, program, contentType);
  } catch (err) {
    await supabase
      .from('marketing_posts')
      .update({ status: 'validation_failed', validation_errors: [err instanceof Error ? err.message : String(err)] })
      .eq('id', postId);
    throw err;
  }

  const failed = result.validationErrors.length > 0 || result.content === null;
  const caption = result.content?.caption ?? null;

  const { error: updateError } = await supabase
    .from('marketing_posts')
    .update({
      status: failed ? 'validation_failed' : 'awaiting_approval',
      generated_content: result.content,
      validation_errors: failed ? result.validationErrors : null,
      caption,
    })
    .eq('id', postId)
    .eq('status', 'generating');

  if (updateError) throw new Error(`post update failed: ${updateError.message}`);
  return postId;
}

async function getPostStatus(supabase: SupabaseClient, postId: string | null): Promise<string | null> {
  if (!postId) return null;
  const { data } = await supabase.from('marketing_posts').select('status').eq('id', postId).maybeSingle();
  return (data as Pick<MarketingPostRow, 'status'> | null)?.status ?? null;
}
