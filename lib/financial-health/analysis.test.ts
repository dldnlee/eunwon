import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateMetrics } from './metrics';
import { sampleStatement } from './fixtures';
import { validateStatement } from './validation';

test('financial ratios are calculated from reviewed figures with explicit formulas', () => {
  assert.deepEqual(validateStatement(sampleStatement).fieldErrors, {});
  const metrics = calculateMetrics(sampleStatement);
  assert.deepEqual(metrics.map(({ value }) => value), [233.33, 30, 80, 6, 1.5, -2, 25]);
  assert.ok(metrics.every(({ formula }) => formula.includes('÷')));
  for (const unit of ['KRW', 'KRW_THOUSAND', 'KRW_MILLION'] as const) {
    assert.deepEqual(calculateMetrics({ ...sampleStatement, unit }), metrics);
  }
});

test('missing amounts remain unknown; zero denominators and negative equity never look healthy', () => {
  const metrics = calculateMetrics({ ...sampleStatement, equity: -100, revenue: 0, interestExpense: 0, currentAssets: null });
  assert.deepEqual(metrics.map(({ value }) => value), [null, -10, null, null, null, null, -100]);
  assert.match(metrics[0].note, /0 이하/);
  assert.match(metrics[2].note, /자료가 없어/);
  const zero = calculateMetrics({ ...sampleStatement, operatingProfit: 0 });
  assert.equal(zero.find(({ id }) => id === 'operatingMargin')?.value, 0);
});

test('required figures, source unit and fiscal year must be present without coercing blanks to zero', () => {
  const result = validateStatement({ ...sampleStatement, companyName: ' ', unit: null, fiscalYear: null, revenue: null });
  assert.deepEqual(Object.keys(result.fieldErrors).sort(), ['companyName', 'fiscalYear', 'revenue', 'unit']);
  assert.equal(result.statement.revenue, null);
  for (const value of ['', '100', NaN, Infinity]) {
    assert.ok(validateStatement({ ...sampleStatement, revenue: value }).fieldErrors.revenue);
  }
});

test('inconsistent balance sheets and mixed units cannot reach AI analysis', () => {
  assert.ok(validateStatement({ ...sampleStatement, equity: 301_000 }).fieldErrors.equity);
  assert.ok(validateStatement({ ...sampleStatement, currentAssets: 1200 }).fieldErrors.currentAssets);
  assert.ok(validateStatement({ ...sampleStatement, currentLiabilities: 800 }).fieldErrors.currentLiabilities);
  assert.ok(validateStatement({ ...sampleStatement, cash: 600 }).fieldErrors.cash);
  assert.ok(validateStatement({ ...sampleStatement, shortTermBorrowings: 600 }).fieldErrors.shortTermBorrowings);
  assert.deepEqual(validateStatement({ ...sampleStatement, equity: 301 }).fieldErrors, {});
});

test('losses and negative equity are allowed but nonnegative accounts and implausible amounts are rejected', () => {
  const result = validateStatement({ ...sampleStatement, liabilities: 1100, equity: -100, operatingProfit: -20, netProfit: -30 });
  assert.deepEqual(result.fieldErrors, {});
  assert.ok(result.warnings.some((warning) => warning.includes('자본총계')));
  assert.ok(result.warnings.some((warning) => warning.includes('영업손실')));
  assert.ok(validateStatement({ ...sampleStatement, assets: -1 }).fieldErrors.assets);
  assert.ok(validateStatement({ ...sampleStatement, interestExpense: -1 }).fieldErrors.interestExpense);
  assert.ok(validateStatement({ ...sampleStatement, revenue: 1e15 }).fieldErrors.revenue);
  assert.ok(validateStatement({ ...sampleStatement, fiscalYear: 2100 }).fieldErrors.fiscalYear);
});

test('extreme ratios cannot produce Infinity or unbounded output', () => {
  const metrics = calculateMetrics({ ...sampleStatement, interestExpense: Number.MIN_VALUE });
  assert.equal(metrics.find(({ id }) => id === 'interestCoverage')?.value, null);
});
