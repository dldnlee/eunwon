import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { renderBusinessPlanDocx } from '../lib/business-plan-docx';
import { renderBusinessPlanHwpx } from '../lib/business-plan-hwpx';

const sample = {
  companyName: '그린테크 주식회사',
  programTitle: '2026년 혁신형 중소기업 사업화 지원사업',
  agency: '중소벤처기업부',
  generatedAt: new Date('2026-08-25T09:00:00.000Z'),
  markdown: `## 사업 개요

그린테크 주식회사는 IT/소프트웨어 업종의 벤처기업으로, 친환경 에너지 관리 솔루션을 개발하고 있습니다. 본 사업계획서는 2026년 혁신형 중소기업 사업화 지원사업 신청을 위해 작성되었습니다.

## 신청 배경

- 최근 2개년 연평균 매출 성장률 35% 달성
- 자체 R&D 조직을 통한 특허 3건 보유
- 기존 사업화 자금 부족으로 양산 단계 진입에 어려움을 겪고 있음

## 추진 계획

1단계로 시제품 고도화를 진행하고, 2단계로 파일럿 고객사 3곳을 대상으로 실증을 거쳐, 3단계에서 양산 체계를 구축할 계획입니다.

- 1분기: 시제품 고도화 및 품질 인증 획득
- 2~3분기: 파일럿 실증 및 고객 피드백 반영
- 4분기: 양산 체계 구축 및 초도 물량 생산

## 기대 효과

본 사업을 통해 매출 확대뿐 아니라 국내 친환경 에너지 관리 시장에서의 기술 경쟁력을 확보하고, 관련 분야 고용 창출에도 기여할 것으로 기대됩니다.`,
};

async function main() {
  const root = process.cwd();
  const [docx, hwpx] = await Promise.all([
    renderBusinessPlanDocx(sample),
    renderBusinessPlanHwpx(sample),
  ]);

  const docxDir = path.join(root, 'output/docx');
  const hwpxDir = path.join(root, 'output/hwpx');
  await mkdir(docxDir, { recursive: true });
  await mkdir(hwpxDir, { recursive: true });
  await writeFile(path.join(docxDir, 'business-plan-sample.docx'), docx);
  await writeFile(path.join(hwpxDir, 'business-plan-sample.hwpx'), hwpx);
  console.log('wrote output/docx/business-plan-sample.docx and output/hwpx/business-plan-sample.hwpx');
}

void main();
