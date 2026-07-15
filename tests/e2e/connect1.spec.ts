import { test, expect, type Page } from '@playwright/test';
import { login, trackErrors } from './_helpers';

// 担当画面: 活動履歴(/activities) / 資料(/documents)。期限・タスクは schedule.spec.ts へ分離。
//
// 状態共有の注意: サーバーは1プロセスでseed状態を共有(workers:1)。
// 破壊的操作は使い捨てエンティティを新規作成して操作し、seedの絶対件数は断定しない。

/** confirm モーダルを開いて入力するためのヘルパ（.scrim .modal）。 */
async function modal(page: Page) {
  const m = page.locator('.scrim .modal');
  await expect(m).toBeVisible();
  return m;
}

// ============================================================
test.describe('活動履歴 (/activities)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('画面が表示され、タイムライン/内訳パネルが出る', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/activities');
    await expect(page.locator('.page-head h2')).toHaveText('活動履歴');
    await expect(page.locator('.panel-head h3', { hasText: 'タイムライン' })).toBeVisible();
    await expect(page.locator('.panel-head h3', { hasText: '今週の内訳' })).toBeVisible();
    await expect(page.locator('.stats .stat')).toHaveCount(4);
    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('期間フィルタ(select)で period が URL に反映され表示が更新される', async ({ page }) => {
    await page.goto('/activities');
    // 既定は week
    await expect(page.locator('select[aria-label="期間"]')).toHaveValue('week');
    await page.locator('select[aria-label="期間"]').selectOption('month');
    await page.waitForURL(/period=month/);
    await expect(page.locator('select[aria-label="期間"]')).toHaveValue('month');
    // 件数表示（内訳ヘッダ）が存在する
    await expect(page.locator('.side-col .panel-head .count').first()).toContainText('件');
  });

  test('種別フィルタ(select)で kind が URL に反映される', async ({ page }) => {
    await page.goto('/activities?period=all');
    await page.locator('select[aria-label="種別"]').selectOption('議事録');
    await page.waitForURL(/kind=/);
    expect(decodeURIComponent(page.url())).toContain('kind=議事録');
    await expect(page.locator('select[aria-label="種別"]')).toHaveValue('議事録');
    // 表示されるイベントカードの種別タグはすべて「議事録」（0件なら空メッセージ）
    const evs = page.locator('.tl .ev');
    const n = await evs.count();
    if (n > 0) {
      for (let i = 0; i < n; i++) {
        await expect(evs.nth(i).locator('.a-tag')).toHaveText('議事録');
      }
    }
  });

  test('担当フィルタ(select)で actor が URL に反映される', async ({ page }) => {
    await page.goto('/activities?period=all');
    await page.locator('select[aria-label="担当"]').selectOption('山田 健太');
    await page.waitForURL(/actor=/);
    // URLSearchParams は空白を + でエンコードする
    expect(page.url()).toContain('actor=' + encodeURIComponent('山田 健太').replace(/%20/g, '+'));
    await expect(page.locator('select[aria-label="担当"]')).toHaveValue('山田 健太');
  });

  test('「＋活動を記録」モーダルでフォーム入力→送信でトーストが出る', async ({ page }) => {
    // 注: record_activity は 200 を返すが、現ビルドではタイムライン(app_list_activities)に
    // 新規行が出現しない（後述の所見参照）。ここではモーダル入力～送信の UI コントラクトを検証する。
    await page.goto('/activities');
    const title = `E2E初回提案フォロー_${Date.now()}`;

    await page.getByRole('button', { name: '＋ 活動を記録' }).click();
    const m = await modal(page);
    await expect(m.locator('.m-head h3')).toHaveText('活動を記録');
    // 種別=電話（既定）、企業=任意、内容=必須、担当=既定。select は2つ（種別・担当）
    await m.locator('select').first().selectOption('面談・訪問');
    await m.locator('input').nth(0).fill('E2Eテスト商事'); // 企業
    await m.locator('input').nth(1).fill(title); // 内容
    await m.locator('select').nth(1).selectOption('佐藤 京子'); // 担当

    await m.getByRole('button', { name: '記録', exact: true }).click();
    await expect(page.locator('.toast', { hasText: '記録しました' })).toBeVisible();
    await expect(page.locator('.scrim .modal')).toHaveCount(0);
  });

  test('「＋活動を記録」で内容未入力なら「内容を入力してください」', async ({ page }) => {
    await page.goto('/activities');
    await page.getByRole('button', { name: '＋ 活動を記録' }).click();
    const m = await modal(page);
    await m.getByRole('button', { name: '記録', exact: true }).click();
    await expect(page.locator('.toast', { hasText: '内容を入力してください' })).toBeVisible();
  });

  test('自動記録イベントは元レコードへのリンクを持つ', async ({ page }) => {
    await page.goto('/activities?period=all');
    // 議事録イベントは source_kind=note → /notes へリンク
    const noteEv = page.locator('.tl a.ev', { hasText: '議事録' }).first();
    if (await noteEv.count()) {
      await expect(noteEv).toHaveAttribute('href', /\/(notes|companies|referrals|newsletters|forms)/);
      const href = await noteEv.getAttribute('href');
      await noteEv.click();
      await page.waitForURL((u) => u.pathname !== '/activities');
      expect(page.url()).toContain((href || '').split('?')[0]);
    }
  });

  test('「使い方」の案内人ツアーが起動し、ESCで閉じる', async ({ page }) => {
    await page.goto('/activities');
    await page.getByRole('button', { name: '使い方' }).click();
    const card = page.locator('.tour-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText('使い方ツアー');
    await expect(card).toContainText('接点の全体量');
    // 次へでステップが進む
    await card.getByRole('button', { name: /次へ|完了/ }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.tour-card')).toHaveCount(0);
  });
});

