import type { FactSnapshot, SlideContent } from './types';

/**
 * Deterministic validation layer 1 — docs/automated-instagram-marketing-plan.md §4 step 4.
 * Schema, lengths, required fields, prohibited phrases, and exact comparison of amounts
 * and deadlines against the frozen fact snapshot. AI-assisted review (layer 2) is a later
 * concern; nothing here rewrites content.
 */

export const PROHIBITED_PHRASES = [
  '최고',
  '가장 좋은',
  '무조건',
  '100% 지원',
  '반드시 받을',
  '누구나 받을',
  '전액 지원',
] as const;

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

const SLIDE_TYPES = ['hook', 'eligibility', 'benefit', 'deadline', 'cta'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function extractAmountsInText(text: string): number[] {
  const amounts: number[] = [];
  const patterns: [RegExp, (match: RegExpExecArray) => number][] = [
    [/([\d,]+(?:\.\d+)?)\s*억\s*원?/g, (match) => parseFloat(match[1].replace(/,/g, '')) * 100_000_000],
    [/([\d,]+)\s*천\s*만원/g, (match) => parseInt(match[1].replace(/,/g, ''), 10) * 10_000_000],
    [/([\d,]+)\s*만원/g, (match) => parseInt(match[1].replace(/,/g, ''), 10) * 10_000],
    [/((?:\d{1,3}(?:,\d{3})+)|\d{4,})\s*원/g, (match) => parseInt(match[1].replace(/,/g, ''), 10)],
  ];
  for (const [pattern, toAmount] of patterns) {
    for (const match of Array.from(text.matchAll(pattern))) {
      amounts.push(toAmount(match));
    }
  }
  return amounts;
}

export function formatKrw(amount: number): string {
  if (amount >= 100_000_000 && amount % 100_000_000 === 0) {
    return `${amount / 100_000_000}억원`;
  }
  if (amount >= 10_000 && amount % 10_000 === 0) {
    return `${amount / 10_000}만원`;
  }
  return `${amount.toLocaleString('ko-KR')}원`;
}

function validateSlide(slide: unknown, index: number, errors: string[]): slide is SlideContent {
  if (!isRecord(slide)) {
    errors.push(`slides[${index}]는 객체여야 합니다`);
    return false;
  }
  const label = `slides[${index}]`;
  if (!SLIDE_TYPES.includes(slide.type as never)) {
    errors.push(`${label}.type이 유효하지 않습니다: ${String(slide.type)}`);
  }
  if (typeof slide.headline !== 'string' || slide.headline.trim().length === 0 || slide.headline.length > 40) {
    errors.push(`${label}.headline은 1~40자여야 합니다`);
  }
  if (slide.body !== undefined && (typeof slide.body !== 'string' || slide.body.length > 200)) {
    errors.push(`${label}.body는 200자 이하여야 합니다`);
  }
  if (slide.bullets !== undefined) {
    if (!Array.isArray(slide.bullets) || slide.bullets.length > 5 || slide.bullets.some((b) => typeof b !== 'string' || b.length > 80)) {
      errors.push(`${label}.bullets는 80자 이하 문자열 5개 이하여야 합니다`);
    }
  }
  return true;
}

export function validateGeneratedContent(
  content: unknown,
  snapshot: FactSnapshot,
): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(content)) {
    return { ok: false, errors: ['generated_content는 객체여야 합니다'] };
  }

  // ── schema ────────────────────────────────────────────────────────────
  for (const field of ['contentType', 'audience', 'hook', 'slides', 'caption', 'disclaimer', 'sourceLabel'] as const) {
    if (content[field] === undefined || content[field] === null) {
      errors.push(`필수 필드 누락: ${field}`);
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  if (typeof content.audience !== 'string' || content.audience.length > 100) {
    errors.push('audience는 100자 이하 문자열이어야 합니다');
  }
  if (typeof content.hook !== 'string' || content.hook.trim().length === 0 || content.hook.length > 60) {
    errors.push('hook은 1~60자여야 합니다');
  }
  if (!Array.isArray(content.slides) || content.slides.length < 3 || content.slides.length > 7) {
    errors.push('slides는 3~7개여야 합니다');
    return { ok: false, errors };
  }

  const slides = content.slides as unknown[];
  slides.forEach((slide, index) => validateSlide(slide, index, errors));

  const lastSlide = slides[slides.length - 1] as Record<string, unknown> | undefined;
  if (!lastSlide || lastSlide.type !== 'cta') {
    errors.push('마지막 슬라이드는 cta여야 합니다');
  } else if (slides.slice(0, -1).some((s) => isRecord(s) && s.type === 'cta')) {
    errors.push('cta 슬라이드는 마지막에 하나만 존재해야 합니다');
  }

  if (typeof content.caption !== 'string' || content.caption.trim().length === 0 || content.caption.length > 2200) {
    errors.push('caption은 1~2200자여야 합니다');
  }
  if (typeof content.disclaimer !== 'string' || content.disclaimer.trim().length === 0) {
    errors.push('disclaimer는 비어 있을 수 없습니다');
  }
  if (typeof content.sourceLabel !== 'string' || content.sourceLabel.trim().length === 0) {
    errors.push('sourceLabel은 비어 있을 수 없습니다');
  }
  if (
    !Array.isArray(content.hashtags) ||
    content.hashtags.length < 3 ||
    content.hashtags.length > 15 ||
    content.hashtags.some((h) => typeof h !== 'string' || h.length > 30)
  ) {
    errors.push('hashtags는 30자 이하 문자열 3~15개여야 합니다');
  }

  // ── prohibited phrases ────────────────────────────────────────────────
  const haystack = [
    content.hook,
    ...(content.slides as Record<string, unknown>[]).flatMap((s) => [s.headline as string, s.body as string, ...((s.bullets as string[]) ?? [])]),
    content.caption,
  ]
    .filter((v): v is string => typeof v === 'string')
    .join('\n');

  for (const phrase of PROHIBITED_PHRASES) {
    if (haystack.includes(phrase)) {
      errors.push(`금지 표현 사용: "${phrase}"`);
    }
  }

  // ── factual grounding against the fact snapshot ───────────────────────
  if (typeof content.caption === 'string') {
    // Every post must carry the source link (operating principle #2).
    if (snapshot.source_url && !(content.caption as string).includes(snapshot.source_url)) {
      errors.push('caption에 원본 공고 링크(source_url)가 포함되어야 합니다');
    }
  }

  // Amount claims must exactly match the snapshot amount — no invented or rounded figures.
  const mentionedAmounts = extractAmountsInText(haystack);
  if (mentionedAmounts.length > 0) {
    if (snapshot.funding_amount_krw === null) {
      errors.push('스냅샷에 금액 정보가 없는데 본문에 금액이 언급되었습니다');
    } else {
      for (const amount of mentionedAmounts) {
        if (Math.abs(amount - snapshot.funding_amount_krw) > 1) {
          errors.push(
            `본문 금액 ${formatKrw(amount)}이 스냅샷 금액 ${formatKrw(snapshot.funding_amount_krw)}과 일치하지 않습니다`,
          );
        }
      }
    }
  }

  // Deadline mentions must match the snapshot deadline.
  for (const dateMatch of Array.from(haystack.matchAll(/\d{4}[.\-]\d{1,2}[.\-]\d{1,2}/g))) {
    const normalized = dateMatch[0].replace(/[.]/g, '-').split('-').map((part) => part.padStart(2, '0')).join('-');
    const matchesSnapshot =
      normalized === snapshot.deadline_end ||
      normalized === snapshot.deadline_start;
    if (!matchesSnapshot) {
      errors.push(`본문 날짜 ${dateMatch[0]}이 스냅샷 마감/시작일과 일치하지 않습니다`);
    }
  }

  return { ok: errors.length === 0, errors };
}
