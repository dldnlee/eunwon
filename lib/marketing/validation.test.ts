import test from 'node:test';
import assert from 'node:assert/strict';
import { extractAmountsInText, formatKrw, PROHIBITED_PHRASES, validateGeneratedContent } from './validation';
import type { FactSnapshot, GeneratedContent } from './types';

const snapshot: FactSnapshot = {
  program_id: 'p1',
  title: '초기 스타트업 지원',
  agency: '서울시',
  source_url: 'https://detail.example.com/1',
  eligible_regions: ['서울'],
  is_nationwide: false,
  entity_types: ['법인'],
  business_age_constraint: '최대 36개월',
  benefit_text: '융자 · 기업당 최대 50,000,000원',
  funding_amount_krw: 50_000_000,
  deadline_start: '2026-08-01',
  deadline_end: '2026-09-05',
  application_url: 'https://apply.example.com',
  retrieved_at: '2026-08-25T00:00:00Z',
};

function content(overrides: Partial<GeneratedContent> = {}): GeneratedContent {
  return {
    contentType: 'program_spotlight',
    audience: '서울 소재 창업 3년 이내 기업',
    hook: '서울 초기 스타트업이라면 확인하세요',
    slides: [
      { type: 'hook', headline: '놓치기 쉬운 지원사업', body: '서울 창업 3년 이내라면 대상일 수 있어요' },
      { type: 'eligibility', headline: '지원 대상', bullets: ['서울 소재 법인', '설립 3년 이내'] },
      { type: 'benefit', headline: '지원 내용', body: `기업당 최대 ${formatKrw(50_000_000)} 규모` },
      { type: 'cta', headline: '우리 회사도 해당될까요?', body: '무료 진단으로 확인해보세요' },
    ],
    caption: `서울 초기 스타트업 지원사업입니다. 원문: ${snapshot.source_url}`,
    disclaimer: '최종 신청 자격은 공식 공고를 확인해주세요.',
    sourceLabel: '서울시 공고',
    hashtags: ['정부지원사업', '스타트업', '창업지원금'],
    ...overrides,
  };
}

test('a well-formed draft passes validation', () => {
  const result = validateGeneratedContent(content(), snapshot);
  assert.equal(result.ok, true, result.errors.join('; '));
});

test('missing required fields fail schema checks', () => {
  const broken = { hook: 'x' };
  const result = validateGeneratedContent(broken, snapshot);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes('필수 필드 누락')));
});

test('the last slide must be the only cta', () => {
  assert.ok(
    validateGeneratedContent(
      content({ slides: [content().slides[0], content().slides[0], content().slides[0]] }),
      snapshot,
    ).errors.some((e) => e.includes('마지막 슬라이드는 cta')),
  );
  const doubleCta = content();
  doubleCta.slides[1] = { type: 'cta', headline: '중간 cta' };
  assert.ok(validateGeneratedContent(doubleCta, snapshot).errors.some((e) => e.includes('하나만 존재')));
});

test('prohibited phrases are rejected', () => {
  for (const phrase of PROHIBITED_PHRASES) {
    const draft = content({ caption: `${phrase} 지원사업 ${snapshot.source_url}` });
    assert.ok(validateGeneratedContent(draft, snapshot).errors.some((e) => e.includes('금지 표현')), phrase);
  }
});

test('caption must include the source link', () => {
  const noLink = content({ caption: '링크 없는 캡션' });
  assert.ok(validateGeneratedContent(noLink, snapshot).errors.some((e) => e.includes('원본 공고 링크')));
});

test('amount claims must match the snapshot exactly', () => {
  assert.ok(validateGeneratedContent(content({ slides: [
    { type: 'hook', headline: 'h' }, { type: 'eligibility', headline: 'e' },
    { type: 'benefit', headline: '지원 내용', body: '기업당 최대 3천만원' },
    { type: 'cta', headline: 'c' },
  ] }), snapshot).errors.some((e) => e.includes('스냅샷 금액')));

  // 억원/만원 conversions of the exact amount are accepted
  const ok = validateGeneratedContent(content({
    slides: [
      { type: 'hook', headline: 'h' }, { type: 'eligibility', headline: 'e' },
      { type: 'benefit', headline: '지원 내용', body: '기업당 최대 5,000만원' },
      { type: 'cta', headline: 'c' },
    ],
  }), snapshot);
  assert.equal(ok.ok, true, ok.errors.join('; '));
});

test('invented amounts are rejected when the snapshot has none', () => {
  const emptySnapshot = { ...snapshot, funding_amount_krw: null, benefit_text: null };
  const draft = content({ slides: [
    { type: 'hook', headline: 'h' }, { type: 'eligibility', headline: 'e' },
    { type: 'benefit', headline: '지원 내용', body: '기업당 최대 5,000만원' },
    { type: 'cta', headline: 'c' },
  ] });
  assert.ok(validateGeneratedContent(draft, emptySnapshot).errors.some((e) => e.includes('금액 정보가 없는데')));
});

test('dates in copy must match snapshot dates', () => {
  const wrongDate = content({ caption: `2026.10.01 마감입니다. 원문: ${snapshot.source_url}` });
  assert.ok(validateGeneratedContent(wrongDate, snapshot).errors.some((e) => e.includes('스냅샷 마감/시작일과 일치하지 않습니다')));

  const okDate = content({ caption: `2026-09-05 마감. 원문: ${snapshot.source_url}` });
  const result = validateGeneratedContent(okDate, snapshot);
  assert.equal(result.ok, true, result.errors.join('; '));
});

test('amount extraction handles 만원, 억원, and raw won', () => {
  assert.deepEqual(extractAmountsInText('최대 5,000만원'), [50_000_000]);
  assert.deepEqual(extractAmountsInText('2억원'), [200_000_000]);
  assert.deepEqual(extractAmountsInText('50,000,000원'), [50_000_000]);
});
