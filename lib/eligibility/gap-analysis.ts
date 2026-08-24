import type { Profile } from '@/lib/types';
import type { RequirementType } from './extraction';

export type EligibilityGapStatus = 'met' | 'not_met' | 'unknown';

export interface EligibilityGapRequirement {
  id: string;
  requirementType: RequirementType;
  operator: 'eq' | 'in' | 'gte' | 'lte' | 'between' | 'contains' | 'excludes';
  value: unknown;
  normalizedText: string;
  verification: 'verified' | 'inferred';
  confidence: number | null;
  evidenceQuote: string | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
}

export interface EligibilityGapItem {
  id: string;
  requirement: string;
  status: EligibilityGapStatus;
  reason: string;
  profileField: string | null;
  profileIssue: 'missing' | 'mismatch' | null;
  verification: 'verified' | 'inferred';
  confidence: number | null;
  evidenceQuote: string | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
}

export interface EligibilityGapAnalysis {
  status: 'available' | 'unavailable';
  items: EligibilityGapItem[];
  counts: { met: number; notMet: number; unknown: number };
}

type Evaluation = Pick<EligibilityGapItem, 'status' | 'reason' | 'profileField' | 'profileIssue'>;

const unknown = (reason: string, profileField: string | null = null, missing = false): Evaluation => ({
  status: 'unknown', reason, profileField, profileIssue: missing ? 'missing' : null,
});

const result = (met: boolean, reason: string, profileField: string): Evaluation => ({
  status: met ? 'met' : 'not_met', reason, profileField, profileIssue: met ? null : 'mismatch',
});

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value.trim()].filter(Boolean);
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
  return [];
}

function comparable(value: string): string {
  return value.replace(/[\s·ㆍ・,()[\]{}「」『』]/g, '').toLowerCase();
}

function overlaps(actual: string[], required: string[]): boolean {
  return actual.some((a) => required.some((r) => {
    const left = comparable(a);
    const right = comparable(r);
    return left === right || left.includes(right) || right.includes(left);
  }));
}

const PROFILE_ENTITY_TYPES = ['법인', '개인사업자', '예비창업자'];
const PROFILE_REGIONS = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기',
  '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];

function supportedValues(values: string[], vocabulary: string[]): string[] {
  return values.filter((value) => vocabulary.some((known) => comparable(value).includes(comparable(known))));
}

function numberFrom(value: unknown, keys: string[]): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    if (typeof record[key] === 'number' && Number.isFinite(record[key])) return record[key];
  }
  return null;
}

function numericEvaluation(
  requirement: EligibilityGapRequirement,
  actual: number | null,
  profileField: string,
  label: string,
  multiplier = 1
): Evaluation {
  if (actual == null) return unknown(`${label} 정보를 입력하면 확인할 수 있어요.`, profileField, true);
  const min = numberFrom(requirement.value, ['min', 'minimum', 'from']);
  const max = numberFrom(requirement.value, ['max', 'maximum', 'to']);
  const scalar = numberFrom(requirement.value, ['value', 'count', 'amount', 'months', 'years']);
  const lower = (min ?? scalar);
  const upper = (max ?? scalar);
  let met: boolean | null = null;
  if (requirement.operator === 'gte' && lower != null) met = actual >= lower * multiplier;
  if (requirement.operator === 'lte' && upper != null) met = actual <= upper * multiplier;
  if (requirement.operator === 'eq' && scalar != null) met = actual === scalar * multiplier;
  if (requirement.operator === 'between' && lower != null && upper != null) {
    met = actual >= lower * multiplier && actual <= upper * multiplier;
  }
  return met == null
    ? unknown('구조화된 기준을 자동으로 비교할 수 없어 원문 확인이 필요해요.', profileField)
    : result(met, met ? `${label} 정보가 명시된 조건과 맞아요.` : `${label} 정보가 명시된 조건과 달라요.`, profileField);
}

