import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { parseBusinessPlanMarkdown } from './business-plan-markdown';

const TEMPLATE_DIR = path.join(process.cwd(), 'assets/templates/hwpx');

/**
 * Page setup (A4, standard margins) copied verbatim from a blank .hwpx produced by hwpxlib
 * (github.com/neolord0/hwpxlib) — every HWPX section's first paragraph must carry one of
 * these, and hand-deriving the schema from scratch risks a file real HWP viewers reject.
 * Content width is 42520 HWPUNIT (59528 page width − 8504×2 margins), reused below for
 * every `hp:lineseg horzsize`.
 */
const SEC_PR_XML =
  '<hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" tabStopVal="4000" tabStopUnit="HWPUNIT" outlineShapeIDRef="1" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0"><hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0"/><hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/><hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/><hp:lineNumberShape restartType="0" countBy="0" distance="0" startNumber="0"/><hp:pagePr landscape="WIDELY" width="59528" height="84188" gutterType="LEFT_ONLY"><hp:margin header="4252" footer="4252" gutter="0" left="8504" right="8504" top="5668" bottom="4252"/></hp:pagePr><hp:footNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="-1" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="283" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="EACH_COLUMN" beneathText="0"/></hp:footNotePr><hp:endNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="14692344" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="0" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="END_OF_DOCUMENT" beneathText="0"/></hp:endNotePr><hp:pageBorderFill type="BOTH" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill><hp:pageBorderFill type="EVEN" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill><hp:pageBorderFill type="ODD" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill></hp:secPr><hp:ctrl><hp:colPr id="" type="NEWSPAPER" layout="LEFT" colCount="1" sameSz="1" sameGap="0"/></hp:ctrl>';

const CONTENT_WIDTH_HWPUNIT = 42520;

// paraPrIDRef / charPrIDRef values, matching assets/templates/hwpx/Contents/header.xml.
const PARA_PR = { title: 16, meta: 16, heading: 12, body: 3, bullet: 11, blank: 0 } as const;
const CHAR_PR = { title: 8, meta: 9, heading: 7, body: 0 } as const;

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'long' }).format(value);
}

class ParagraphBuilder {
  private vertpos = 0;
  private xml: string[] = [];

  private lineseg(height: number): string {
    const seg = `<hp:lineseg textpos="0" vertpos="${this.vertpos}" vertsize="${height}" textheight="${height}" baseline="${Math.round(height * 0.85)}" spacing="600" horzpos="0" horzsize="${CONTENT_WIDTH_HWPUNIT}" flags="393216"/>`;
    this.vertpos += Math.round(height * 1.6);
    return seg;
  }

  /** The very first paragraph of the section — carries page setup and the document title. */
  addTitle(text: string): void {
    const height = 2000;
    this.xml.push(
      `<hp:p id="2764991984" paraPrIDRef="${PARA_PR.title}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">` +
        `<hp:run charPrIDRef="${CHAR_PR.title}">${SEC_PR_XML}<hp:t>${escapeXml(text)}</hp:t></hp:run>` +
        `<hp:linesegarray>${this.lineseg(height)}</hp:linesegarray></hp:p>`,
    );
  }

  private addTextParagraph(paraPrIDRef: number, charPrIDRef: number, height: number, text: string): void {
    this.xml.push(
      `<hp:p id="2147483648" paraPrIDRef="${paraPrIDRef}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">` +
        `<hp:run charPrIDRef="${charPrIDRef}"><hp:t>${escapeXml(text)}</hp:t></hp:run>` +
        `<hp:linesegarray>${this.lineseg(height)}</hp:linesegarray></hp:p>`,
    );
  }

  addMeta(text: string): void {
    this.addTextParagraph(PARA_PR.meta, CHAR_PR.meta, 1000, text);
  }

  addHeading(text: string): void {
    this.addTextParagraph(PARA_PR.heading, CHAR_PR.heading, 1300, text);
  }

  addBody(text: string): void {
    this.addTextParagraph(PARA_PR.body, CHAR_PR.body, 1000, text);
  }

