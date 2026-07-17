import { test, expect, type Page } from '@playwright/test';
import { login, trackErrors } from './_helpers';

// 期限・タスク v2（Jira/Redmine風）: 4ビュー・親子課題・行メニュー・課題フォーム/詳細・使い方ツアー。
//
// 状態共有の注意: サーバーは1プロセスでseed状態を共有(workers:1)。
// 破壊的操作は使い捨てエンティティを新規作成して操作し、seedの絶対件数は断定しない。
// 書き込みの永続化は unit(rpc.test.ts) で検証済み。ここでは UI コントラクト（トースト・遷移・描画）を見る。

const PARENT_TITLE = '法人税・消費税 申告（4月決算）'; // seed: 海風マリンの親課題（子3）
const MANUAL_TASK = '現場ヒアリング日程調整'; // seed: source=手動・単独
const AUTO_TASK = '源泉所得税 納期特例分 納付'; // seed: source=自動・単独

async function modal(page: Page) {
  const m = page.locator('.scrim .modal');
  await expect(m).toBeVisible();
  return m;
}

test.describe('期限・タスク (/schedule)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('画面表示: 統計4枚・課題ツリー（親課題・遅延行）が出る', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/schedule');
    await expect(page.locator('.page-head h2')).toHaveText('期限・タスク');
    await expect(page.locator('.stats .stat')).toHaveCount(4);
    // 課題パネル: 件数に親課題・子課題の内訳が出る
    await expect(page.locator('.panel-head .count').first()).toContainText('親課題');
    // 親課題行（子課題バッジ .tsub）と遅延行が出る
    await expect(page.locator('#view-list .tsub').first()).toBeVisible();
    expect(await page.locator('#view-list tr.overdue-row').count()).toBeGreaterThan(0);
    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('スコープタブで顧客の課題／所内の課題を絞り込める', async ({ page }) => {
    await page.goto('/schedule');
    // 所内の課題へ
    await page.locator('.scope-tabs button', { hasText: '所内の課題' }).click();
    await expect(page.locator('#view-list .office-co').first()).toBeVisible();
    await expect(page.locator('#view-list tr', { hasText: AUTO_TASK })).toHaveCount(0);
    // すべてに戻す
    await page.locator('.scope-tabs button', { hasText: 'すべて' }).click();
    await expect(page.locator('#view-list tr', { hasText: AUTO_TASK }).first()).toBeVisible();
  });

  test('ビュー切替: ボード・ガント・カレンダーが描画される', async ({ page }) => {
    await page.goto('/schedule');
    // ボード（NEW ピル付き）
    await expect(page.locator('#tab-board .new-pip')).toHaveText('NEW');
    await page.locator('#tab-board').click();
    await expect(page.locator('#view-board .klane').first()).toBeVisible();
    expect(await page.locator('#view-board .kcard').count()).toBeGreaterThan(0);
    // ガント（今日線・期間バー）
    await page.locator('#tab-gantt').click();
    await expect(page.locator('#view-gantt .g-today')).toBeVisible();
    expect(await page.locator('#view-gantt .gbar').count()).toBeGreaterThan(0);
    // カレンダー（月ナビとイベント）
    await page.locator('#tab-cal').click();
    await expect(page.locator('#view-cal .cal')).toBeVisible();
    await expect(page.locator('.filterbar [aria-label="前月"]')).toBeVisible();
    expect(await page.locator('#view-cal .ev').count()).toBeGreaterThan(0);
    // 一覧へ戻る
    await page.locator('#tab-list').click();
    await expect(page.locator('#view-list table')).toBeVisible();
  });

  test('一覧: 親課題の ▾ で子課題を開閉できる', async ({ page }) => {
    await page.goto('/schedule');
    const before = await page.locator('#view-list tr.child').count();
    expect(before).toBeGreaterThan(0);
    await page.locator('#view-list tr', { hasText: PARENT_TITLE }).first().locator('.tw').click();
    const after = await page.locator('#view-list tr.child').count();
    expect(after).toBeLessThan(before);
    // 再度開く
    await page.locator('#view-list tr', { hasText: PARENT_TITLE }).first().locator('.tw').click();
    await expect(page.locator('#view-list tr.child')).toHaveCount(before);
  });

  test('一覧: 丸チェックで完了トーストが出る', async ({ page }) => {
    await page.goto('/schedule');
    const row = page.locator('#view-list tr', { hasText: MANUAL_TASK }).first();
    await expect(row).toBeVisible();
    await row.locator('.chk').click();
    await expect(page.locator('.toast', { hasText: '完了' }).first()).toBeVisible();
  });

  test('行の ⋯ メニュー: 手動の課題は全操作、自動生成は削除・期日変更なし', async ({ page }) => {
    await page.goto('/schedule');
    // 手動（単独）
    const manual = page.locator('#view-list tr', { hasText: '試算表の確認・送付' }).first();
    await manual.locator('.kebab').click();
    const menu = page.locator('.rowmenu');
    await expect(menu).toBeVisible();
    for (const label of ['＋ 子課題を追加', '課題を編集', '担当を変更', '期日を変更', '削除']) {
      await expect(menu.getByRole('button', { name: label })).toBeVisible();
    }
    // 自動生成（別の ⋯ をクリックするとメニューが移る）
    const auto = page.locator('#view-list tr', { hasText: AUTO_TASK }).first();
    await auto.locator('.kebab').click();
    await expect(page.locator('.rowmenu')).toBeVisible();
    await expect(page.locator('.rowmenu').getByRole('button', { name: '担当を変更' })).toBeVisible();
    await expect(page.locator('.rowmenu').getByRole('button', { name: '削除' })).toHaveCount(0);
    await expect(page.locator('.rowmenu').getByRole('button', { name: '期日を変更' })).toHaveCount(0);
  });

  test('⋯ → 担当を変更: モーダルで選択→変更トースト', async ({ page }) => {
    await page.goto('/schedule');
    const row = page.locator('#view-list tr', { hasText: MANUAL_TASK }).first();
    await row.locator('.kebab').click();
    await page.locator('.rowmenu').getByRole('button', { name: '担当を変更' }).click();
    const m = await modal(page);
    await expect(m.locator('.m-head h3')).toHaveText('担当を変更');
    await m.locator('select').selectOption({ label: '佐藤 京子' });
    await m.getByRole('button', { name: '変更', exact: true }).click();
    await expect(page.locator('.toast', { hasText: '変更しました' })).toBeVisible();
  });

  test('ボード: 親課題レーンに 未対応/対応中/完了 の3列とカードが出る', async ({ page }) => {
    await page.goto('/schedule?view=board');
    const lane = page.locator('#view-board .klane', { hasText: PARENT_TITLE });
    await expect(lane).toBeVisible();
    await expect(lane.locator('.kcol')).toHaveCount(3);
    // 子課題カードがどこかの列に入っている
    await expect(lane.locator('.kcard', { hasText: '所内レビュー・修正' })).toBeVisible();
    // 単独の課題レーン
    await expect(page.locator('#view-board .klane', { hasText: '単独の課題' })).toBeVisible();
  });

  test('行クリックで課題詳細へ: 説明・子課題・コメント・変更履歴・詳細kv', async ({ page }) => {
    await page.goto('/schedule');
    await page.locator('#view-list tr', { hasText: PARENT_TITLE }).first().locator('.tname').click();
    await page.waitForURL(/\/schedule\/[0-9a-f-]+/);
    await expect(page.locator('.page-head h2')).toHaveText(PARENT_TITLE);
    await expect(page.locator('.panel-head h3', { hasText: '説明' })).toBeVisible();
    const kids = page.locator('.panel', { has: page.locator('.panel-head h3', { hasText: '子課題' }) });
    await expect(kids.locator('.subrow')).toHaveCount(3);
    await expect(page.locator('.panel-head h3', { hasText: 'コメント' })).toBeVisible();
    expect(await page.locator('.cmt').count()).toBeGreaterThanOrEqual(2);
    await expect(page.locator('.panel-head h3', { hasText: '変更履歴' })).toBeVisible();
    expect(await page.locator('.hist .h').count()).toBeGreaterThanOrEqual(3);
    // 詳細kv: 進捗は子課題から自動集計
    await expect(page.locator('.kv', { hasText: '進捗' }).first()).toContainText('自動集計');
  });

  test('課題詳細: コメント投稿でトースト・空はエラー', async ({ page }) => {
    await page.goto('/schedule');
    await page.locator('#view-list tr', { hasText: PARENT_TITLE }).first().locator('.tname').click();
    await page.waitForURL(/\/schedule\/[0-9a-f-]+/);
    // 空投稿
    await page.getByRole('button', { name: '投稿' }).click();
    await expect(page.locator('.toast', { hasText: 'コメントを入力してください' })).toBeVisible();
    // 投稿
    await page.locator('textarea').fill(`E2Eコメント_${Date.now()}`);
    await page.getByRole('button', { name: '投稿' }).click();
    await expect(page.locator('.toast', { hasText: 'コメントを投稿しました' })).toBeVisible();
  });

  test('課題フォーム: 企業を選ぶまでロック→選択で解放→作成トースト', async ({ page }) => {
    await page.goto('/schedule');
    await page.locator('#add-task-btn').click();
    await page.waitForURL(/\/schedule\/new/);
    await expect(page.locator('.page-head h2')).toHaveText('課題を作成');
    // 企業未選択の間は gated.off
    expect(await page.locator('.gated.off').count()).toBeGreaterThan(0);
    // 企業検索コンボ → 海風 → 選択
    const cbx = page.locator('.combo input');
    await cbx.fill('海風');
    await page.locator('.cbx-item', { hasText: '海風マリン' }).click();
    await expect(page.locator('.toast', { hasText: '選択しました' })).toBeVisible();
    await expect(page.locator('.gated.off')).toHaveCount(0);
    // 題名未入力で作成 → バリデーション
    await page.getByRole('button', { name: '作成', exact: true }).click();
    await expect(page.locator('.toast', { hasText: '題名を入力してください' })).toBeVisible();
    // 入力して作成
    await page.locator('input[placeholder*="法人税"]').fill(`E2E課題_${Date.now()}`);
    await page.getByRole('button', { name: '作成', exact: true }).click();
    await expect(page.locator('.toast', { hasText: '課題を作成しました' })).toBeVisible();
  });

  test('課題フォーム: 所内の課題は企業不要・種別が所内業務になる', async ({ page }) => {
    await page.goto('/schedule/new');
    await page.locator('.scope-pick label', { hasText: '所内の課題' }).click();
    await expect(page.locator('.gated.off')).toHaveCount(0);
    await expect(page.locator('.combo input')).toBeDisabled();
    // 種別セレクト（基本情報の最初のselect群から label で特定）
    const kind = page.locator('.field', { has: page.locator('label', { hasText: '種別' }) }).locator('select');
    await expect(kind).toHaveValue('所内業務');
  });

  test('⋯ → 子課題を追加: 親・区分・企業が引き継がれ固定される', async ({ page }) => {
    await page.goto('/schedule');
    const parentRow = page.locator('#view-list tr', { hasText: PARENT_TITLE }).first();
    await parentRow.locator('.kebab').click();
    await page.locator('.rowmenu').getByRole('button', { name: '＋ 子課題を追加' }).click();
    await page.waitForURL(/\/schedule\/new\?parent=/);
    await expect(page.locator('.page-head h2')).toHaveText('子課題を作成');
    await expect(page.locator('.page-head .sub')).toContainText(PARENT_TITLE);
    // 親課題は固定表示・企業コンボは入力不可
    await expect(page.locator('.field', { has: page.locator('label', { hasText: '親課題' }) }).locator('input')).toHaveValue(PARENT_TITLE);
    await expect(page.locator('.combo input')).toBeDisabled();
  });

  test('使い方ツアー: スポットライトとステップ送り・ESCで終了', async ({ page }) => {
    await page.goto('/schedule');
    await page.getByRole('button', { name: '使い方' }).click();
    const card = page.locator('.tour-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText('使い方ツアー');
    await expect(card).toContainText('顧客と所内の課題を切り替える');
    await expect(card).toContainText('1/6');
    await expect(page.locator('.tour-spot')).toBeVisible();
    // 次へ → step2（ビュー切替）
    await card.getByRole('button', { name: '次へ' }).click();
    await expect(card).toContainText('2/6');
    await expect(card).toContainText('4つの見え方');
    // 次へ → step3 は before でボードビューに切り替わる
    await card.getByRole('button', { name: '次へ' }).click();
    await expect(card).toContainText('カードをドラッグ');
    await expect(page.locator('#view-board .klane').first()).toBeVisible();
    // 戻る
    await card.getByRole('button', { name: '戻る' }).click();
    await expect(card).toContainText('2/6');
    // ESC で終了
    await page.keyboard.press('Escape');
    await expect(page.locator('.tour-card')).toHaveCount(0);
    await expect(page.locator('.tour-spot')).toHaveCount(0);
  });

  test('使い方ツアー: 最後まで進むと「完了」で閉じる', async ({ page }) => {
    await page.goto('/schedule');
    await page.getByRole('button', { name: '使い方' }).click();
    const card = page.locator('.tour-card');
    await expect(card).toBeVisible();
    for (let i = 0; i < 5; i++) {
      await card.getByRole('button', { name: '次へ' }).click();
    }
    await expect(card).toContainText('準備ができました');
    await card.getByRole('button', { name: '完了' }).click();
    await expect(page.locator('.tour-card')).toHaveCount(0);
  });

  test('ボードNEW告知（featureツアー）は初回のみ表示され、CTAでボードへ', async ({ page }) => {
    await page.goto('/schedule');
    // login() の initScript は毎ロードでフラグを既読化するため、次の1回だけ後から取り消す
    // （sessionStorage ガードで「初回のみ」挙動を再現する）
    await page.addInitScript(() => {
      try {
        if (!sessionStorage.getItem('e2e.board.cleared')) {
          sessionStorage.setItem('e2e.board.cleared', '1');
          localStorage.removeItem('daikichi.schedule.board.v1');
        }
      } catch { /* noop */ }
    });
    await page.reload();
    const card = page.locator('.tour-card');
    await expect(card).toBeVisible({ timeout: 5000 });
    await expect(card).toContainText('新機能');
    await expect(card).toContainText('ボードビュー');
    await card.getByRole('button', { name: '試してみる' }).click();
    await expect(page.locator('#view-board .klane').first()).toBeVisible();
    // 再読込では出ない（既読化済み）
    await page.reload();
    await page.waitForTimeout(1200);
    await expect(page.locator('.tour-card')).toHaveCount(0);
  });

  test('担当フィルタで URL クエリが更新される', async ({ page }) => {
    await page.goto('/schedule');
    await page.locator('.filterbar select[aria-label="担当"]').selectOption('佐藤 京子');
    await page.waitForURL(/assignee=/);
    await expect(page.locator('.filterbar select[aria-label="担当"]')).toHaveValue('佐藤 京子');
  });

  test('種別フィルタで URL クエリ kind が付与される', async ({ page }) => {
    await page.goto('/schedule');
    await page.locator('.filterbar select[aria-label="種別"]').selectOption('手動タスク');
    await page.waitForURL(/kind=/);
    expect(decodeURIComponent(page.url())).toContain('kind=手動タスク');
    await expect(page.locator('.filterbar select[aria-label="種別"]')).toHaveValue('手動タスク');
  });

  test('「未完了のみ」トグルで status=open が付き、ピルで解除できる', async ({ page }) => {
    await page.goto('/schedule');
    await page.getByRole('button', { name: '未完了のみ' }).click();
    await page.waitForURL(/status=open/);
    const pill = page.locator('.filter-pill', { hasText: '未完了のみ' });
    await expect(pill).toBeVisible();
    await pill.locator('.x').click();
    await page.waitForURL((u) => !u.search.includes('status=open'));
    await expect(page.getByRole('button', { name: '未完了のみ' })).toBeVisible();
  });

  test('トップバー検索(q)で題名・企業を絞り込める', async ({ page }) => {
    await page.goto('/schedule');
    const input = page.locator('.topbar .search input');
    await input.fill('海風');
    await input.press('Enter');
    await page.waitForURL(/q=/);
    // 一覧は海風マリン関連のみ
    await expect(page.locator('#view-list tr', { hasText: PARENT_TITLE }).first()).toBeVisible();
    await expect(page.locator('#view-list tr', { hasText: MANUAL_TASK })).toHaveCount(0);
  });

  test('カレンダー書出ボタンで .ics がダウンロードされる', async ({ page }) => {
    await page.goto('/schedule');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'カレンダー書出' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.ics$/);
    await expect(page.locator('.toast', { hasText: 'カレンダー' })).toBeVisible();
  });
});