// ============================================================
test.describe('資料 (/documents)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('画面が表示され、容量バーと統計カードが出る', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/documents');
    await expect(page.locator('.page-head h2')).toHaveText('資料（全社横断）');
    await expect(page.locator('.stats .stat')).toHaveCount(4);
    // 容量バー（合計容量カード内 .progress > i）
    await expect(page.locator('.stat.gold .progress i')).toBeVisible();
    // 検索結果テーブルに行がある
    expect(await page.locator('.panel table.table tbody tr').count()).toBeGreaterThan(0);
    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('キーワード検索で keyword が URL に反映され件数が絞り込まれる', async ({ page }) => {
    await page.goto('/documents');
    const allText = (await page.locator('.panel-head .count.num').textContent()) ?? '';
    const allCount = parseInt(allText.replace(/[^\d]/g, ''), 10);

    const input = page.locator('.filterbar input[aria-label="ファイル名で検索"]');
    await input.fill('商品カタログ');
    await input.press('Enter');
    await page.waitForURL(/keyword=/);
    expect(decodeURIComponent(page.url())).toContain('keyword=商品カタログ');

    // 絞り込み後の行はすべて「商品カタログ」を含む
    const rows = page.locator('.panel table.table tbody tr');
    const n = await rows.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      await expect(rows.nth(i).locator('.fname .nm')).toContainText('商品カタログ');
    }
    // 絞り込み件数 <= 全件
    const filteredCount = parseInt((await page.locator('.panel-head .count.num').textContent() ?? '').replace(/[^\d]/g, ''), 10);
    if (!Number.isNaN(allCount) && !Number.isNaN(filteredCount)) {
      expect(filteredCount).toBeLessThanOrEqual(allCount);
    }
  });

  test('種別フィルタで category が URL に反映され、行の種別が一致する', async ({ page }) => {
    await page.goto('/documents');
    await page.locator('.filterbar select[aria-label="種別"]').selectOption('決算書');
    await page.waitForURL(/category=/);
    expect(decodeURIComponent(page.url())).toContain('category=決算書');
    await expect(page.locator('.filterbar select[aria-label="種別"]')).toHaveValue('決算書');

    const rows = page.locator('.panel table.table tbody tr');
    const n = await rows.count();
    if (n > 0) {
      for (let i = 0; i < n; i++) {
        await expect(rows.nth(i).locator('.cat')).toContainText('決算書');
      }
    }
  });

  test('会社フィルタ・並び替えセレクトが URL に反映される', async ({ page }) => {
    await page.goto('/documents');
    // 会社セレクトの最初の実値を選ぶ
    const companySel = page.locator('.filterbar select[aria-label="会社"]');
    const opts = companySel.locator('option');
    const optCount = await opts.count();
    if (optCount > 1) {
      const val = await opts.nth(1).getAttribute('value');
      await companySel.selectOption(val!);
      await page.waitForURL(/company=/);
      await expect(companySel).toHaveValue(val!);
    }

    // 並び替え
    await page.locator('.filterbar select[aria-label="並び替え"]').selectOption('size');
    await page.waitForURL(/sort=size/);
    await expect(page.locator('.filterbar select[aria-label="並び替え"]')).toHaveValue('size');
  });

  test('会社リンクをクリックすると企業詳細へ遷移する', async ({ page }) => {
    await page.goto('/documents');
    const coLink = page.locator('.panel table.table tbody tr a.co-link').first();
    await expect(coLink).toBeVisible();
    await coLink.click();
    await page.waitForURL(/\/companies\//);
    await expect(page.locator('.sidebar')).toBeVisible();
  });

  test('行クリックでプレビュー（署名URL発行）トーストが出る', async ({ page }) => {
    await page.goto('/documents');
    const firstRow = page.locator('.panel table.table tbody tr').first();
    const fname = (await firstRow.locator('.fname .nm').textContent())?.trim();
    await firstRow.click();
    await expect(page.locator('.toast', { hasText: '署名URLを発行しました' })).toBeVisible();
    if (fname) {
      await expect(page.locator('.toast', { hasText: fname })).toBeVisible();
    }
  });

  test('プレビューボタンでトーストが出る', async ({ page }) => {
    await page.goto('/documents');
    const firstRow = page.locator('.panel table.table tbody tr').first();
    await firstRow.getByRole('button', { name: 'プレビュー' }).click();
    await expect(page.locator('.toast', { hasText: 'プレビュー:' })).toBeVisible();
  });

  test('ダウンロードボタンで署名URL発行トーストが出る', async ({ page }) => {
    await page.goto('/documents');
    const firstRow = page.locator('.panel table.table tbody tr').first();
    // ダウンロード（⤓ アイコンボタン, title=ダウンロード）— 行クリックのプレビューを避けるため stopPropagation 済
    await firstRow.locator('button[title="ダウンロード"]').click();
    // 「署名URLを発行しました」トーストが少なくとも1つ出る（プレビュー文言は含まない）
    await expect(page.locator('.toast', { hasText: '署名URLを発行しました' }).first()).toBeVisible();
  });

  test('該当なしキーワードで「資料がありません」表示になる', async ({ page }) => {
    await page.goto('/documents');
    const input = page.locator('.filterbar input[aria-label="ファイル名で検索"]');
    await input.fill('該当しないファイル名ZZZ_' + Date.now());
    await input.press('Enter');
    await page.waitForURL(/keyword=/);
    await expect(page.locator('.panel table.table tbody', { hasText: '条件に一致する資料がありません' })).toBeVisible();
  });

  test('「使い方」の案内人ツアーが起動し、ESCで閉じる', async ({ page }) => {
    await page.goto('/documents');
    await page.getByRole('button', { name: '使い方' }).click();
    const card = page.locator('.tour-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText('使い方ツアー');
    await expect(card).toContainText('全社の保管状況');
    // 次へでステップが進む
    await card.getByRole('button', { name: /次へ|完了/ }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.tour-card')).toHaveCount(0);
  });
});
