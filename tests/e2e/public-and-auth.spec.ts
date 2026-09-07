import { expect, test } from '@playwright/test';

test.describe('public signup', () => {
  test('renders required fields and validates input without submitting', async ({ page }) => {
    await page.goto('/signup');

    await expect(page.getByRole('heading', { name: '회원가입' })).toBeVisible();
    await expect(page.getByLabel('이름')).toBeVisible();
    await expect(page.getByLabel('회사명 (선택)')).toBeVisible();
    await expect(page.getByRole('textbox', { name: '이메일', exact: true })).toBeVisible();
    await expect(page.getByLabel('비밀번호', { exact: true })).toBeVisible();
    await expect(page.getByLabel('비밀번호 확인')).toBeVisible();
    await expect(page.locator('#privacyConsent')).not.toBeChecked();
    await expect(page.locator('#marketingConsent')).not.toBeChecked();

    await page.getByRole('button', { name: '이메일로 회원가입' }).click();
    await expect(page.getByText('이름을 입력해주세요.')).toBeVisible();
    await expect(page.getByText('올바른 이메일 주소를 입력해주세요.')).toBeVisible();
    await expect(page.getByText('개인정보 수집 및 이용 동의가 필요해요.')).toBeVisible();

    await page.getByLabel('이름').fill('테스트 사용자');
    await page.getByRole('textbox', { name: '이메일', exact: true }).fill('invalid-email');
    await page.getByLabel('비밀번호', { exact: true }).fill('abcdef');
    await page.getByLabel('비밀번호 확인').fill('abcdeg');
    await expect(page.getByText('비밀번호가 일치하지 않아요.')).toBeVisible();
  });
});

test('protected pages redirect anonymous visitors to login and preserve destination', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
  await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
});

test.describe('authenticated core journey', () => {
  test.skip(!process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
    'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to an existing, onboarding-complete test account.');

  test('logs in, sees matches, and opens a program without mutating account data', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('이메일').fill(process.env.E2E_USER_EMAIL!);
    await page.getByLabel('비밀번호').fill(process.env.E2E_USER_PASSWORD!);
    await page.getByRole('button', { name: '이메일로 로그인' }).click();

    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: /안녕하세요,/ })).toBeVisible();
    const firstProgram = page.getByRole('link', { name: '자세히 보기' }).first();
    await expect(firstProgram).toBeVisible({ timeout: 30_000 });
    await firstProgram.click();
    await expect(page).toHaveURL(/\/program\/[0-9a-f-]+$/);
    await expect(page.locator('h1')).toBeVisible();
  });
});
