import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildApplicationSummarySnapshot } from '../lib/application-summary';
import { renderApplicationSummaryPdf } from '../lib/application-summary-pdf';
import type { Program } from '../lib/types';

const program = {
  id: '00000000-0000-4000-8000-000000000016', title: '2026년 혁신형 중소기업 사업화 지원사업',
  agency: '중소벤처기업부', deadline_end: '2026-09-30', apply_url: 'https://example.go.kr/apply',
  detail_url: 'https://example.go.kr/program/16',
} as Program;

const snapshot = buildApplicationSummarySnapshot({
  generatedAt: '2026-08-25T09:00:00.000Z', program,
  saved: { status: 'preparing', notes: '담당자와 제출 전 최종 검토 예정. 재무제표의 기준연도를 확인할 것.',
    outcome: null, submittedAt: null, nextAction: '사업계획서 초안 검토', nextActionDueAt: '2026-09-10' },
  checklist: [
    { label: '사업자등록증 사본', completed: true, verification: 'verified', confidence: 0.99,
      evidenceQuote: '사업자등록증 사본 1부를 제출하여야 한다.', sourceTitle: '통합공고문 PDF', sourceUrl: 'https://example.go.kr/notice.pdf' },
    { label: '최근 2개년 재무제표', completed: false, verification: 'inferred', confidence: 0.71,
      evidenceQuote: '재무현황을 확인할 수 있는 자료', sourceTitle: '붙임 신청안내', sourceUrl: 'https://example.go.kr/guide.pdf' },
    { label: '담당자 연락처 확인', completed: false, verification: 'user', confidence: null,
      evidenceQuote: null, sourceTitle: null, sourceUrl: null },
  ],
  eligibility: { status: 'available', counts: { met: 1, notMet: 0, unknown: 1 }, items: [
    { id: 'r1', requirement: '서울 소재 중소기업', status: 'met', reason: '사업장 지역을 공고 조건과 비교했어요.',
      profileField: 'region', profileIssue: null, verification: 'verified', confidence: 0.98,
      evidenceQuote: '공고일 기준 서울특별시에 소재한 중소기업', sourceTitle: '통합공고문 PDF', sourceUrl: 'https://example.go.kr/notice.pdf' },
    { id: 'r2', requirement: '기술사업화 역량을 갖춘 기업', status: 'unknown', reason: '구조화된 기준을 자동으로 비교할 수 없어 원문 확인이 필요해요.',
      profileField: null, profileIssue: null, verification: 'inferred', confidence: 0.62,
      evidenceQuote: '기술사업화 역량을 보유한 기업을 우대할 수 있음', sourceTitle: '붙임 신청안내', sourceUrl: 'https://example.go.kr/guide.pdf' },
  ] },
});

async function main() {
  const root = process.cwd();
  const font = await readFile(path.join(root, 'assets/fonts/NanumGothic-Regular.ttf'));
  const pdf = await renderApplicationSummaryPdf(snapshot, font);
  const output = path.join(root, 'output/pdf');
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, 'application-summary-sample.pdf'), pdf);
}

void main();
