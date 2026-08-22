import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile, Program } from '@/lib/types';

export interface MatchOptions {
  limit?: number;
}

/** bizinfo classifies loan/guarantee programs (정책자금 융자, 특례보증, 이차보전, ...) under '금융'. */
const LOAN_CATEGORY = '금융';

/** No dedicated bizinfo category exists for contests — identified by title keyword instead. */
const CONTEST_TITLE_PATTERN = /공모|경진대회/;

export type ProgramBucket = 'loan' | 'contest' | 'program';

/**
 * Buckets every matched program into exactly one of three tabs — 대출
 * (loan/guarantee), 공모전 (contests), or 지원사업 (everything else). Order
 * matters: a program is checked for 대출 first, so a loan-flavored contest
 * (none currently exist, but if one did) lands under 대출.
 */
export function getProgramBucket(program: Program): ProgramBucket {
  if (program.category === LOAN_CATEGORY || program.ai_tags?.includes('대출')) return 'loan';
  if (CONTEST_TITLE_PATTERN.test(program.title)) return 'contest';
  return 'program';
}

/**
 * Pure SQL filtering — no AI involved. A program matches when every
 * numeric/eligibility bound is either unset (no restriction) or satisfied.
 * Region and entity_type are the only hard requirements; profile fields the
 * user left blank default to 0 (same convention as the pre-existing
 * age_months handling) — permissive for "max" bounds, exclusionary for
 * "min" bounds, consistent throughout rather than special-cased per field.
 */
// Postgrest's builder generics don't survive being threaded through a shared helper; the rest of
// this file already treats the query layer as untyped (see lib/types.ts's note on why a generated
// Database type isn't hand-rolled here).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildEligibilityQuery(query: any, profile: Profile) {
  const today = new Date().toISOString().split('T')[0];
  const ageMonths = profile.age_months ?? 0;
  const employeeCount = profile.employee_count ?? 0;
  const revenue = profile.annual_revenue_krw ?? 0;

  return query
    .eq('is_active', true)
    .or(`deadline_end.is.null,deadline_end.gte.${today}`)
    .or(`is_nationwide.eq.true,region.cs.{"${profile.region}"}`)
    .or(`max_age_months.is.null,max_age_months.gte.${ageMonths}`)
    .or(`min_age_months.is.null,min_age_months.lte.${ageMonths}`)
    .or(`max_employees.is.null,max_employees.gte.${employeeCount}`)
    .or(`min_employees.is.null,min_employees.lte.${employeeCount}`)
    .or(`max_annual_revenue_krw.is.null,max_annual_revenue_krw.gte.${revenue}`)
    .or(`min_annual_revenue_krw.is.null,min_annual_revenue_krw.lte.${revenue}`)
    .contains('entity_types', [profile.entity_type]);
}

export async function getMatchedPrograms(
  supabase: SupabaseClient,
  profile: Profile,
  options: MatchOptions = {}
): Promise<Program[]> {
  const { data, error } = await buildEligibilityQuery(supabase.from('programs').select('*'), profile)
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
  const { count, error } = await buildEligibilityQuery(
    supabase.from('programs').select('*', { count: 'exact', head: true }),
    profile
  );

  if (error) throw error;
  return count ?? 0;
}

/** Highest possible return value of scoreMatch() — for normalizing to a percentage. */
export const MAX_MATCH_SCORE = 9;

/**
 * Relevance score for ranking — counts how many *optional* criteria a
 * program also satisfies beyond the hard eligibility match, so
 * more specifically-targeted programs surface first. Uses the structured
 * required_* columns (AI-extracted at sync time — see syncPrograms.ts)
 * rather than matching against freeform ai_tags text, since ai_tags
 * vocabulary isn't guaranteed to line up with the profile's fixed option
 * lists (여성기업, B2B, 기업부설연구소 보유, ...).
 */
export function scoreMatch(program: Program, profile: Profile): number {
  let score = 0;

  if (program.max_age_months != null && profile.age_months != null && program.max_age_months >= profile.age_months) {
    score += 1;
  }
  if (!program.is_nationwide) score += 1; // region-specific programs rank slightly higher for a local user
  if (program.required_extra_tags.length > 0 && profile.extra_tags.some((t) => program.required_extra_tags.includes(t))) {
    score += 1;
  }
  if (program.required_certifications.length > 0 && profile.certifications.some((c) => program.required_certifications.includes(c))) {
    score += 1;
  }
  if (program.category && profile.interest_categories.includes(program.category)) score += 1;
  if (program.required_business_traits.length > 0 && profile.business_traits.some((t) => program.required_business_traits.includes(t))) {
    score += 1;
  }
  if (program.required_rnd_capability.length > 0 && profile.rnd_capability.some((c) => program.required_rnd_capability.includes(c))) {
    score += 1;
  }
  if (program.required_tech_domains.length > 0 && profile.tech_domains.some((d) => program.required_tech_domains.includes(d))) {
    score += 1;
  }
  if (
    program.required_investment_stage != null &&
    program.required_investment_stage !== '없음' &&
    program.required_investment_stage === profile.investment_stage
  ) {
    score += 1;
  }

  return score;
}

/**
 * "매칭도" badge percentage. getMatchedPrograms() already hard-filters to
 * programs the profile is eligible for, so every program shown here has
 * already cleared region/entity_type/age eligibility — scoreMatch() only
 * layers optional bonus criteria on top for ranking. A raw
 * scoreMatch()/MAX_MATCH_SCORE would show "0%" for an already-eligible
 * program with no bonus matches, which reads as "this isn't a match" when
 * it actually is. Anchor at a 50% eligibility baseline so the badge never
 * misrepresents a real match as a non-match.
 */
export function matchPercent(program: Program, profile: Profile): number {
  const ELIGIBILITY_BASELINE = 50;
  return Math.round(ELIGIBILITY_BASELINE + (scoreMatch(program, profile) / MAX_MATCH_SCORE) * (100 - ELIGIBILITY_BASELINE));
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
