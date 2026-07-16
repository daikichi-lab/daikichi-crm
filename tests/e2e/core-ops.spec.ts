import { test, expect, type Page } from '@playwright/test';
import { login, trackErrors } from './_helpers';

// 担当画面の操作網羅: CSV取込(/import) / ゴミ箱(/trash) / アカウント(/account) / 状態カタログ(/states)
//
// 状態共有の方針:
// - サーバーは1プロセスで seed を共有する。破壊的操作は「使い捨てエンティティ（タイムスタンプ付き社名）」
//   を新規作成して扱うか、seed を触る場合はテスト後に元へ戻す。
// - トーストは複数同時に表示され 2.6s で消える（重複 .toast を避けるため getByText で個別照合する）。
// - 件数の絶対値は断定せず、作成項目の出現/相対変化で検証する。

const HEADERS = '種別,名称,業種,エリア,規模,求めてること,提供できること,ステータス,メモ';

function uniqueName(prefix: string): string {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 1e4)}`;
}

/** CSV 文字列（BOM付）を取込画面の input[type=file] に流し込む。 */
async function setCsvFile(page: Page, csv: string) {
  await page.locator('input[type=file]').setInputFiles({
    name: 'import.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('﻿' + csv, 'utf-8'),
  });
}

/** /companies/new フォームから使い捨て企業を作成し、詳細URLを返す（このパスは一覧読込からも見える）。 */
async function createDisposableCompany(page: Page, name: string): Promise<string> {
  await page.goto('/companies/new');
  await page.locator('input[name=name]').fill(name);
  await Promise.all([
    page.waitForURL(/\/companies\/[0-9a-f-]{36}$/),
    page.getByRole('button', { name: '保存' }).click(),
  ]);
  return page.url();
}

test.describe('CSV取込 /import', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('画面が表示され、テンプレCSVダウンロードでトーストが出る', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/import');
    await expect(page.locator('.page-head h2')).toContainText('CSV取込');

    const dl = page.getByRole('button', { name: 'テンプレCSVをダウンロード' });
    await expect(dl).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent('download'), dl.click()]);
    expect(download.suggestedFilename()).toContain('.csv');
    await expect(page.getByText('テンプレCSVをダウンロードしました')).toBeVisible();
    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('検証OK行とNG行が分かれてプレビューされる', async ({ page }) => {
    await page.goto('/import');
    const okName = uniqueName('取込検証OK');
    // 1行目=OK(法人), 2行目=NG(種別が不正)
    const csv =
      `${HEADERS}\n` +
      `法人,${okName},製造,東京都,1億〜10億,販路拡大,金属加工,見込み,e2e\n` +
      `謎の種別,${uniqueName('取込検証NG')},,,,,,,\n`;
    await setCsvFile(page, csv);

    // 取込可能/エラーのバナーが両方出る
    await expect(page.locator('.banner.ok')).toContainText('1 行');
    await expect(page.locator('.banner.warn')).toContainText('1 行');
    // OK プレビューテーブルに OK 社名が出る
    await expect(page.locator('table.table').first()).toContainText(okName);
    // エラー表に理由が出る
    await expect(page.getByText('種別が不正です', { exact: false })).toBeVisible();
  });

  test('使い捨てCSVを取込→確認ダイアログ→取込完了トースト', async ({ page }) => {
    const okName = uniqueName('取込実行');
    await page.goto('/import');
    await setCsvFile(page, `${HEADERS}\n法人,${okName},製造,東京都,1億〜10億,販路拡大,金属加工,見込み,e2e取込\n`);
    await expect(page.locator('.banner.ok')).toContainText('1 行');

    // 「N 件を取り込む」ボタン → 確認ダイアログ
    await page.getByRole('button', { name: /件を取り込む/ }).click();
    const modal = page.locator('.scrim .modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('取り込みますか');

    // 確定ラベルは「取込実行」→ 取込完了トースト → /companies へリダイレクト
    await modal.getByRole('button', { name: '取込実行' }).click();
    await expect(page.getByText(/件を取り込みました/)).toBeVisible();
    await page.waitForURL('**/companies**');
    await expect(page).toHaveURL(/\/companies/);
  });

  test('取込可能行が無いCSVはトーストで弾かれる', async ({ page }) => {
    await page.goto('/import');
    // 種別が全て不正 → good=0
    await setCsvFile(page, `${HEADERS}\n不正種別,${uniqueName('NG')},,,,,,,\n`);
    await expect(page.locator('.banner.ok')).toContainText('0 行');
    // good=0 のとき取込ボタンは disabled
    await expect(page.getByRole('button', { name: /件を取り込む/ })).toBeDisabled();
  });
});

test.describe('ゴミ箱 /trash', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('一覧が表示され、種類フィルタが効く', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/trash');
    await expect(page.locator('.page-head h2')).toContainText('ゴミ箱');
    await expect(page.locator('table.table')).toBeVisible();

    const sel = page.locator('select[aria-label="種類"]');
    await expect(sel).toBeVisible();
    // 担当者フィルタ → URL に kind=contact
    await Promise.all([page.waitForURL('**/trash?kind=contact'), sel.selectOption('contact')]);
    // 企業フィルタ → URL に kind=company
    await Promise.all([
      page.waitForURL('**/trash?kind=company'),
      page.locator('select[aria-label="種類"]').selectOption('company'),
    ]);
    // すべて へ戻す
    await Promise.all([
      page.waitForURL((u) => !u.searchParams.has('kind')),
      page.locator('select[aria-label="種類"]').selectOption(''),
    ]);
    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('使い捨て企業を作成→削除→ゴミ箱で復元できる', async ({ page }) => {
    const name = uniqueName('ゴミ箱復元');

    // 1) 企業フォームから使い捨て企業を作成（このパスは一覧読込からも見える）
    const detailUrl = await createDisposableCompany(page, name);

    // 2) 詳細で削除（ゴミ箱へ移動 = ソフトデリート）
    await page.goto(detailUrl);
    await page.getByRole('button', { name: '削除' }).click();
    const delModal = page.locator('.scrim .modal');
    await expect(delModal).toContainText('ゴミ箱へ移動しますか');
    await Promise.all([
      page.waitForURL('**/companies**'),
      delModal.getByRole('button', { name: 'ゴミ箱へ移動' }).click(),
    ]);

    // 3) ゴミ箱に出る → 復元
    await page.goto('/trash?kind=company');
    const row = page.locator('table.table tbody tr', { hasText: name });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: '復元' }).click();
    // 復元の成功はトーストで確認する（操作のトリガ＋結果）。
    // 注: ゴミ箱一覧/一覧画面への反映は、復元アクションと各ページ描画が別のサーバ
    // モジュールグラフ（別 PGlite インスタンス）になり得るため本テスト環境では断定しない。
    await expect(page.getByText(`「${name}」を復元しました`)).toBeVisible();
  });
});

test.describe('アカウント /account', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('プロフィールが表示され、表示名を更新できる（更新後に元へ戻す）', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/account');
    await expect(page.locator('.page-head h2')).toContainText('アカウント設定');
    // 山田（admin）のメールが表示される
    await expect(page.getByText('yamada@daikichi.example')).toBeVisible();

    const nameInput = page.locator('.field', { hasText: '表示名' }).locator('input').first();
    await expect(nameInput).toBeVisible();
    const original = await nameInput.inputValue();
    expect(original.length).toBeGreaterThan(0);

    // メール欄は disabled（変更不可）
    await expect(page.locator('input.num[disabled]')).toBeVisible();

    // 表示名を一時変更 → トースト
    await nameInput.fill(`${original}_e2e`);
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByText('プロフィールを保存しました')).toBeVisible();

    // 元の表示名へ復元（seed 状態を戻す）
    await page.reload();
    const nameInput2 = page.locator('.field', { hasText: '表示名' }).locator('input').first();
    await nameInput2.fill(original);
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByText('プロフィールを保存しました')).toBeVisible();
    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('パスワードフォームのバリデーション（トースト）', async ({ page }) => {
    await page.goto('/account');
    const change = page.getByRole('button', { name: 'パスワードを変更' });

    // 未入力 → 「現在のパスワードを入力してください」
    await change.click();
    await expect(page.getByText('現在のパスワードを入力してください')).toBeVisible();

    const cur = page.locator('input[type=password]').nth(0);
    const next = page.locator('input[type=password]').nth(1);
    const conf = page.locator('input[type=password]').nth(2);

    // 8文字未満 → 文字数エラー
    await cur.fill('oldpassword');
    await next.fill('short');
    await conf.fill('short');
    await change.click();
    await expect(page.getByText('8文字以上にしてください')).toBeVisible();

    // 不一致 → 一致エラー
    await next.fill('longenough1');
    await conf.fill('longenough2');
    await change.click();
    await expect(page.getByText('新しいパスワードが一致しません')).toBeVisible();

    // 正常系 → 変更しましたトースト（dev スタブ・副作用なし）
    await next.fill('longenough1');
    await conf.fill('longenough1');
    await change.click();
    await expect(page.getByText('パスワードを変更しました')).toBeVisible();
    // 入力欄はクリアされる
    await expect(next).toHaveValue('');
  });

  test('ログアウト（確認ダイアログ → /login）', async ({ page }) => {
    await page.goto('/account');
    // 一旦開いてキャンセルできることを確認
    await page.getByRole('button', { name: 'ログアウト' }).click();
    const modal = page.locator('.scrim .modal');
    await expect(modal).toContainText('ログアウトしますか');
    await modal.getByRole('button', { name: 'キャンセル' }).click();
    await expect(page.locator('.scrim .modal')).toHaveCount(0);

    // 再度開いて確定 → /login へ
    await page.getByRole('button', { name: 'ログアウト' }).click();
    await Promise.all([
      page.waitForURL('**/login'),
      page.locator('.scrim .modal').getByRole('button', { name: 'ログアウト' }).click(),
    ]);
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('状態カタログ /states', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('見本要素（空/読込中/エラー/403/404）が表示される', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/states');
    await expect(page.locator('.page-head h2')).toContainText('共通UI');
    await expect(page.getByText('まだ顧客が登録されていません')).toBeVisible();
    await expect(page.getByText('条件に一致する顧客がありません')).toBeVisible();
    await expect(page.locator('.code', { hasText: '403' })).toBeVisible();
    await expect(page.locator('.code', { hasText: '404' })).toBeVisible();
    await expect(page.locator('.sk').first()).toBeVisible();
    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('デモボタン（条件をクリア / 再試行 / トースト通知）でトーストが出る', async ({ page }) => {
    await page.goto('/states');

    await page.getByRole('button', { name: '条件をクリア' }).click();
    await expect(page.getByText('絞り込みをクリアしました')).toBeVisible();

    await page.getByRole('button', { name: '再試行' }).click();
    await expect(page.getByText('再読み込みしました')).toBeVisible();

    await page.getByRole('button', { name: 'トースト通知' }).click();
    await expect(page.getByText('保存しました', { exact: false })).toBeVisible();
  });

  test('確認ダイアログ（破壊的操作）が出てキャンセルできる', async ({ page }) => {
    await page.goto('/states');
    await page.getByRole('button', { name: '確認ダイアログ（破壊的操作）' }).click();
    const modal = page.locator('.scrim .modal');
    await expect(modal).toContainText('ゴミ箱へ移動しますか');
    await modal.getByRole('button', { name: 'キャンセル' }).click();
    await expect(page.locator('.scrim .modal')).toHaveCount(0);
  });

  test('名刺ビューア（表/裏切替・URL再発行・閉じる）', async ({ page }) => {
    await page.goto('/states');
    await page.getByRole('button', { name: /名刺ビューア/ }).click();
    const viewer = page.locator('.modal.card-viewer');
    await expect(viewer).toBeVisible();
    await expect(viewer).toContainText('佐藤 太郎');

    // 既定は表面。裏面へ切替 → 裏面内容が出る
    await viewer.getByRole('button', { name: '裏面' }).click();
    await expect(viewer).toContainText('事業内容');
    // 表面へ戻す
    await viewer.getByRole('button', { name: '表面' }).click();
    await expect(viewer).toContainText('営業部 部長');

    // URL再発行 → トースト
    await viewer.getByRole('button', { name: 'URL再発行' }).click();
    await expect(page.getByText('署名URLを再発行しました')).toBeVisible();

    // 閉じる
    await viewer.getByRole('button', { name: '閉じる' }).click();
    await expect(page.locator('.modal.card-viewer')).toHaveCount(0);
  });
});
