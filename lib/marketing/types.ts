import type { Program } from '@/lib/types';

/** Full workflow state machine — docs/automated-instagram-marketing-plan.md §6 step 6. */
export type MarketingPostStatus =
  | 'candidate'
  | 'generating'
  | 'validation_failed'
  | 'awaiting_approval'
  | 'rejected'
  | 'approved'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'publish_failed'
  | 'cancelled';

export const MARKETING_CONTENT_TYPES = [
  'program_spotlight',
  'deadline_roundup',
  'eligibility_explainer',
  'common_mistake',
  'product_walkthrough',
  'customer_result',
] as const;
export type MarketingContentType = (typeof MARKETING_CONTENT_TYPES)[number];

/**
 * Frozen copy of the program fields a draft was generated from. Generated claims must
 * map back to these values exactly — see validation.ts. Never mutated after insert.
 */
export interface FactSnapshot {
  program_id: string;
  title: string;
  agency: string;
  source_url: string;
  eligible_regions: string[];
  is_nationwide: boolean;
  entity_types: string[];
  business_age_constraint: string | null;
  benefit_text: string | null;
  funding_amount_krw: number | null;
  deadline_start: string | null;
  deadline_end: string | null;
  application_url: string | null;
  retrieved_at: string;
}

export interface SlideContent {
  type: 'hook' | 'eligibility' | 'benefit' | 'deadline' | 'cta';
  headline: string;
  body?: string;
  bullets?: string[];
}

export interface GeneratedContent {
  contentType: MarketingContentType;
  audience: string;
  hook: string;
  slides: SlideContent[];
  caption: string;
  disclaimer: string;
  sourceLabel: string;
  hashtags: string[];
}

export interface MarketingPostRow {
  id: string;
  program_id: string | null;
  content_type: MarketingContentType;
  status: MarketingPostStatus;
  candidate_score: number | null;
  fact_snapshot: FactSnapshot;
  generated_content: GeneratedContent | null;
  validation_errors: string[] | null;
  caption: string | null;
  source_url: string | null;
  scheduled_for: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejected_reason: string | null;
  platform: string;
  platform_media_id: string | null;
  platform_permalink: string | null;
  idempotency_key: string | null;
  generation_version: string;
  template_version: string;
  created_at: string;
  updated_at: string;
}

export function formatBenefitText(fundingType: string | null, amountKrw: number | null): string | null {
  const parts: string[] = [];
  if (fundingType) parts.push(fundingType);
  if (amountKrw !== null && Number.isFinite(amountKrw)) {
    parts.push(`기업당 최대 ${Math.round(amountKrw).toLocaleString('ko-KR')}원`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function buildFactSnapshot(program: Program, now = new Date()): FactSnapshot {
  return {
    program_id: program.id,
    title: program.title,
    agency: program.agency,
    source_url: program.detail_url ?? program.apply_url ?? '',
    eligible_regions: program.region ?? [],
    is_nationwide: program.is_nationwide,
    entity_types: program.entity_types ?? [],
    business_age_constraint:
      program.min_age_months !== null || program.max_age_months !== null
        ? [
            program.min_age_months !== null ? `최소 ${program.min_age_months}개월` : null,
            program.max_age_months !== null ? `최대 ${program.max_age_months}개월` : null,
          ]
            .filter(Boolean)
            .join(' ~ ')
        : null,
    benefit_text: formatBenefitText(program.funding_type, program.funding_amount_krw),
    funding_amount_krw: program.funding_amount_krw ?? null,
    deadline_start: program.deadline_start ?? null,
    deadline_end: program.deadline_end ?? null,
    application_url: program.apply_url ?? null,
    retrieved_at: now.toISOString(),
  };
}