  addBullet(text: string): void {
    this.addTextParagraph(PARA_PR.bullet, CHAR_PR.body, 1000, `• ${text}`);
  }

  addBlank(): void {
    const height = 1000;
    this.xml.push(
      `<hp:p id="2147483648" paraPrIDRef="${PARA_PR.blank}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">` +
        `<hp:run charPrIDRef="${CHAR_PR.body}"/>` +
        `<hp:linesegarray>${this.lineseg(height)}</hp:linesegarray></hp:p>`,
    );
  }

  toString(): string {
    return this.xml.join('');
  }
}

const SECTION_NS =
  'xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hp10="http://www.hancom.co.kr/hwpml/2016/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hhs="http://www.hancom.co.kr/hwpml/2011/history" xmlns:hm="http://www.hancom.co.kr/hwpml/2011/master-page" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf/" xmlns:ooxmlchart="http://www.hancom.co.kr/hwpml/2016/ooxmlchart" xmlns:hwpunitchar="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar" xmlns:epub="http://www.idpf.org/2007/ops" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0"';

export interface BusinessPlanHwpxInput {
  companyName: string;
  programTitle: string;
  agency: string;
  generatedAt: Date;
  markdown: string;
}

function buildSection0Xml(input: BusinessPlanHwpxInput): string {
  const blocks = parseBusinessPlanMarkdown(input.markdown);
  const builder = new ParagraphBuilder();

  builder.addTitle('사업계획서');
  builder.addMeta(`${input.programTitle} · ${input.agency} · ${input.companyName} · ${formatDate(input.generatedAt)} 작성`);

  for (const block of blocks) {
    if (block.type === 'heading') {
      builder.addBlank();
      builder.addHeading(block.text);
    } else if (block.type === 'bullet') {
      builder.addBullet(block.text);
    } else {
      builder.addBody(block.text);
    }
  }

  builder.addBlank();
  builder.addBody('이 문서는 AI가 생성한 초안입니다. 제출 전 반드시 실제 공고문의 요구사항과 대조해서 검토해주세요.');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><hs:sec ${SECTION_NS}>${builder.toString()}</hs:sec>`;
}

/**
 * Renders the AI-generated 사업계획서 markdown into a .hwpx (HWPX 5.x / OWPML) file.
 * Everything except Contents/section0.xml is a static template shipped under
 * assets/templates/hwpx/ (derived from a blank file produced by hwpxlib, the reference
 * open-source HWPX implementation) — section0.xml is the only part that varies per document,
 * so it's built fresh from the parsed markdown on every request.
 */
export async function renderBusinessPlanHwpx(input: BusinessPlanHwpxInput): Promise<Buffer> {
  const [mimetype, version, settings, containerXml, manifestXml, headerXml, contentHpf] = await Promise.all([
    readFile(path.join(TEMPLATE_DIR, 'mimetype')),
    readFile(path.join(TEMPLATE_DIR, 'version.xml')),
    readFile(path.join(TEMPLATE_DIR, 'settings.xml')),
    readFile(path.join(TEMPLATE_DIR, 'META-INF/container.xml')),
    readFile(path.join(TEMPLATE_DIR, 'META-INF/manifest.xml')),
    readFile(path.join(TEMPLATE_DIR, 'Contents/header.xml')),
    readFile(path.join(TEMPLATE_DIR, 'Contents/content.hpf')),
  ]);

  const section0Xml = buildSection0Xml(input);

  const zipped = zipSync(
    {
      mimetype: new Uint8Array(mimetype),
      'version.xml': new Uint8Array(version),
      'settings.xml': new Uint8Array(settings),
      'META-INF/container.xml': new Uint8Array(containerXml),
      'META-INF/manifest.xml': new Uint8Array(manifestXml),
      'Contents/header.xml': new Uint8Array(headerXml),
      'Contents/content.hpf': new Uint8Array(contentHpf),
      'Contents/section0.xml': strToU8(section0Xml),
    },
    { level: 6 },
  );

  return Buffer.from(zipped);
}
