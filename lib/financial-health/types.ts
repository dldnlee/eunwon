export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_STATEMENT_TEXT = 40_000;
export const MONEY_UNITS = { KRW: '원', KRW_THOUSAND: '천원', KRW_MILLION: '백만원' } as const;
export type MoneyUnit = keyof typeof MONEY_UNITS;

export const FINANCIAL_FIELDS = [
  { key: 'assets', label: '자산총계', required: true, signed: false, group: '재무상태표' },
  { key: 'liabilities', label: '부채총계', required: true, signed: false, group: '재무상태표' },
  { key: 'equity', label: '자본총계', required: true, signed: true, group: '재무상태표' },
  { key: 'currentAssets', label: '유동자산', required: false, signed: false, group: '재무상태표' },
  { key: 'currentLiabilities', label: '유동부채', required: false, signed: false, group: '재무상태표' },
  { key: 'cash', label: '현금및현금성자산', required: false, signed: false, group: '재무상태표' },
  { key: 'shortTermBorrowings', label: '단기차입금', required: false, signed: false, group: '재무상태표' },
  { key: 'revenue', label: '매출액', required: true, signed: false, group: '손익·현금흐름' },
  { key: 'operatingProfit', label: '영업이익', required: true, signed: true, group: '손익·현금흐름' },
  { key: 'netProfit', label: '당기순이익', required: false, signed: true, group: '손익·현금흐름' },
  { key: 'interestExpense', label: '이자비용', required: false, signed: false, group: '손익·현금흐름' },
  { key: 'operatingCashFlow', label: '영업활동현금흐름', required: false, signed: true, group: '손익·현금흐름' },
  { key: 'previousRevenue', label: '직전 연도 매출액', required: false, signed: false, group: '손익·현금흐름' },
] as const;
export type FinancialField = (typeof FINANCIAL_FIELDS)[number]['key'];

/** Amounts are in the explicitly selected unit, never inferred from magnitude. */
export type FinancialStatement = Record<FinancialField, number | null> & {
  companyName: string;
  fiscalYear: number | null;
  unit: MoneyUnit | null;
};

export function emptyStatement(companyName = ''): FinancialStatement {
  return {
    companyName, fiscalYear: null, unit: null,
    ...Object.fromEntries(FINANCIAL_FIELDS.map(({ key }) => [key, null])),
  } as FinancialStatement;
}

export const METRIC_IDS = ['debtRatio', 'equityRatio', 'currentRatio', 'operatingMargin', 'interestCoverage', 'cashFlowMargin', 'revenueGrowth'] as const;
export type MetricId = (typeof METRIC_IDS)[number];
export interface FinancialMetric {
  id: MetricId;
  label: string;
  value: number | null;
  unit: '%' | '배';
  formula: string;
  note: string;
}

export interface FinancialPlan {
  summary: string;
  strengths: string[];
  risks: string[];
  actions: {
    timeframe: '30일' | '60일' | '90일';
    title: string;
    rationale: string;
    steps: string[];
    metricIds: MetricId[];
    successMeasure: string;
  }[];
  documents: string[];
  limitations: string[];
}

export interface FinancialReport {
  statement: FinancialStatement;
  metrics: FinancialMetric[];
  warnings: string[];
  plan: FinancialPlan;
  generatedAt: string;
  disclaimer: string;
  sources: { title: string; url: string }[];
}

export interface ExtractionResult {
  statement: FinancialStatement;
  warnings: string[];
}

export const FINANCIAL_DISCLAIMER = '재무제표에 기반한 AI 참고 분석이며 공식 신용등급 평가가 아닙니다. 등급 상승을 보장하지 않으며, 실제 평가는 업종·연체·납세·거래 이력 등 비재무 정보도 반영합니다. 실행 전 담당 회계사 또는 금융기관과 검토하세요.';
export const FINANCIAL_SOURCES = [
  { title: 'NICE평가정보 기업평가 요소 및 반영 기간', url: 'https://www.niceinfo.co.kr/creditrating/bi_score_1_3.nice' },
  { title: '한국신용평가 신용평가 분석 체계', url: 'https://www.kisrating.com/business/creditrating.do' },
];
