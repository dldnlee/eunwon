import { emptyStatement, type FinancialPlan, type FinancialStatement } from './types';

/** Synthetic company for regression tests; contains no customer data. */
export const sampleStatement: FinancialStatement = {
  ...emptyStatement('가상 제조기업'), fiscalYear: 2025, unit: 'KRW_MILLION',
  assets: 1000, liabilities: 700, equity: 300, currentAssets: 400,
  currentLiabilities: 500, cash: 80, shortTermBorrowings: 300,
  revenue: 1500, operatingProfit: 90, netProfit: 45, interestExpense: 60,
  operatingCashFlow: -30, previousRevenue: 1200,
};

export const samplePlan: FinancialPlan = {
  summary: '영업이익이 있지만 현금 유출과 단기 만기를 함께 점검해야 합니다.',
  strengths: ['영업이익이 양수입니다.'], risks: ['영업활동현금흐름이 음수입니다.'],
  actions: [
    { timeframe: '30일', title: '현금 수지 확인', rationale: '영업 현금 유출 확인', steps: ['매출채권 회수 일정과 지급 일정을 작성합니다.'], metricIds: ['cashFlowMargin'], successMeasure: '주간 현금계획 작성 완료' },
    { timeframe: '60일', title: '차입 만기 점검', rationale: '단기차입금 만기 확인 필요', steps: ['금융기관과 차입 만기를 검토합니다.'], metricIds: ['currentRatio'], successMeasure: '만기별 차입금 명세서 완성' },
    { timeframe: '90일', title: '재무자료 갱신', rationale: '최근 자료로 개선 여부 점검', steps: ['담당 회계사와 분기 결산을 검토합니다.'], metricIds: ['operatingMargin'], successMeasure: '후속 검토 및 증빙 준비 완료' },
  ],
  documents: ['차입금 만기 명세서', '납세증명서'],
  limitations: ['연체 이력과 업종을 확인하지 않았습니다.'],
};
