import type { Program } from './types';

export interface DuplicateRestriction {
  clause: string;
  verification: 'verified' | 'inferred';
  sourceUrl: string | null;
}

export interface PriorApplicationBenefit {
  title: string;
  agency: string;
  category: string | null;
  fundingType: string | null;
  status: string;
}

export interface DuplicateBenefitAssessment {
  level: 'possible_conflict' | 'needs_confirmation';
  priorTitle: string;
  clause: string;
  sourceUrl: string | null;
}

const DUPLICATE_LANGUAGE = /중복|동일.{0,12}(지원|사업|과제)|유사.{0,12}(지원|사업|과제)|기.?지원|수혜|지원받/;

function normalized(value: string | null | undefined): string {
  return (value ?? '').replace(/\s|[()[\]{}「」『』·ㆍ,._-]/g, '').toLowerCase();
}

function same(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = normalized(left);
  const b = normalized(right);
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
}

export function assessDuplicateBenefit(input: {
  program: Pick<Program, 'title' | 'agency' | 'category' | 'funding_type'>;
  restrictions: DuplicateRestriction[];
  priorBenefits: PriorApplicationBenefit[];
}): DuplicateBenefitAssessment | null {
  const restriction = input.restrictions.find((item) =>
    item.verification === 'verified' && DUPLICATE_LANGUAGE.test(item.clause)
  );
  if (!restriction || input.priorBenefits.length === 0) return null;

  const ranked = input.priorBenefits.map((prior) => {
    const overlap = Number(same(input.program.title, prior.title)) * 3
      + Number(same(input.program.agency, prior.agency)) * 2
      + Number(same(input.program.category, prior.category))
      + Number(same(input.program.funding_type, prior.fundingType));
    return { prior, overlap };
  }).sort((a, b) => b.overlap - a.overlap);
  const candidate = ranked[0];
  return {
    level: candidate.overlap >= 2 ? 'possible_conflict' : 'needs_confirmation',
    priorTitle: candidate.prior.title,
    clause: restriction.clause,
    sourceUrl: restriction.sourceUrl,
  };
}