function evaluateVerified(requirement: EligibilityGapRequirement, profile: Profile): Evaluation {
  const required = strings(requirement.value);
  switch (requirement.requirementType) {
    case 'entity_type': {
      if (!profile.entity_type) return unknown('사업자 형태를 입력하면 확인할 수 있어요.', 'entity_type', true);
      const entityValues = supportedValues(required, PROFILE_ENTITY_TYPES);
      return entityValues.length
        ? result(overlaps([profile.entity_type], entityValues), '사업자 형태를 공고 조건과 비교했어요.', 'entity_type')
        : unknown('사업자 형태 기준을 자동으로 비교할 수 없어 원문 확인이 필요해요.', 'entity_type');
    }
    case 'region': {
      if (!profile.region) return unknown('사업장 지역을 입력하면 확인할 수 있어요.', 'region', true);
      if (required.some((item) => /전국|국내/.test(item))) {
        return result(true, '전국 또는 국내 대상 조건이에요.', 'region');
      }
      const regionValues = supportedValues(required, PROFILE_REGIONS);
      return regionValues.length
        ? result(overlaps([profile.region], regionValues), '사업장 지역을 공고 조건과 비교했어요.', 'region')
        : unknown('지역 기준을 자동으로 비교할 수 없어 원문 확인이 필요해요.', 'region');
    }
    case 'business_age': {
      const unit = requirement.value && typeof requirement.value === 'object' && !Array.isArray(requirement.value)
        ? String((requirement.value as Record<string, unknown>).unit ?? '') : '';
      return numericEvaluation(requirement, profile.age_months, 'age_months', '업력', /year|년/.test(unit) ? 12 : 1);
    }
    case 'employee_count':
      return numericEvaluation(requirement, profile.employee_count, 'employee_count', '직원 수');
    case 'annual_revenue':
      return numericEvaluation(requirement, profile.annual_revenue_krw, 'annual_revenue_krw', '연 매출');
    case 'certification':
      return required.length
        ? result(overlaps(profile.certifications, required), '보유 인증을 공고 조건과 비교했어요.', 'certifications')
        : unknown('인증 기준을 자동으로 비교할 수 없어 원문 확인이 필요해요.', 'certifications');
    case 'business_trait':
      return required.length
        ? result(overlaps(profile.business_traits, required), '사업 특성을 공고 조건과 비교했어요.', 'business_traits')
        : unknown('사업 특성 기준을 자동으로 비교할 수 없어 원문 확인이 필요해요.', 'business_traits');
    case 'technology_domain':
      return required.length
        ? result(overlaps(profile.tech_domains, required), '기술 분야를 공고 조건과 비교했어요.', 'tech_domains')
        : unknown('기술 분야 기준을 자동으로 비교할 수 없어 원문 확인이 필요해요.', 'tech_domains');
    case 'extra_tag':
      return required.length
        ? result(overlaps(profile.extra_tags, required), '기업 특성을 공고 조건과 비교했어요.', 'extra_tags')
        : unknown('기업 특성 기준을 자동으로 비교할 수 없어 원문 확인이 필요해요.', 'extra_tags');
    case 'rnd_capability':
      return required.length
        ? result(overlaps(profile.rnd_capability, required), '연구개발 역량을 공고 조건과 비교했어요.', 'rnd_capability')
        : unknown('연구개발 역량 기준을 자동으로 비교할 수 없어 원문 확인이 필요해요.', 'rnd_capability');
    case 'investment_stage':
      if (!profile.investment_stage) return unknown('투자 단계를 입력하면 확인할 수 있어요.', 'investment_stage', true);
      return required.length
        ? result(overlaps([profile.investment_stage], required), '투자 단계를 공고 조건과 비교했어요.', 'investment_stage')
        : unknown('투자 단계 기준을 자동으로 비교할 수 없어 원문 확인이 필요해요.', 'investment_stage');
    case 'industry':
      if (!profile.industry_name) return unknown('업종을 입력하면 확인할 수 있어요.', 'industry_name', true);
      return required.length
        ? result(overlaps([profile.industry_name], required), '업종을 공고 조건과 비교했어요.', 'industry_name')
        : unknown('업종 기준을 자동으로 비교할 수 없어 원문 확인이 필요해요.', 'industry_name');
    case 'exclusion':
    case 'other':
      return unknown('자동 판정 범위를 벗어난 조건이므로 원문 확인이 필요해요.');
  }
}

export function evaluateEligibilityGaps(
  requirements: EligibilityGapRequirement[],
  profile: Profile
): EligibilityGapAnalysis {
  if (requirements.length === 0) {
    return { status: 'unavailable', items: [], counts: { met: 0, notMet: 0, unknown: 0 } };
  }
  const items = requirements.map((requirement): EligibilityGapItem => {
    const evaluation = requirement.verification === 'inferred'
      ? unknown('해석이 포함된 조건이라 자동 판정하지 않았어요.')
      : evaluateVerified(requirement, profile);
    return {
      id: requirement.id,
      requirement: requirement.normalizedText,
      verification: requirement.verification,
      confidence: requirement.confidence,
      evidenceQuote: requirement.evidenceQuote,
      sourceTitle: requirement.sourceTitle,
      sourceUrl: requirement.sourceUrl,
      ...evaluation,
    };
  });
  return {
    status: 'available',
    items,
    counts: {
      met: items.filter((item) => item.status === 'met').length,
      notMet: items.filter((item) => item.status === 'not_met').length,
      unknown: items.filter((item) => item.status === 'unknown').length,
    },
  };
}
