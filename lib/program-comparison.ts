import type { EligibilityGapAnalysis } from './eligibility/gap-analysis';
import type { MatchConfidenceAssessment } from './match-confidence';
import type { Program, SavedProgram } from './types';

export interface ProgramComparisonItem {
  id: string;
  title: string;
  agency: string;
  category: string | null;
  detailHref: string;
  applyUrl: string | null;
  benefit: { label: string | null; amountKrw: number | null };
  deadlineEnd: string | null;
  eligibility: {
    met: number;
    notMet: number;
    unknown: number;
    status: 'aligned' | 'mismatch' | 'unknown';
  };
  qualityScore: number | null;
  preparation: { completed: number; total: number } | null;
  application: { status: string | null; nextAction: string | null; dueAt: string | null } | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseComparisonIds(raw: string | string[] | undefined): string[] {
  const value = Array.isArray(raw) ? raw.join(',') : raw ?? '';
  const ids = Array.from(new Set(value.split(',').map((id) => id.trim()).filter(Boolean)));
  return ids.length >= 2 && ids.length <= 4 && ids.every((id) => UUID.test(id)) ? ids : [];
}

export function buildProgramComparisonItem(input: {
  program: Program;
  gaps: EligibilityGapAnalysis;
  confidence: MatchConfidenceAssessment | null;
  checklist: { completed: number; total: number } | null;
  saved: Pick<SavedProgram, 'status' | 'next_action' | 'next_action_due_at'> | null;
}): ProgramComparisonItem {
  const { program, gaps, confidence, checklist, saved } = input;
  const eligibilityStatus = gaps.counts.notMet > 0
    ? 'mismatch'
    : gaps.status === 'available' && gaps.items.length > 0 && gaps.counts.unknown === 0
      ? 'aligned'
      : 'unknown';
  return {
    id: program.id,
    title: program.title,
    agency: program.agency,
    category: program.category,
    detailHref: `/program/${program.id}`,
    applyUrl: program.apply_url,
    benefit: { label: program.funding_type, amountKrw: program.funding_amount_krw },
    deadlineEnd: program.deadline_end,
    eligibility: {
      met: gaps.counts.met,
      notMet: gaps.counts.notMet,
      unknown: gaps.counts.unknown,
      status: eligibilityStatus,
    },
    qualityScore: confidence?.confidenceScore ?? null,
    preparation: checklist,
    application: saved ? {
      status: saved.status,
      nextAction: saved.next_action,
      dueAt: saved.next_action_due_at,
    } : null,
  };
}
