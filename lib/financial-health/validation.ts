import { z } from 'zod';
import { emptyStatement, FINANCIAL_FIELDS, type FinancialStatement } from './types';

const amount = z.number().finite().min(-1e15).max(1e15).nullable();
export const statementSchema = z.object({
  companyName: z.string().trim().max(120),
  fiscalYear: z.number().int().min(1900).max(2100).nullable(),
  unit: z.enum(['KRW', 'KRW_THOUSAND', 'KRW_MILLION']).nullable(),
  assets: amount, liabilities: amount, equity: amount,
  currentAssets: amount, currentLiabilities: amount, cash: amount, shortTermBorrowings: amount,
  revenue: amount, operatingProfit: amount, netProfit: amount, interestExpense: amount,
  operatingCashFlow: amount, previousRevenue: amount,
}).strict();

export function validateStatement(input: unknown): {
  statement: FinancialStatement;
  fieldErrors: Record<string, string>;
  warnings: string[];
} {
  const parsed = statementSchema.safeParse(input);
  const fieldErrors: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0] ?? 'form')] = '올바른 숫자 또는 값을 입력해주세요.';
    }
    return { statement: emptyStatement(), fieldErrors, warnings: [] };
  }
  const statement = parsed.data;
  const warnings: string[] = [];
  if (!statement.companyName) fieldErrors.companyName = '회사명을 입력해주세요.';
  if (!statement.fiscalYear || statement.fiscalYear > Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Seoul' }).format(new Date()))) {
    fieldErrors.fiscalYear = '재무제표의 결산 연도를 확인해주세요. 미래 연도는 분석할 수 없습니다.';
  }
  if (!statement.unit) fieldErrors.unit = '재무제표에 표시된 금액 단위를 선택해주세요.';

  const multiplier = statement.unit === 'KRW_MILLION' ? 1_000_000 : statement.unit === 'KRW_THOUSAND' ? 1_000 : 1;
  for (const field of FINANCIAL_FIELDS) {
    const value = statement[field.key];
    if (field.required && value === null) fieldErrors[field.key] = `${field.label}을(를) 입력해주세요.`;
    if (value !== null && ((!field.signed && value < 0) || Math.abs(value * multiplier) > 1e15)) {
      fieldErrors[field.key] = `${field.label}의 부호와 금액 단위를 확인해주세요.`;
    }
  }
  // Permit at most two reporting units of rounding, not a percentage that could
  // conceal a material imbalance on large statements. No figures are auto-filled.
  const { assets, liabilities, equity, currentAssets, currentLiabilities, cash, shortTermBorrowings } = statement;
  if (assets !== null && liabilities !== null && equity !== null && Math.abs(assets - liabilities - equity) > 2) {
    fieldErrors.equity = '자산총계 = 부채총계 + 자본총계가 맞지 않습니다. 연도와 단위를 확인해주세요.';
  }
  for (const [key, part, total] of [
    ['currentAssets', currentAssets, assets],
    ['currentLiabilities', currentLiabilities, liabilities],
    ['cash', cash, currentAssets ?? assets],
    ['shortTermBorrowings', shortTermBorrowings, currentLiabilities ?? liabilities],
  ] as const) {
    if (part !== null && total !== null && part > total + 2) fieldErrors[key] = '세부 항목이 상위 합계보다 큽니다. 연도와 단위를 확인해주세요.';
  }
  if (equity !== null && equity <= 0) warnings.push('자본총계가 0 이하입니다. 부채비율은 해석하지 않고 자본 확충 및 손실 원인 검토를 우선합니다.');
  if (statement.operatingProfit !== null && statement.operatingProfit < 0) warnings.push('영업손실이 있습니다. 매출 확대뿐 아니라 원가·고정비와 현금흐름을 함께 점검하세요.');
  if (statement.operatingCashFlow !== null && statement.operatingCashFlow < 0) warnings.push('영업활동현금흐름이 음수입니다. 이익과 별도로 실제 현금 유출 원인을 확인하세요.');
  const missing = FINANCIAL_FIELDS.filter(({ key, required }) => !required && statement[key] === null).map(({ label }) => label);
  if (missing.length) warnings.push(`미입력 자료: ${missing.join(', ')}. 누락 항목을 0으로 가정하지 않습니다.`);
  return { statement, fieldErrors, warnings };
}
