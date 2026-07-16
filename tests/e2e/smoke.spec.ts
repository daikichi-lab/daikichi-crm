import { test, expect, type Page } from '@playwright/test';

const C1 = 'aaaaaaaa-0000-0000-0000-000000000001'; // 株式会社 大吉商事

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('#email', 'yamada@daikichi.example');
  await Promise.all([page.waitForURL('**/dashboard'), page.click('button[type=submit]')]);
}

// 認証ガード: 未ログインでアプリ画面に来たら /login へ
test('未ログインは /login へリダイレクト', async ({ page }) => {
  await page.goto('/companies');
  await expect(page).toHaveURL(/\/login/);
});

test('dev ログイン → ダッシュボード', async ({ page }) => {
  await login(page);
  await expect(page.locator('.page-head h2')).toContainText('山田');
  await expect(page.locator('.sidebar')).toBeVisible();
});

const ROUTES: { path: string; active?: string }[] = [
  { path: '/dashboard' }, { path: '/companies' }, { path: '/people' }, { path: '/activities' },
  { path: '/documents' }, { path: '/scan' }, { path: '/schedule' }, { path: '/matching' },
  { path: '/referrals' }, { path: '/meetings' }, { path: '/notes' }, { path: '/forms/inbox' },
  { path: '/forms/edit' }, { path: '/newsletters' }, { path: '/newsletters/compose' },
  { path: '/trash' }, { path: '/admin/users' }, { path: '/admin/masters' }, { path: '/account' },
  { path: `/companies/${C1}` }, { path: '/companies/new' },
];

test('全アプリ画面がエラーなく表示される', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await login(page);
  for (const r of ROUTES) {
    const resp = await page.goto(r.path);
    expect(resp?.status(), `${r.path} status`).toBeLessThan(400);
    await expect(page.locator('.sidebar'), `${r.path} shell`).toBeVisible();
  }
  expect(errors, 'page errors:\n' + errors.join('\n')).toHaveLength(0);
});

test('公開ページ（フォーム/配信停止）は未ログインで表示', async ({ page }) => {
  const r1 = await page.goto('/form');
  expect(r1?.status()).toBeLessThan(400);
  await expect(page.locator('input').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /送信/ })).toBeVisible();
});
