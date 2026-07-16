import { test, expect, type Page } from '@playwright/test';
import { login, SEED, trackErrors } from './_helpers';

// 一意な使い捨て社名（破壊的操作はこれを使って seed を汚さない）
const uniq = () => `E2Eテスト商事_${Date.now()}_${Math.floor(Math.random() * 1e4)}`;

/** /companies/new から使い捨て企業を1社つくり、その企業詳細URL（/companies/<id>）で止まることを確認して返す。 */
async function createCompany(page: Page, name: string, opts?: { needs?: string[]; offers?: string[] }) {
  await page.goto('/companies/new');
  await expect(page.locator('.page-head h2')).toContainText('企業を登録');
  await page.fill('input[name="name"]', name);
  // 種別・ステータスは既定（法人 / 見込み）。

  if (opts?.needs) {
    const needBox = page.locator('.tag-suggest').first().locator('input.tag-input');
    for (const t of opts.needs) { await needBox.fill(t); await needBox.press('Enter'); }
  }
  if (opts?.offers) {
    const offerBox = page.locator('.tag-suggest').nth(1).locator('input.tag-input');
    for (const t of opts.offers) { await offerBox.fill(t); await offerBox.press('Enter'); }
  }

  await Promise.all([
    page.waitForURL(/\/companies\/[0-9a-f-]{36}$/),
    page.click('button[type="submit"]'),
  ]);
  const id = page.url().split('/').pop()!;
  await expect(page.locator('.page-head h2')).toHaveText(name);
  return id;
}

test.describe('企業一覧 /companies', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('一覧の表示・行クリックで詳細へ遷移', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/companies');
    await expect(page.locator('.page-head h2')).toHaveText('顧客（企業）一覧');

    // seed の大吉商事の行リンクが見える
    const daikichiLink = page.locator(`a[href="/companies/${SEED.daikichi}"]`).first();
    await expect(daikichiLink).toBeVisible();
    await expect(daikichiLink).toContainText('大吉商事');

    // 行（社名リンク）クリック → 詳細へ遷移
    await Promise.all([page.waitForURL(`**/companies/${SEED.daikichi}`), daikichiLink.click()]);
    await expect(page.locator('.page-head h2')).toContainText('大吉商事');
    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('絞り込み: 種別 select で URL クエリが付与され結果が変わる', async ({ page }) => {
    await page.goto('/companies');
    const before = await page.locator('tbody tr.rowlink').count();

    await page.getByLabel('種別').selectOption('個人事業主');
    await page.waitForURL(/type=/);
    await expect(page).toHaveURL(/type=(%E5%80%8B%E4%BA%BA%E4%BA%8B%E6%A5%AD%E4%B8%BB|個人事業主)/);
    // 個人事業主のみ表示（種別バッジで確認）。1件以上または0件のいずれでもクラッシュしない。
    const rows = page.locator('tbody tr.rowlink');
    const n = await rows.count();
    // TypeBadge は 個人事業主 を「個人」と短縮表示する
    for (let i = 0; i < n; i++) {
      await expect(rows.nth(i).locator('td').nth(1)).toContainText('個人');
    }

    // 条件クリアで全件に戻る
    await page.getByRole('button', { name: '条件をクリア' }).click();
    await page.waitForURL(/\/companies$/);
    await expect(page.locator('tbody tr.rowlink')).toHaveCount(before);
  });

  test('キーワード検索で件数が絞り込まれる', async ({ page }) => {
    await page.goto('/companies');
    const search = page.locator('.filterbar input[aria-label="検索"]');
    await search.fill('大吉');
    await Promise.all([page.waitForURL(/q=/), search.press('Enter')]);
    // 大吉商事の行が残る
    await expect(page.locator(`a[href="/companies/${SEED.daikichi}"]`)).toBeVisible();
  });
});

