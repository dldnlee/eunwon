import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import { parseBusinessPlanMarkdown } from './business-plan-markdown';

const FONT = '맑은 고딕';

export interface BusinessPlanDocInput {
  companyName: string;
  programTitle: string;
  agency: string;
  generatedAt: Date;
  markdown: string;
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'long' }).format(value);
}

/**
 * Renders the AI-generated 사업계획서 markdown into a formatted .docx, built programmatically
 * with the `docx` package (per docs/eunwon-master.md's export plan) rather than filled into a
 * pre-made .docx file — the `docx` API has no facility for loading an existing template.
 */
export async function renderBusinessPlanDocx(input: BusinessPlanDocInput): Promise<Buffer> {
  const blocks = parseBusinessPlanMarkdown(input.markdown);

  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: '사업계획서', font: FONT, size: 40, bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({ text: input.programTitle, font: FONT, size: 24, bold: true }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'D9D9D9', space: 8 } },
      children: [
        new TextRun({
          text: `${input.agency}  ·  ${input.companyName}  ·  ${formatDate(input.generatedAt)} 작성`,
          font: FONT,
          size: 18,
          color: '5F5F5F',
        }),
      ],
    }),
  ];

  for (const block of blocks) {
    if (block.type === 'heading') {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 320, after: 120 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '12203D', space: 4 } },
          children: [new TextRun({ text: block.text, font: FONT, size: 26, bold: true, color: '12203D' })],
        }),
      );
    } else if (block.type === 'bullet') {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 80 },
          alignment: AlignmentType.BOTH,
          children: [new TextRun({ text: block.text, font: FONT, size: 21 })],
        }),
      );
    } else {
      children.push(
        new Paragraph({
          spacing: { after: 160, line: 360 },
          alignment: AlignmentType.BOTH,
          children: [new TextRun({ text: block.text, font: FONT, size: 21 })],
        }),
      );
    }
  }

  children.push(
    new Paragraph({
      spacing: { before: 400 },
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'D9D9D9', space: 8 } },
      children: [
        new TextRun({
          text: '이 문서는 AI가 생성한 초안입니다. 제출 전 반드시 실제 공고문의 요구사항과 대조해서 검토해주세요.',
          font: FONT,
          size: 16,
          color: '8E8E93',
          italics: true,
        }),
      ],
    }),
  );

  const doc = new Document({
    creator: 'eunwon',
    title: `${input.programTitle} 사업계획서`,
    description: `eunwon에서 생성한 ${input.programTitle} 사업계획서 초안`,
    styles: { default: { document: { run: { font: FONT, size: 21 } } } },
    sections: [{ properties: {}, children }],
  });

  return Packer.toBuffer(doc);
}
