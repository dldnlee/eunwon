import type { EligibilityGapAnalysis } from './eligibility/gap-analysis';
import type { Program, SavedStatus } from './types';

export const APPLICATION_SUMMARY_TEMPLATE_VERSION = 'application-summary-v1';

export interface SummaryChecklistItem {
  label: string;
  completed: boolean;
  verification: 'verified' | 'inferred' | 'user';
  confidence: number | null;
  evidenceQuote: string | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
}

export interface ApplicationSummarySnapshot {
  templateVersion: string;
  generatedAt: string;
  program: Pick<Program, 'id' | 'title' | 'agency' | 'deadline_end' | 'apply_url' | 'detail_url'>;
  application: {
    status: SavedStatus;
    notes: string | null;
    outcome: string | null;
    submittedAt: string | null;
    nextAction: string | null;
    nextActionDueAt: string | null;
  };
  checklist: SummaryChecklistItem[];
  eligibility: EligibilityGapAnalysis;
}

function publicHttpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function buildApplicationSummarySnapshot(input: {
  generatedAt: string;
  program: Program;
  saved: ApplicationSummarySnapshot['application'];
  checklist: SummaryChecklistItem[];
  eligibility: EligibilityGapAnalysis;
}): ApplicationSummarySnapshot {
  return {
    templateVersion: APPLICATION_SUMMARY_TEMPLATE_VERSION,
    generatedAt: input.generatedAt,
    program: {
      id: input.program.id,
      title: input.program.title,
      agency: input.program.agency,
      deadline_end: input.program.deadline_end,
      apply_url: publicHttpUrl(input.program.apply_url),
      detail_url: publicHttpUrl(input.program.detail_url),
    },
    application: input.saved,
    checklist: input.checklist.map((item) => ({ ...item, sourceUrl: publicHttpUrl(item.sourceUrl) })),
    eligibility: {
      ...input.eligibility,
      items: input.eligibility.items.map((item) => ({
        ...item,
        sourceUrl: publicHttpUrl(item.sourceUrl),
      })),
    },
  };
}
