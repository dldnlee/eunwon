import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { calculateMetrics } from '../../lib/financial-health/metrics';
import { samplePlan, sampleStatement } from '../../lib/financial-health/fixtures';
import { FINANCIAL_DISCLAIMER, FINANCIAL_FIELDS, FINANCIAL_SOURCES } from '../../lib/financial-health/types';

test('financial health page and APIs require authentication', async ({ page, request }) => {
  await page.goto('/financial-health');
  await expect(page).toHaveURL(/\/login\?next=%2Ffinancial-health$/);
  for (const action of ['extract', 'analyze']) {
    const response = await request.post(`/api/financial-health/${action}`, { data: {} });
    expect(response.status()).toBe(401);
    expect(response.headers()['cache-control']).toContain('no-store');
  }
});

test.describe('financial health review and planning', () => {
  test.skip(!process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
    'Use an existing test account via E2E_USER_EMAIL and E2E_USER_PASSWORD.');

  test.beforeEach(async ({ page }) => {
    await page.goto('/financial-health');
    await page.getByLabel('이메일').fill(process.env.E2E_USER_EMAIL!);
    await page.getByLabel('비밀번호', { exact: true }).fill(process.env.E2E_USER_PASSWORD!);
    await page.getByRole('button', { name: '이메일로 로그인' }).click();
    await expect(page).toHaveURL(/\/financial-health$/, { timeout: 30_000 });
  });

  test('manual review validates figures, retries safely, downloads results and works on mobile', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    let calls = 0;
    await page.route('**/api/financial-health/analyze', async (route) => {
      calls++;
      const body = route.request().postDataJSON();
      expect(body).toEqual({ statement: sampleStatement, confirmed: true, consent: true });
      if (calls === 1) return route.fulfill({ status: 502, json: { error: '일시적인 오류입니다. 다시 시도해주세요.' } });
      return route.fulfill({ json: {
        statement: sampleStatement, metrics: calculateMetrics(sampleStatement), warnings: [], plan: samplePlan,
        generatedAt: '2026-10-11T08:00:00Z', disclaimer: FINANCIAL_DISCLAIMER, sources: FINANCIAL_SOURCES,
      } });
    });
    await expect(page.getByRole('heading', { name: '재무·신용 관리', exact: true })).toBeVisible();
    await page.screenshot({ path: '.tmp-financial-source-desktop.png', fullPage: true });
    await page.getByRole('button', { name: '숫자 직접 입력하기' }).click();
    await page.locator('#company-name').fill(sampleStatement.companyName);
    await page.locator('#fiscal-year').fill('2025');
    await page.locator('#money-unit').selectOption('KRW_MILLION');
    for (const { key } of FINANCIAL_FIELDS) await page.locator(`#financial-${key}`).fill(String(sampleStatement[key]));
    await page.getByLabel(/재무자료를 Upstage AI/).check();
    const confirmed = page.getByLabel(/회사명, 회계연도, 금액 단위와 입력한 숫자/);
    await confirmed.check();
    await page.locator('#financial-equity').fill('999');
    await expect(confirmed).not.toBeChecked();
    await confirmed.check();
    const analyze = page.getByRole('button', { name: 'AI 분석 및 개선 계획 만들기' });
    await analyze.click();
    await expect(page.getByText(/자산총계 = 부채총계/)).toBeVisible();
    expect(calls).toBe(0);
    await page.locator('#financial-equity').fill('300');
    await confirmed.check();
    await analyze.click();
    await expect(page.getByRole('alert').filter({ hasText: '일시적인 오류' })).toBeVisible();
    await expect(page.locator('#financial-operatingProfit')).toHaveValue('90');
    await analyze.click();
    await expect(page.getByRole('heading', { name: '재무 분석과 개선 계획' })).toBeVisible();
    await expect(page.getByText('233.33%')).toBeVisible();
    await expect(page.getByRole('heading', { name: '차입 만기 점검' })).toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '결과 다운로드 (.md)' }).click();
    const download = await downloadPromise;
    const content = await readFile((await download.path())!, 'utf8');
    expect(content).toContain('가상 제조기업');
    expect(content).toContain('233.33%');
    expect(content).toContain('30일: 현금 수지 확인');
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('heading', { name: '재무 분석과 개선 계획' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: '.tmp-financial-report-mobile.png' });
    await page.getByRole('button', { name: '메뉴 열기' }).click();
    await expect(page.locator('#mobile-nav-panel').getByRole('link', { name: '재무·신용 관리' })).toBeVisible();
    await page.getByRole('button', { name: '메뉴 닫기' }).click();
    await page.locator('#financial-revenue').fill('1600');
    await expect(page.getByRole('heading', { name: '재무 분석과 개선 계획' })).toHaveCount(0);
    await expect(confirmed).not.toBeChecked();
    expect(errors).toEqual([]);
  });

  test('statement extraction populates editable fields and never auto-confirms them', async ({ page }) => {
    await page.route('**/api/financial-health/extract', async (route) => {
      expect(route.request().postDataJSON().consent).toBe(true);
      return route.fulfill({ json: { statement: { ...sampleStatement, unit: null }, warnings: ['금액 단위를 확인하세요.'] } });
    });
    await page.getByRole('button', { name: '텍스트 붙여넣기' }).click();
    await page.getByLabel('재무제표 텍스트', { exact: true }).fill('가상 제조기업 2025년 연간 재무제표 자산총계 1000 부채총계 700');
    const extract = page.getByRole('button', { name: '자료에서 숫자 가져오기' });
    await expect(extract).toBeDisabled();
    await page.getByLabel(/재무자료를 Upstage AI/).check();
    await extract.click();
    await expect(page.locator('#financial-assets')).toHaveValue('1000');
    await expect(page.locator('#money-unit')).toHaveValue('');
    await expect(page.getByText('금액 단위를 확인하세요.', { exact: true })).toBeVisible();
    await expect(page.getByLabel(/회사명, 회계연도, 금액 단위와 입력한 숫자/)).not.toBeChecked();
    await expect(page.getByRole('button', { name: 'AI 분석 및 개선 계획 만들기' })).toBeDisabled();
  });

  test('upload rejects unsupported files and sends consent with supported documents', async ({ page }) => {
    let calls = 0;
    await page.route('**/api/financial-health/extract', async (route) => {
      calls++;
      expect(route.request().headers()['content-type']).toContain('multipart/form-data');
      const body = route.request().postDataBuffer()!.toString();
      expect(body).toContain('name="consent"\r\n\r\ntrue');
      expect(body).toContain('filename="statement.pdf"');
      return route.fulfill({ json: { statement: sampleStatement, warnings: [] } });
    });
    await page.locator('#financial-file').setInputFiles({ name: 'statement.txt', mimeType: 'text/plain', buffer: Buffer.from('unsupported input') });
    await page.getByLabel(/재무자료를 Upstage AI/).check();
    await page.getByRole('button', { name: '자료에서 숫자 가져오기' }).click();
    await expect(page.getByText('4MB 이하의 PDF, JPG 또는 PNG 파일을 선택해 주세요.', { exact: true })).toBeVisible();
    expect(calls).toBe(0);
    // Parser signature/readability validation is covered by provider.test.ts.
    await page.locator('#financial-file').setInputFiles({ name: 'statement.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-synthetic-browser-fixture') });
    await page.getByRole('button', { name: '자료에서 숫자 가져오기' }).click();
    await expect(page.locator('#financial-assets')).toHaveValue('1000');
    await expect(page.getByLabel(/회사명, 회계연도, 금액 단위와 입력한 숫자/)).not.toBeChecked();
    expect(calls).toBe(1);
  });
});
