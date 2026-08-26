import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBusinessPlanMarkdown } from './business-plan-markdown';

test('splits headings, paragraphs, and bullets into distinct blocks', () => {
  const blocks = parseBusinessPlanMarkdown(`## 사업 개요

그린테크 주식회사는 IT 업종의 벤처기업입니다.

## 신청 배경

- 매출 성장률 35% 달성
- 특허 3건 보유
`);

  assert.deepEqual(blocks, [
    { type: 'heading', text: '사업 개요' },
    { type: 'paragraph', text: '그린테크 주식회사는 IT 업종의 벤처기업입니다.' },
    { type: 'heading', text: '신청 배경' },
    { type: 'bullet', text: '매출 성장률 35% 달성' },
    { type: 'bullet', text: '특허 3건 보유' },
  ]);
});

test('joins wrapped lines within a paragraph and strips inline emphasis', () => {
  const blocks = parseBusinessPlanMarkdown(
    '이 문장은\n두 줄에 걸쳐 있고 **강조된** 부분이 있습니다.',
  );

  assert.deepEqual(blocks, [
    { type: 'paragraph', text: '이 문장은 두 줄에 걸쳐 있고 강조된 부분이 있습니다.' },
  ]);
});

test('supports * bullets alongside - bullets and ignores blank lines', () => {
  const blocks = parseBusinessPlanMarkdown('\n\n* 항목 1\n\n- 항목 2\n\n\n');

  assert.deepEqual(blocks, [
    { type: 'bullet', text: '항목 1' },
    { type: 'bullet', text: '항목 2' },
  ]);
});

test('empty input yields no blocks', () => {
  assert.deepEqual(parseBusinessPlanMarkdown('   \n\n  '), []);
});
