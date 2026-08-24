import { createHash } from 'node:crypto';
import type { EligibilityGapAnalysis } from './eligibility/gap-analysis';

export const MATCH_CONFIDENCE_RULE_VERSION = 'match-confidence-v1';

export interface MatchConfidenceInput {
  analysis: EligibilityGapAnalysis;
  profileUpdatedAt: string;
  programUpdatedAt: string;
  extractionRunId: string | null;
  extractionFingerprint: string | null;
  extractionCompletedAt: string | null;
  now?: Date;
}

export interface MatchConfidenceAssessment {
  ruleVersion: string;
  inputFingerprint: string;
  resultState: 'aligned' | 'mismatch' | 'unknown';
  confidenceScore: number;
  evidenceCoverage: number;
  profileCoverage: number;
  uncertaintyRatio: number;
  freshnessDays: number | null;
  components: {
    met: number;
    notMet: number;
    unknown: number;
    verified: number;
    inferred: number;
    total: number;
    freshnessScore: number;
  };
}

function boundedRatio(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.max(0, Math.min(1, numerator / denominator)) : 0;
}

function daysBetween(older: string | null, newer: Date): number | null {
  if (!older) return null;
  const timestamp = new Date(older).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.floor((newer.getTime() - timestamp) / 86_400_000));
}

export function calculateMatchConfidence(input: MatchConfidenceInput): MatchConfidenceAssessment {
  const items = input.analysis.items;
  const total = items.length;
  const verified = items.filter((item) => item.verification === 'verified').length;
  const inferred = total - verified;
  const known = input.analysis.counts.met + input.analysis.counts.notMet;
  const evidenceCoverage = boundedRatio(verified, total);
  const profileCoverage = boundedRatio(known, total);
  const uncertaintyRatio = boundedRatio(input.analysis.counts.unknown, total);
  const now = input.now ?? new Date();
  const freshnessDays = daysBetween(input.extractionCompletedAt, now);
  const extractionPrecedesProgram = Boolean(
    input.extractionCompletedAt && new Date(input.extractionCompletedAt) < new Date(input.programUpdatedAt)
  );
  const freshnessScore = freshnessDays == null || extractionPrecedesProgram
    ? 0
    : freshnessDays <= 7 ? 1 : freshnessDays <= 30 ? 0.7 : freshnessDays <= 90 ? 0.35 : 0;
  const confidenceScore = Math.round(
    evidenceCoverage * 45 + profileCoverage * 35 + freshnessScore * 20
  );
  const resultState = input.analysis.counts.notMet > 0
    ? 'mismatch'
    : total > 0 && input.analysis.counts.unknown === 0
      ? 'aligned'
      : 'unknown';
  const inputFingerprint = createHash('sha256').update(JSON.stringify({
    ruleVersion: MATCH_CONFIDENCE_RULE_VERSION,
    profileUpdatedAt: input.profileUpdatedAt,
    programUpdatedAt: input.programUpdatedAt,
    extractionRunId: input.extractionRunId,
    extractionFingerprint: input.extractionFingerprint,
    items: items.map((item) => [item.id, item.status, item.verification, item.confidence]),
  })).digest('hex');

  return {
    ruleVersion: MATCH_CONFIDENCE_RULE_VERSION,
    inputFingerprint,
    resultState,
    confidenceScore,
    evidenceCoverage,
    profileCoverage,
    uncertaintyRatio,
    freshnessDays,
    components: {
      met: input.analysis.counts.met,
      notMet: input.analysis.counts.notMet,
      unknown: input.analysis.counts.unknown,
      verified,
      inferred,
      total,
      freshnessScore,
    },
  };
}
