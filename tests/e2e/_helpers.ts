import { type Page, expect } from '@playwright/test';

// seed の固定ID（supabase/seed/seed.sql）
export const SEED = {
  daikichi: 'aaaaaaaa-0000-0000-0000-000000000001', // 株式会社 大吉商事
  tech: 'aaaaaaaa-0000-0000-0000-000000000005',     // テック合同会社
  satodesign: 'aaaaaaaa-0000-0000-0000-000000000003',
  pSato: 'bbbbbbbb-0000-0000-0000-000000000001',    // 佐藤 太郎
  yamadaEmail: 'yamada@daikichi.example',           // admin
  satoEmail: 'sato@daikichi.example',               // staff
};

/** dev ログイン（既定は admin の山田）。 */
export async function login(page: Page, email = SEED.yamadaEmail) {
  await page.goto('/login');
  await page.fill('#email', email);
  await Promise.all([page.waitForURL('**/dashboard'), page.click('button[type=submit]')]);
  await expect(page.locator('.sidebar')).toBeVisible();
}

/** ページ内に pageerror が出ないことを監視するフック。 */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}
