import { createHash } from 'node:crypto';
import { z } from 'zod';
import { generateText, parseJsonResponse, UPSTAGE_MODEL } from '../ai/client';

export const ELIGIBILITY_EXTRACTOR_VERSION = 'eligibility-v1';

export const REQUIREMENT_TYPES = [
  'entity_type', 'region', 'business_age', 'employee_count', 'annual_revenue',
  'industry', 'business_trait', 'technology_domain', 'certification', 'extra_tag',
  'rnd_capability', 'investment_stage', 'exclusion', 'other',
] as const;

export type RequirementType = (typeof REQUIREMENT_TYPES)[number];
export type SourceType = 'api_text' | 'html' | 'pdf' | 'hwpx' | 'hwp';

export interface EligibilitySourceInput {
  sourceKey: string;
  sourceType: SourceType;
  sourceUrl?: string | null;
  title?: string | null;
  contentText: string;
}

export interface PreparedEligibilitySource extends EligibilitySourceInput {
  contentSha256: string;
}

export interface ValidatedEligibilityRequirement {
  requirementType: RequirementType;
  operator: 'eq' | 'in' | 'gte' | 'lte' | 'between' | 'contains' | 'excludes';
  value: unknown;
  normalizedText: string;
  sourceKey: string | null;
  evidenceQuote: string | null;
  evidenceStart: number | null;
  evidenceEnd: number | null;
  verification: 'verified' | 'inferred';
  confidence: number;
}

const rawRequirementSchema = z.object({
  requirement_type: z.enum(REQUIREMENT_TYPES),
  operator: z.enum(['eq', 'in', 'gte', 'lte', 'between', 'contains', 'excludes']),
  value: z.unknown(),
  normalized_text: z.string().min(1),
  source_key: z.string().min(1).nullable().optional(),
  evidence_quote: z.string().min(1).nullable().optional(),
  verification: z.enum(['verified', 'inferred']),
  confidence: z.number().min(0).max(1),
});

const responseSchema = z.object({ requirements: z.array(z.unknown()).default([]) });

export function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function prepareEligibilitySources(
  sources: EligibilitySourceInput[]
): PreparedEligibilitySource[] {
  const seen = new Set<string>();
  return sources
    .map((source) => ({ ...source, contentText: source.contentText.trim() }))
    .filter((source) => source.contentText.length > 0)
    .map((source) => {
      if (seen.has(source.sourceKey)) {
        throw new Error(`Duplicate eligibility source key: ${source.sourceKey}`);
      }
      seen.add(source.sourceKey);
      return { ...source, contentSha256: sha256(source.contentText) };
    });
}

export function sourceFingerprint(sources: PreparedEligibilitySource[]): string {
  const canonical = [...sources]
    .sort((a, b) => a.sourceKey.localeCompare(b.sourceKey))
    .map((source) => `${source.sourceKey}:${source.contentSha256}`)
    .join('\n');
  return sha256(canonical);
}

/**
 * Validate the model output against stored source text. A claimed verified fact whose quote
 * cannot be found is retained for review, but deterministically downgraded to inferred.
 * Structurally invalid requirements are discarded.
 */
export function validateEligibilityRequirements(
  rawRequirements: unknown[],
  sources: PreparedEligibilitySource[]
): ValidatedEligibilityRequirement[] {
  const sourcesByKey = new Map(sources.map((source) => [source.sourceKey, source]));
  const validated: ValidatedEligibilityRequirement[] = [];

  for (const raw of rawRequirements) {
    const parsed = rawRequirementSchema.safeParse(raw);
    if (!parsed.success) continue;

    const item = parsed.data;
    const sourceKey = item.source_key ?? null;
    const quote = item.evidence_quote?.trim() ?? null;
    const source = sourceKey ? sourcesByKey.get(sourceKey) : undefined;
    const start = source && quote ? source.contentText.indexOf(quote) : -1;
    const evidenceIsValid = Boolean(source && quote && start >= 0);
    const verification = item.verification === 'verified' && evidenceIsValid
      ? 'verified'
      : 'inferred';

    validated.push({
      requirementType: item.requirement_type,
      operator: item.operator,
      value: item.value,
      normalizedText: item.normalized_text,
      sourceKey: source ? sourceKey : null,
      evidenceQuote: evidenceIsValid ? quote : null,
      evidenceStart: evidenceIsValid ? start : null,
      evidenceEnd: evidenceIsValid && quote ? start + quote.length : null,
      verification,
      confidence: item.confidence,
    });
  }

  return validated;
}

export interface EligibilityExtractionResult {
  extractorVersion: string;
  model: string;
  sourceFingerprint: string;
  requirements: ValidatedEligibilityRequirement[];
}

export async function extractEligibilityRequirements(
  sources: PreparedEligibilitySource[],
  generate: typeof generateText = generateText
): Promise<EligibilityExtractionResult> {
  const sourcePayload = sources.map((source) => ({
    source_key: source.sourceKey,
    title: source.title,
    text: source.contentText,
  }));
  const text = await generate({
    maxTokens: 1800,
    prompt: `정부지원사업의 신청 자격과 제외 조건만 추출하세요. 반드시 JSON만 응답하세요.

원칙:
- 원문에 없는 조건은 만들지 마세요.
- verified는 evidence_quote가 해당 source_key의 text에 글자 그대로 존재할 때만 사용하세요.
- 명시적 조건이지만 정규화에 해석이 필요한 경우 inferred로 표시하세요.
- confidence는 추출 확신도 0~1입니다. 신청자의 자격 확률이 아닙니다.
- 홍보 문구, 지원 내용, 신청 절차는 자격 조건으로 추출하지 마세요.

소스:
${JSON.stringify(sourcePayload)}

형식:
{
  "requirements": [{
    "requirement_type": ${JSON.stringify(REQUIREMENT_TYPES)} 중 하나,
    "operator": "eq" | "in" | "gte" | "lte" | "between" | "contains" | "excludes",
    "value": "정규화된 값, 배열 또는 {min,max,unit}",
    "normalized_text": "조건을 간결한 한국어로 표현",
    "source_key": "위 소스 키",
    "evidence_quote": "소스에 그대로 존재하는 짧은 인용문",
    "verification": "verified" | "inferred",
    "confidence": 0.0
  }]
}`,
  });

  const parsedJson = parseJsonResponse<unknown>(text);
  const parsedResponse = responseSchema.parse(parsedJson);
  return {
    extractorVersion: ELIGIBILITY_EXTRACTOR_VERSION,
    model: UPSTAGE_MODEL,
    sourceFingerprint: sourceFingerprint(sources),
    requirements: validateEligibilityRequirements(parsedResponse.requirements, sources),
  };
}
