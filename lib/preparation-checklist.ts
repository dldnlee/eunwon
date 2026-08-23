export type ChecklistVerification = 'verified' | 'inferred' | 'user';

export interface RequirementForChecklist {
  id: string;
  requirement_type: string;
  normalized_text: string;
  verification: 'verified' | 'inferred';
  confidence: number | string;
  evidence_quote: string | null;
  program_source_documents: {
    title: string | null;
    source_url: string | null;
  } | {
    title: string | null;
    source_url: string | null;
  }[] | null;
}

export interface ChecklistSeed {
  source_requirement_id: string;
  label: string;
  verification: 'verified' | 'inferred';
  confidence: number;
  evidence_quote: string | null;
  source_title: string | null;
  source_url: string | null;
}

function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

export function buildChecklistSeeds(requirements: RequirementForChecklist[]): ChecklistSeed[] {
  return requirements.map((requirement) => {
    const source = Array.isArray(requirement.program_source_documents)
      ? requirement.program_source_documents[0] ?? null
      : requirement.program_source_documents;
    const prefix = requirement.requirement_type === 'exclusion'
      ? '제외 조건 확인'
      : '자격 증빙 준비';
    const confidence = Number(requirement.confidence);

    return {
      source_requirement_id: requirement.id,
      label: `${prefix} · ${requirement.normalized_text.trim()}`.slice(0, 500),
      verification: requirement.verification,
      confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0,
      evidence_quote: requirement.verification === 'verified'
        ? requirement.evidence_quote?.trim().slice(0, 2000) || null
        : requirement.evidence_quote?.trim().slice(0, 2000) || null,
      source_title: source?.title?.trim().slice(0, 500) || null,
      source_url: safeHttpUrl(source?.source_url),
    };
  }).filter((item) => item.label.length > 0);
}
