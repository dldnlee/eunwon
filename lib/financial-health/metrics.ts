import type { FinancialMetric, FinancialStatement, MetricId } from './types';

/** Ratios use the same reporting unit on both sides; the AI never computes them. */
export function calculateMetrics(s: FinancialStatement): FinancialMetric[] {
  function ratio(id: MetricId, label: string, numerator: number | null, denominator: number | null, formula: string, unit: '%' | '배' = '%'): FinancialMetric {
    let note = '업종·규모·추세와 함께 판단해야 하며, 이 수치만으로 신용등급을 정할 수 없습니다.';
    let value: number | null = null;
    if (numerator === null || denominator === null) note = '필요한 자료가 없어 계산하지 않았습니다.';
    else if (denominator <= 0) note = '분모가 0 이하이므로 의미 있는 비율을 계산할 수 없습니다.';
    else {
      const result = numerator / denominator * (unit === '%' ? 100 : 1);
      if (Number.isFinite(result) && Math.abs(result) <= 1e9) value = Math.round(result * 100) / 100;
      else note = '비율이 해석 가능한 범위를 벗어났습니다. 입력값과 단위를 재확인하세요.';
    }
    return { id, label, value, unit, formula, note };
  }
  return [
    ratio('debtRatio', '부채비율', s.liabilities, s.equity, '부채총계 ÷ 자본총계 × 100'),
    ratio('equityRatio', '자기자본비율', s.equity, s.assets, '자본총계 ÷ 자산총계 × 100'),
    ratio('currentRatio', '유동비율', s.currentAssets, s.currentLiabilities, '유동자산 ÷ 유동부채 × 100'),
    ratio('operatingMargin', '영업이익률', s.operatingProfit, s.revenue, '영업이익 ÷ 매출액 × 100'),
    ratio('interestCoverage', '이자보상배율', s.operatingProfit, s.interestExpense, '영업이익 ÷ 이자비용', '배'),
    ratio('cashFlowMargin', '영업현금흐름률', s.operatingCashFlow, s.revenue, '영업활동현금흐름 ÷ 매출액 × 100'),
    ratio('revenueGrowth', '매출액 증가율', s.revenue !== null && s.previousRevenue !== null ? s.revenue - s.previousRevenue : null, s.previousRevenue, '(매출액 − 직전 연도 매출액) ÷ 직전 연도 매출액 × 100'),
  ];
}