test.describe('企業詳細 /companies/[id]', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('タブ切替（概要/担当者/資料/議事録/紹介履歴）', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(`/companies/${SEED.daikichi}`);
    await expect(page.locator('.page-head h2')).toContainText('大吉商事');

    const tabs = page.locator('nav.tabs button');
    await expect(tabs).toHaveCount(5);

    // 概要: 既定で active、企業情報パネルが見える
    await expect(page.locator('nav.tabs button', { hasText: '概要' })).toHaveClass(/on/);
    await expect(page.locator('.panel-head h3', { hasText: '企業情報' })).toBeVisible();

    // 担当者
    await page.locator('nav.tabs button', { hasText: '担当者' }).click();
    await expect(page.locator('nav.tabs button', { hasText: '担当者' })).toHaveClass(/on/);
    await expect(page.locator('.contact-card').first()).toBeVisible();
    await expect(page).toHaveURL(/#contacts$/);

    // 資料
    await page.locator('nav.tabs button', { hasText: '資料' }).click();
    await expect(page.locator('.panel-head h3', { hasText: '資料・ファイル' })).toBeVisible();
    await expect(page.locator('.catfilter')).toBeVisible();

    // 議事録
    await page.locator('nav.tabs button', { hasText: '議事録' }).click();
    await expect(page.locator('.panel-head h3', { hasText: '議事録' })).toBeVisible();

    // 紹介履歴
    await page.locator('nav.tabs button', { hasText: '紹介履歴' }).click();
    await expect(page.locator('.panel-head h3', { hasText: '紹介履歴' })).toBeVisible();
    await expect(page).toHaveURL(/#referrals$/);

    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('資料タブ: カテゴリフィルタで行が絞り込まれる', async ({ page }) => {
    await page.goto(`/companies/${SEED.daikichi}#files`);
    await page.locator('nav.tabs button', { hasText: '資料' }).click();
    const allRows = await page.locator('table.table tbody tr').count();
    // 「契約書」カテゴリで絞る
    await page.locator('.catfilter button', { hasText: '契約書' }).click();
    await expect(page.locator('.catfilter button', { hasText: '契約書' })).toHaveClass(/on/);
    const filtered = await page.locator('table.table tbody tr').count();
    expect(filtered).toBeLessThanOrEqual(allRows);
    // 表示行はすべて契約書
    const rows = page.locator('table.table tbody tr');
    const n = await rows.count();
    for (let i = 0; i < n; i++) {
      await expect(rows.nth(i)).toContainText('契約書');
    }
  });

  test('資料タブ: 行クリックでプレビュー確認ダイアログ→ダウンロードでトースト', async ({ page }) => {
    await page.goto(`/companies/${SEED.daikichi}#files`);
    await page.locator('nav.tabs button', { hasText: '資料' }).click();
    await page.locator('table.table tbody tr').first().click();
    const modal = page.locator('.scrim .modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.m-head h3')).toContainText('プレビュー');
    await modal.getByRole('button', { name: 'ダウンロード' }).click();
    // onConfirm のトースト「署名URL…」と既定の「ダウンロードしました」が両方出る
    await expect(page.locator('.toast', { hasText: '署名URL' })).toBeVisible();
  });

  test('資料タブ: 実ファイルをアップロードすると一覧に追加される（Storage）', async ({ page }) => {
    await page.goto(`/companies/${SEED.daikichi}#files`);
    await page.locator('nav.tabs button', { hasText: '資料' }).click();
    const fname = `E2Eアップロード_${Date.now()}.pdf`;
    // 隠しファイル入力へ直接投入（dev は擬似ストレージ・メタは create_document で永続化）
    const input = page.locator('input[type=file][accept*=".pdf"]');
    await input.setInputFiles({ name: fname, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 fake') });
    await expect(page.locator('.toast', { hasText: 'アップロードしました' })).toBeVisible();
    // 一覧に新規行が現れる（router.refresh 後）
    await expect(page.locator('table.table tbody tr', { hasText: fname })).toBeVisible();
  });

  test('概要タブ: タスク追加ダイアログ→追加でトースト', async ({ page }) => {
    // SEED.daikichi に手動タスクを足す（タスクは relative 確認のみ・seed 件数は断定しない）
    await page.goto(`/companies/${SEED.daikichi}`);
    await page.getByRole('button', { name: '＋ タスクを追加' }).click();
    const modal = page.locator('.scrim .modal');
    await expect(modal).toBeVisible();
    await modal.locator('#task-title').fill(`E2E確認タスク_${Date.now()}`);
    await modal.getByRole('button', { name: '追加' }).click();
    // confirmLabel「追加」の既定トースト（onConfirm はトランジションで後追い）
    await expect(page.locator('.toast', { hasText: '追加しました' })).toBeVisible();
  });

  test('「使い方」の案内人ツアーが起動し、ESCで閉じる', async ({ page }) => {
    await page.goto(`/companies/${SEED.daikichi}`);
    await page.getByRole('button', { name: '使い方' }).click();
    const card = page.locator('.tour-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText('使い方ツアー');
    await expect(card).toContainText('タブで1社のカルテを切替');
    await card.getByRole('button', { name: /次へ|完了/ }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.tour-card')).toHaveCount(0);
  });
});

test.describe('企業フォーム（新規/編集）', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('新規作成→一覧・詳細に出現（使い捨て社名）', async ({ page }) => {
    const errors = trackErrors(page);
    const name = uniq();
    const id = await createCompany(page, name, { needs: ['集客テスト'], offers: ['提供テスト'] });

    // 詳細の概要に needs/offers タグが反映
    await expect(page.locator('.chips .chip', { hasText: '集客テスト' })).toBeVisible();
    await expect(page.locator('.chips .chip', { hasText: '提供テスト' })).toBeVisible();

    // 一覧に新社名が出る
    await page.goto(`/companies?q=${encodeURIComponent(name)}`);
    await expect(page.locator(`a[href="/companies/${id}"]`)).toContainText(name);
    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('編集→保存で更新が反映（使い捨て企業を編集）', async ({ page }) => {
    const name = uniq();
    const id = await createCompany(page, name);

    // 編集画面へ
    await page.goto(`/companies/${id}/edit`);
    await expect(page.locator('.page-head h2')).toContainText('企業を編集');
    await expect(page.locator('input[name="name"]')).toHaveValue(name);

    // ステータスをを顧問中に、メモを追記
    await page.selectOption('select[name="status"]', '顧問中');
    const memo = `更新メモ_${Date.now()}`;
    await page.fill('textarea[name="notes"]', memo);

    await Promise.all([
      page.waitForURL(`**/companies/${id}`),
      page.click('button[type="submit"]'),
    ]);

    // 詳細に反映（ステータスバッジ・メモ）
    await expect(page.locator('.page-head .row')).toContainText('顧問中');
    await expect(page.locator('.ledger')).toContainText(memo);
  });

  test('needs/offers タグ入力: 追加とバックスペース削除', async ({ page }) => {
    await page.goto('/companies/new');
    const needBox = page.locator('.tag-suggest').first().locator('input.tag-input');
    await needBox.fill('タグA');
    await needBox.press('Enter');
    await needBox.fill('タグB');
    await needBox.press('Enter');
    const chips = page.locator('.tag-suggest').first().locator('.chip');
    await expect(chips).toHaveCount(2);
    await expect(chips.nth(0)).toContainText('タグA');

    // 空欄で Backspace → 末尾タグ削除
    await needBox.press('Backspace');
    await expect(page.locator('.tag-suggest').first().locator('.chip')).toHaveCount(1);

    // ✕ クリックで削除
    await page.locator('.tag-suggest').first().locator('.chip .x').first().click();
    await expect(page.locator('.tag-suggest').first().locator('.chip')).toHaveCount(0);
  });

  test('新規フォーム「キャンセル」で一覧へ戻る', async ({ page }) => {
    await page.goto('/companies/new');
    await page.locator('.content').getByRole('link', { name: 'キャンセル' }).click();
    await expect(page).toHaveURL(/\/companies$/);
  });
});

test.describe('削除→ゴミ箱→復元', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  // 注: 使い捨て企業のみを操作するため seed は汚さない（復元後 or 復元失敗でも
  //     残るのは新規作成した使い捨て企業だけ）。
  test('使い捨て企業を削除→一覧から消えて /trash に移動', async ({ page }) => {
    const name = uniq();
    const id = await createCompany(page, name);

    // 詳細から削除（確認ダイアログ → ゴミ箱へ移動 → /companies へ redirect）
    await page.locator('button.btn-danger', { hasText: '削除' }).click();
    const modal = page.locator('.scrim .modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.m-head h3')).toContainText('ゴミ箱へ移動しますか？');
    await Promise.all([
      page.waitForURL(/\/companies$/),
      modal.getByRole('button', { name: 'ゴミ箱へ移動' }).click(),
    ]);

    // 一覧から消える
    await page.goto(`/companies?q=${encodeURIComponent(name)}`);
    await expect(page.locator(`a[href="/companies/${id}"]`)).toHaveCount(0);
    // 詳細も 404（論理削除）
    const resp = await page.goto(`/companies/${id}`);
    expect(resp?.status()).toBe(404);

    // ゴミ箱に出現
    await page.goto('/trash');
    const trashRow = page.locator('tbody tr', { hasText: name });
    await expect(trashRow).toBeVisible();
    await expect(trashRow.locator('.badge.type')).toContainText('企業');
  });

  test('ゴミ箱の「復元」ボタンがクリックでき、トーストが出る', async ({ page }) => {
    const name = uniq();
    await createCompany(page, name);
    await page.locator('button.btn-danger', { hasText: '削除' }).click();
    const modal = page.locator('.scrim .modal');
    await Promise.all([
      page.waitForURL(/\/companies$/),
      modal.getByRole('button', { name: 'ゴミ箱へ移動' }).click(),
    ]);

    await page.goto('/trash');
    const trashRow = page.locator('tbody tr', { hasText: name });
    await expect(trashRow).toBeVisible();
    const restore = trashRow.getByRole('button', { name: '復元' });
    await expect(restore).toBeEnabled();
    await restore.click();
    // 復元ボタンはトーストで完了を知らせる（一覧の自動更新はしない）
    await expect(page.locator('.toast', { hasText: '復元しました' })).toBeVisible();
  });

  test('ゴミ箱フィルタ（種類: 企業/担当者）で表示が切り替わる', async ({ page }) => {
    await page.goto('/trash');
    // 企業のみ
    await page.getByLabel('種類').selectOption('company');
    await page.waitForURL(/kind=company/);
    const compRows = page.locator('tbody tr td .badge.type', { hasText: '担当者' });
    await expect(compRows).toHaveCount(0);
    // 担当者のみ
    await page.getByLabel('種類').selectOption('contact');
    await page.waitForURL(/kind=contact/);
    await expect(page.locator('tbody tr td .badge.type', { hasText: '企業' })).toHaveCount(0);
  });
});

test.describe('会った人 /people', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('左一覧クリック→右詳細（?c=）が切り替わる', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/people');
    await expect(page.locator('.page-head h2')).toHaveText('会った人');

    const rows = page.locator('.plist .prow');
    expect(await rows.count()).toBeGreaterThan(0);

    // 1人目を選ぶ → URL に c= が付き、右に詳細（連絡先パネル）が出る
    const first = rows.first();
    const firstName = (await first.locator('.nm').innerText()).trim();
    await Promise.all([page.waitForURL(/[?&]c=/), first.click()]);
    await expect(first).toHaveClass(/on/);
    await expect(page.locator('.pdetail .phero .nm')).toBeVisible();

    // 別の人を選ぶと右詳細が切り替わる（2人以上いる場合）
    if (await rows.count() > 1) {
      const second = rows.nth(1);
      const heroBefore = await page.locator('.pdetail .phero .nm').innerText();
      await Promise.all([page.waitForURL(/[?&]c=/), second.click()]);
      await expect(second).toHaveClass(/on/);
      // 何かしらの詳細が表示されている
      await expect(page.locator('.pdetail .phero .nm')).toBeVisible();
      void heroBefore; void firstName;
    }
    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('検索で絞り込み（名前）', async ({ page }) => {
    await page.goto('/people');
    const search = page.locator('.plist input[aria-label="検索"]');
    await search.fill('佐藤');
    await Promise.all([page.waitForURL(/q=/), search.press('Enter')]);
    // 佐藤 太郎が一覧に残る
    await expect(page.locator('.plist .prow .nm', { hasText: '佐藤' }).first()).toBeVisible();
  });

  test('会社で絞り込み（select）', async ({ page }) => {
    await page.goto('/people');
    const allCount = await page.locator('.plist .prow').count();
    await page.getByLabel('会社で絞り込み').selectOption('株式会社 大吉商事');
    await page.waitForURL(/company=/);
    const rows = page.locator('.plist .prow');
    const n = await rows.count();
    expect(n).toBeLessThanOrEqual(allCount);
    // 表示される人はすべて大吉商事所属
    for (let i = 0; i < n; i++) {
      await expect(rows.nth(i).locator('.meta')).toContainText('大吉商事');
    }
  });

  test('主担当のみチェックで絞り込み', async ({ page }) => {
    await page.goto('/people');
    const cb = page.getByText('主担当のみ').locator('input[type="checkbox"]');
    await Promise.all([page.waitForURL(/primary=1/), cb.click()]);
    const rows = page.locator('.plist .prow');
    const n = await rows.count();
    for (let i = 0; i < n; i++) {
      await expect(rows.nth(i).locator('.pin')).toBeVisible();
    }
  });

  test('詳細から所属企業の詳細へ遷移', async ({ page }) => {
    await page.goto('/people');
    await page.locator('.plist .prow').first().click();
    await page.waitForURL(/[?&]c=/);
    await Promise.all([
      page.waitForURL(/\/companies\/[0-9a-f-]{36}$/),
      page.locator('.pdetail').getByRole('link', { name: '会社の詳細を開く' }).click(),
    ]);
    await expect(page.locator('.page-head h2')).toBeVisible();
  });
});
