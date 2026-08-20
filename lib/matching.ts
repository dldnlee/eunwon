import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile, Program } from '@/lib/types';

export interface MatchOptions {
  limit?: number;
}

/**
 * Pure SQL filtering — no AI involved. A program matches when every
 * numeric/eligibility bound is either unset (no restriction) or satisfied.
 * Region and entity_type are the only hard requirements.
 */
export async function getMatchedPrograms(
  supabase: SupabaseClient,
  profile: Profile,
  options: MatchOptions = {}
): Promise<Program[]> {
  const today = new Date().toISOString().split('T')[0];
  const ageMonths = profile.age_months ?? 0;

  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .eq('is_active', true)
    .or(`deadline_end.is.null,deadline_end.gte.${today}`)
    .or(`is_nationwide.eq.true,region.cs.{"${profile.region}"}`)
    .or(`max_age_months.is.null,max_age_months.gte.${ageMonths}`)
    .contains('entity_types', [profile.entity_type])
    .order('deadline_end', { ascending: true, nullsFirst: false })
    .limit(options.limit ?? 50);

  if (error) throw error;
  return data ?? [];
}

/** Same eligibility filter as getMatchedPrograms, but just the count — for "N개 사업이 귀사에 맞습니다". */
export async function getMatchedProgramCount(
  supabase: SupabaseClient,
  profile: Profile
): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const ageMonths = profile.age_months ?? 0;

  const { count, error } = await supabase
    .from('programs')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .or(`deadline_end.is.null,deadline_end.gte.${today}`)
    .or(`is_nationwide.eq.true,region.cs.{"${profile.region}"}`)
    .or(`max_age_months.is.null,max_age_months.gte.${ageMonths}`)
    .contains('entity_types', [profile.entity_type]);

  if (error) throw error;
  return count ?? 0;
}

/** Highest possible return value of scoreMatch() — for normalizing to a percentage. */
export const MAX_MATCH_SCORE = 4;

/**
 * Relevance score for ranking — counts how many *optional* criteria a
 * program also satisfies beyond the hard region/entity_type match, so
 * more specifically-targeted programs surface first.
 */
export function scoreMatch(program: Program, profile: Profile): number {
  let score = 0;

  if (program.max_age_months != null && profile.age_months != null && program.max_age_months >= profile.age_months) {
    score += 1;
  }
  if (!program.is_nationwide) score += 1; // region-specific programs rank slightly higher for a local user
  if (profile.extra_tags.some((tag) => program.ai_tags?.includes(tag))) score += 1;
  if (profile.certifications.some((cert) => program.ai_tags?.includes(cert))) score += 1;

  return score;
}

/**
 * 중복수혜 제한 check — Korean support programs frequently bar applicants who
 * already received a similar benefit. Heuristic: flag programs sharing a
 * category with something the user has already been `selected` for.
 */
export async function findDuplicateBenefitConflict(
  supabase: SupabaseClient,
  userId: string,
  program: Program
): Promise<{ title: string } | null> {
  if (!program.category) return null;

  const { data, error } = await supabase
    .from('saved_programs')
    .select('program:programs(title, category)')
    .eq('user_id', userId)
    .eq('status', 'selected')
    .neq('program_id', program.id);

  if (error) throw error;

  const rows = (data ?? []) as unknown as { program: { title: string; category: string | null } }[];
  const conflict = rows.find((row) => row.program?.category === program.category);

  return conflict?.program ? { title: conflict.program.title } : null;
}
