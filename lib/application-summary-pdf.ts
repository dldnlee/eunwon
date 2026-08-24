import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFPage, PDFFont, rgb } from 'pdf-lib';
import type { ApplicationSummarySnapshot } from './application-summary';

const PAGE = { width: 595.28, height: 841.89, margin: 48 };
const STATUS: Record<string, string> = {
  considering: '검토 중', preparing: '신청 준비', submitted: '신청 완료', screening: '심사 중',
  interview: '면접 예정', selected: '선정', rejected: '미선정', withdrawn: '진행 중단',
};

function date(value: string | null): string {
  if (!value) return '확인 필요';
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium' }).format(new Date(value));
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const result: string[] = [];
  for (const paragraph of text.replace(/\r/g, '').split('\n')) {
    if (!paragraph) { result.push(''); continue; }
    let line = '';
    for (const character of paragraph) {
      const candidate = line + character;
      if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        result.push(line);
        line = character;
      } else line = candidate;
    }
    if (line) result.push(line);
  }
  return result;
}

export async function renderApplicationSummaryPdf(snapshot: ApplicationSummarySnapshot, fontBytes: Uint8Array) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(fontBytes, { subset: true });
  pdf.setTitle(`${snapshot.program.title} 신청 요약`);
  pdf.setSubject(`eunwon 신청 요약 · ${snapshot.templateVersion}`);
  pdf.setCreator('eunwon');
  pdf.setProducer('eunwon');

  let page: PDFPage = pdf.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - PAGE.margin;
  const ink = rgb(0.08, 0.09, 0.1);
  const muted = rgb(0.35, 0.38, 0.42);
  const rule = rgb(0.87, 0.88, 0.89);

  const ensure = (height: number) => {
    if (y - height >= PAGE.margin) return;
    page = pdf.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - PAGE.margin;
  };
  const text = (value: string, size = 9, color = ink, indent = 0) => {
    const lines = wrap(value, font, size, PAGE.width - PAGE.margin * 2 - indent);
    for (const line of lines) {
      ensure(size + 4);
      page.drawText(line, { x: PAGE.margin + indent, y, size, font, color });
      y -= size + 4;
    }
  };
  const heading = (value: string) => {
    ensure(36);
    y -= 9;
    page.drawLine({ start: { x: PAGE.margin, y }, end: { x: PAGE.width - PAGE.margin, y }, thickness: 0.7, color: rule });
    y -= 19;
    text(value, 13, ink);
    y -= 3;
  };

  text('eunwon · 신청 요약', 10, muted);
  y -= 8;
  text(snapshot.program.title, 20, ink);
  y -= 3;
  text(`${snapshot.program.agency}  ·  마감 ${date(snapshot.program.deadline_end)}`, 10, muted);
  text(`생성 ${date(snapshot.generatedAt)}  ·  서식 ${snapshot.templateVersion}`, 8, muted);

  heading('진행 현황');
  text(`현재 상태: ${STATUS[snapshot.application.status] ?? snapshot.application.status}`);
  text(`다음 할 일: ${snapshot.application.nextAction || '아직 정하지 않았어요.'}`);
  text(`목표일: ${date(snapshot.application.nextActionDueAt)}`);
  if (snapshot.application.submittedAt) text(`신청 완료일: ${date(snapshot.application.submittedAt)}`);
  if (snapshot.application.outcome) text(`결과: ${snapshot.application.outcome}`);

  heading(`준비 목록 (${snapshot.checklist.filter((item) => item.completed).length}/${snapshot.checklist.length})`);
  if (!snapshot.checklist.length) text('아직 준비 목록이 없어요.', 9, muted);
  for (const item of snapshot.checklist) {
    const provenance = item.verification === 'verified' ? '원문 확인' : item.verification === 'inferred' ? '해석 포함' : '직접 추가';
    text(`${item.completed ? '✓' : '□'} ${item.label}  [${provenance}]`);
    if (item.evidenceQuote) text(`근거: “${item.evidenceQuote}”`, 8, muted, 12);
    if (item.sourceTitle || item.sourceUrl) text(`출처: ${item.sourceTitle ?? '공고 원문'}${item.sourceUrl ? ` · ${item.sourceUrl}` : ''}`, 7, muted, 12);
    y -= 3;
  }

  heading('내 사업정보와 자격 조건 비교');
  if (snapshot.eligibility.status === 'unavailable') text('구조화된 자격 근거가 없어 공고 원문 확인이 필요해요.', 9, muted);
  for (const item of snapshot.eligibility.items) {
    const state = item.status === 'met' ? '맞음' : item.status === 'not_met' ? '다름' : '확인 필요';
    const provenance = item.verification === 'verified' ? '원문 확인' : '해석 포함';
    text(`• [${state} · ${provenance}] ${item.requirement}`);
    text(item.reason, 8, muted, 12);
    if (item.evidenceQuote) text(`근거: “${item.evidenceQuote}”`, 8, muted, 12);
    if (item.sourceTitle || item.sourceUrl) text(`출처: ${item.sourceTitle ?? '공고 원문'}${item.sourceUrl ? ` · ${item.sourceUrl}` : ''}`, 7, muted, 12);
    y -= 3;
  }

  heading('메모와 링크');
  text(snapshot.application.notes || '저장된 메모가 없어요.', 9, snapshot.application.notes ? ink : muted);
  if (snapshot.program.apply_url) text(`신청 링크: ${snapshot.program.apply_url}`, 8, muted);
  if (snapshot.program.detail_url) text(`공고 원문: ${snapshot.program.detail_url}`, 8, muted);
  y -= 10;
  text('이 문서는 준비를 돕는 요약이며, 신청 자격이나 선정 가능성을 보장하지 않습니다. 반드시 최신 공고 원문과 담당기관 안내를 확인하세요.', 8, muted);

  return pdf.save();
}
