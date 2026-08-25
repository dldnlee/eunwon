import type { SupabaseClient } from '@supabase/supabase-js';
import type { Program } from '@/lib/types';

/**
 * Deterministic, explainable candidate ranking — docs/automated-instagram-marketing-plan.md §4 step 1.
 *
 * candidate_score =
 *   audience_relevance * 0.30
 * + deadline_urgency    * 0.25
 * + benefit_clarity     * 0.20
 * + source_completeness * 0.15
 * + content_novelty     * 0.10
 */

export interface CandidateScore {
  audienceRelevance: number;
  deadlineUrgency: number;
  benefitClarity: number;
  sourceCompleteness: number;
  contentNovelty: number;
  total: number;
}

export interface ScoredCandidate {
  program: Program;
  score: CandidateScore;
}

/** Days until deadline → urgency in [0, 1]. Missing deadlines score low (they can't anchor a post). */
export function deadlineUrgency(deadlineEnd: string | null, now = new Date()): number {
  if (!deadlineEnd) return 0.1;
  const end = new Date(`${deadlineEnd}T00:00:00Z`);
  if (Number.isNaN(end.getTime())) return 0.1;
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
  if (daysLeft < 0) return 0; // already expired — should have been excluded earlier
  // Peaks inside the 3–14 day window: soon enough to matter, not so soon it's unpublishable.
  if (daysLeft <= 14) return daysLeft >= 3 ? 1 : 0.6;
  return Math.max(0.2, 1 - (daysLeft - 14) / 60);
}

/** Concrete, verifiable benefit info → clarity in [0, 1]. */
export function benefitClarity(program: Pick<Program, 'funding_amount_krw' | 'funding_type' | 'ai_summary'>): number {
  let score = 0;
  if (program.funding_amount_krw !== null && program.funding_amount_krw > 0) score += 0.7;
  if (program.funding_type) score += 0.15;
  if (program.ai_summary) score += 0.15;
  return score;
}

/** How completely the program's eligibility fields are populated, in [0, 1]. */
export function sourceCompleteness(program: Program): number {
  let filled = 0;
  let total = 0;
  const checks: unknown[] = [
    program.region?.length,
    program.entity_types?.length,
    program.deadline_end,
    program.detail_url ?? program.apply_url,
    program.apply_method,
    program.target_raw,
  ];
  for (const value of checks) {
    total += 1;
    if (value) filled += 1;
  }
  return filled / total;
}

/** Structural audience fit — how precisely the program addresses a definable founder segment. */
export function audienceRelevance(program: Program): number {
  let score = 0.2;
  if (program.entity_types?.length) score += 0.25;
  if ((program.region?.length ?? 0) > 0 || program.is_nationwide) score += 0.15;
  if (program.min_age_months !== null || program.max_age_months !== null) score += 0.2;
  if (program.min_employees !== null || program.max_employees !== null) score += 0.1;
  if (program.category) score += 0.1;
  return Math.min(1, score);
}

/** Novelty in [0, 1]: full credit for programs never posted, decaying with recency of last use. */
export function contentNovelty(lastPostedAt: string | null | undefined, now = new Date()): number {
  if (!lastPostedAt) return 1;
  const ageDays = (now.getTime() - new Date(lastPostedAt).getTime()) / 86_400_000;
  if (ageDays >= 30) return 1;
  return Math.max(0, ageDays / 30);
}

export function scoreCandidate(
  program: Program,
  lastPostedAt: string | null | undefined,
  now = new Date(),
): CandidateScore {
  const parts = {
    audienceRelevance: audienceRelevance(program),
    deadlineUrgency: deadlineUrgency(program.deadline_end, now),
    benefitClarity: benefitClarity(program),
    sourceCompleteness: sourceCompleteness(program),
    contentNovelty: contentNovelty(lastPostedAt, now),
  };
  const total =
    parts.audienceRelevance * 0.3 +
    parts.deadlineUrgency * 0.25 +
    parts.benefitClarity * 0.2 +
    parts.sourceCompleteness * 0.15 +
    parts.contentNovelty * 0.1;
  return { ...parts, total };
}

/**
 * Selects today's ranked candidates among active programs.
 *
 * Exclusion rules (plan §4 step 1): inactive/expired, missing source URL, programs that
 * already have a non-terminal marketing post. Recently posted programs are not excluded
 * outright — they lose novelty points instead — but a hard window guards against spamming.
 */
export async function selectCandidates(
  supabase: SupabaseClient,
  options: { limit?: number; now?: Date; recentPostCutoffDays?: number } = {},
): Promise<{ candidates: ScoredCandidate[]; excludedCount: number }> {
  const now = options.now ?? new Date();
  const limit = options.limit ?? 5;
  const recentWindowStart = new Date(now);
  recentWindowStart.setDate(recentWindowStart.getDate() - (options.recentPostCutoffDays ?? 7));

  const today = now.toISOString().slice(0, 10);

  const { data: programs, error } = await supabase
    .from('programs')
    .select('*')
    .eq('is_active', true)
    .or(`deadline_end.is.null,deadline_end.gte.${today}`)
    .order('updated_at', { ascending: false })
    .limit(300);

  if (error) throw new Error(`candidate query failed: ${error.message}`);

  // Any program with a live workflow row is off-limits regardless of status — a rejected or
  // cancelled draft still counts as "already covered recently" for the daily job.
  const { data: existingPosts, error: postsError } = await supabase
    .from('marketing_posts')
    .select('program_id, updated_at')
    .gte('updated_at', recentWindowStart.toISOString());

  if (postsError) throw new Error(`existing-post query failed: ${postsError.message}`);

  const lastPostedByProgram = new Map<string, string>();
  for (const row of existingPosts ?? []) {
    if (row.program_id && typeof row.updated_at === 'string') {
      const current = lastPostedByProgram.get(row.program_id);
      if (!current || current < row.updated_at) lastPostedByProgram.set(row.program_id, row.updated_at);
    }
  }

  const excludedCount = (programs ?? []).filter((p) => !p.detail_url && !p.apply_url).length;

  const candidates = (programs ?? [])
    .filter((program) => {
      if (!program.title || !program.agency) return false;
      // Every post links to the original announcement (operating principle #2).
      if (!program.detail_url && !program.apply_url) return false;
      const lastPostedAt = lastPostedByProgram.get(program.id);
      if (lastPostedAt) {
        const ageDays = (now.getTime() - new Date(lastPostedAt).getTime()) / 86_400_000;
        if (ageDays < 14) return false; // hard anti-repeat window
      }
      return true;
    })
    .map((program): ScoredCandidate => ({
      program: program as Program,
      score: scoreCandidate(program as Program, lastPostedByProgram.get(program.id), now),
    }))
    .sort((a, b) => b.score.total - a.score.total)
    .slice(0, limit);

  return { candidates, excludedCount };
}
