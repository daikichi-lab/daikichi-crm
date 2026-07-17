import { test, expect, type Page } from '@playwright/test';
import { login, SEED, trackErrors } from './_helpers';

// 担当: メルマガ — 一覧(/newsletters)・作成(/newsletters/compose)・結果(/newsletters/[id])
//
// seed 状態メモ（supabase/seed/seed.sql）:
// - newsletter_topics: 税制改正ニュース / セミナー・勉強会案内 / 経営お役立ち情報 / 年末調整のお知らせ / 決算前リマインド
// - newsletters(1・送信済): id=cccccccc-...0001「税制改正ニュース 6月号」
//     topic=税制改正ニュース / target 38・送信 36・失敗 0・停止スキップ 2 / 2026-06-20 09:00 送信
//   recipients(3): 佐藤 太郎(送信) / 田中 啓介(送信) / 鈴木 大輔(停止スキップ)
//   ※ recipients のメールは app_mask_email でマスクされて返る。
// - opt_in=true の担当者: 佐藤太郎・緑川・佐藤花子・田中啓介・北野・日向・高橋 = 7名
//   ⇒ トピック未選択（全購読者）の送信対象 = 7名。
//   「税制改正ニュース」購読(opt_in)= 佐藤太郎・田中啓介 = 2名。
//
// 破壊的操作（下書き保存・送信・複製）は seed を壊さないよう **新規に作る**。
// 既存 seed の送信済メルマガ(cccc...0001)は読み取り専用で扱う。
const SEED_NL_SUBJECT = '税制改正ニュース 6月号';
const SEED_NL_ID = 'cccccccc-0000-0000-0000-000000000001';

// 作成画面の「送信対象 N 人」から数値を読む（ライブ更新待ちは呼び出し側で）。
async function readNum(page: Page): Promise<number> {
  const t = (await page.locator('.target-num').textContent()) ?? '';
  const m = t.match(/\d+/);
  return m ? Number(m[0]) : NaN;
}

test.describe('メルマガ一覧 /newsletters', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('一覧が表示され、見出し・統計・seedの送信済が出る', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/newsletters');
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('.page-head h2')).toContainText('メルマガ配信');

    // 統計カード（配信トピック数 = seed 5件）
    const stats = page.locator('.stats .stat');
    await expect(stats).toHaveCount(4);
    // 配信トピック数（seed 5件。admin がトピック追加すると増えるため数値であることのみ検証）
    await expect(page.locator('.stat.gold .v')).toHaveText(/\d+/);

    // seed の送信済メルマガが行に出る（件名・トピック・状態バッジ）
    const row = page.locator('table.table tbody tr', { hasText: SEED_NL_SUBJECT });
    await expect(row).toBeVisible();
    await expect(row.locator('.topic', { hasText: '税制改正ニュース' })).toBeVisible();
    await expect(row.locator('.badge.sent')).toContainText('送信済');
    // 失敗ではないので対象は単一数（38）
    await expect(row.locator('td.right.num').first()).toContainText('38');

    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('「＋ メルマガを作成」で作成画面へ遷移する', async ({ page }) => {
    await page.goto('/newsletters');
    await page.getByRole('link', { name: /メルマガを作成/ }).click();
    await expect(page).toHaveURL(/\/newsletters\/compose$/);
    await expect(page.locator('.page-head h2')).toContainText('メルマガを作成');
  });

  test('topbar「配信トピック」リンクでマスタ管理へ遷移する', async ({ page }) => {
    await page.goto('/newsletters');
    await page.getByRole('link', { name: '配信トピック' }).click();
    await expect(page).toHaveURL(/\/admin\/masters/);
  });

  test('「使い方」の案内人ツアーが起動し、ESCで閉じる', async ({ page }) => {
    await page.goto('/newsletters');
    await page.getByRole('button', { name: '使い方' }).click();
    const card = page.locator('.tour-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText('使い方ツアー');
    await expect(card).toContainText('配信の全体像');
    // 次へでステップが進む
    await card.getByRole('button', { name: /次へ|完了/ }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.tour-card')).toHaveCount(0);
  });

  test('状態フィルタ（送信済 / 下書き）で行が絞り込まれる', async ({ page }) => {
    await page.goto('/newsletters');
    // 送信済 → seed の送信済が残る
    await page.getByLabel('状態').selectOption('送信済');
    await expect(page).toHaveURL(/status=%E9%80%81%E4%BF%A1%E6%B8%88|status=送信済/);
    await expect(page.locator('table.table tbody tr', { hasText: SEED_NL_SUBJECT })).toBeVisible();

    // 「下書き」に切替 → seed の送信済は消える（下書きが無ければ空行メッセージ）
    await page.getByLabel('状態').selectOption('下書き');
    await expect(page.locator('table.table tbody tr', { hasText: SEED_NL_SUBJECT })).toHaveCount(0);
  });

  test('トピックフィルタで税制改正ニュースの配信のみ残る', async ({ page }) => {
    await page.goto('/newsletters');
    await page.getByLabel('トピック').selectOption('税制改正ニュース');
    await expect(page.locator('table.table tbody tr', { hasText: SEED_NL_SUBJECT })).toBeVisible();

    // 一致しないトピックに切替 → seed のメルマガは消える
    await page.getByLabel('トピック').selectOption('決算前リマインド');
    await expect(page.locator('table.table tbody tr', { hasText: SEED_NL_SUBJECT })).toHaveCount(0);
  });

  test('送信済の行クリックで結果画面へ遷移する', async ({ page }) => {
    await page.goto('/newsletters');
    await page.locator('table.table tbody tr', { hasText: SEED_NL_SUBJECT }).click();
    await expect(page).toHaveURL(new RegExp(`/newsletters/${SEED_NL_ID}`));
    await expect(page.locator('.page-head h2')).toContainText(SEED_NL_SUBJECT);
  });

  test('行の「複製」ボタンで下書きが作られ作成画面へ遷移する（toast）', async ({ page }) => {
    await page.goto('/newsletters');
    const row = page.locator('table.table tbody tr', { hasText: SEED_NL_SUBJECT });
    // 行クリックでの遷移を防ぐため複製ボタンだけを押す（parts.tsx で stopPropagation 済）
    await row.getByRole('button', { name: '複製' }).click();
    await expect(page.locator('.toast', { hasText: '複製しました' })).toBeVisible();
    // 複製された下書きの編集画面（id 付き compose）へ遷移する
    await expect(page).toHaveURL(/\/newsletters\/compose\?id=[0-9a-f-]{36}/);
    await expect(page.locator('.page-head h2')).toContainText('メルマガを作成');
  });
});

test.describe('メルマガ作成 /newsletters/compose', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('作成画面の主要要素（件名・本文・トピック・送信ボタン）が出る', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/newsletters/compose');
    await expect(page.locator('.page-head h2')).toContainText('メルマガを作成');

    await expect(page.getByPlaceholder('件名を入力')).toBeVisible();
    await expect(page.locator('textarea.body-input')).toBeVisible();
    // 宛先パネルのトピックチップ（seed 5件以上。admin追加で増える）
    expect(await page.locator('.chips .topic').count()).toBeGreaterThanOrEqual(5);
    // 送信ボタン（人数表示つき）
    await expect(page.locator('.btn-primary', { hasText: /人に送信/ })).toBeVisible();

    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('トピック選択で送信対象人数がライブ更新される', async ({ page }) => {
    await page.goto('/newsletters/compose');
    const targetNum = page.locator('.target-num');

    // 初期（トピック未選択＝全購読者）。共有状態のため絶対値は断定せず数値を取得。
    await expect(targetNum).not.toContainText('…');
    const initial = await readNum(page);
    expect(initial).toBeGreaterThan(0);

    // 税制改正ニュース購読（seed=佐藤太郎・田中啓介）を選ぶと対象は減る
    await page.locator('.chips .topic', { hasText: '税制改正ニュース' }).click();
    await expect(targetNum).toContainText('2'); // seed の購読者は2名（他specの新規顧客は税制改正を購読しない）
    const taxN = await readNum(page);
    expect(taxN).toBeLessThan(initial);
    // 送信ボタンの人数表示も同期する
    await expect(page.locator('.btn-primary')).toContainText(`${taxN}人に送信`);

    // サンプル（例: …）が表示される
    await expect(page.getByText('例:', { exact: false })).toBeVisible();
  });

  test('属性セグメント（ステータス・業種）で対象人数がさらに絞り込まれる', async ({ page }) => {
    await page.goto('/newsletters/compose');
    const targetNum = page.locator('.target-num');
    await expect(targetNum).not.toContainText('…');
    const initial = await readNum(page);

    // ステータス=見込み で絞ると顧問中の購読者が外れ、対象が減る（相対比較で堅牢に）
    await page.getByLabel('ステータス').selectOption('見込み');
    await expect(targetNum).not.toContainText('…');
    const mikomiN = await readNum(page);
    expect(mikomiN).toBeLessThanOrEqual(initial);

    // 業種=飲食 をさらに重ねると、見込み単独以下になる
    await page.getByLabel('業種').selectOption('飲食');
    await expect(targetNum).not.toContainText('…');
    const foodN = await readNum(page);
    expect(foodN).toBeLessThanOrEqual(mikomiN);
  });

  test('差し込み変数チップで本文にプレースホルダが挿入される', async ({ page }) => {
    await page.goto('/newsletters/compose');
    const body = page.locator('textarea.body-input');
    await expect(body).toHaveValue('');
    await page.locator('.merge', { hasText: '{{氏名}}' }).click();
    await expect(body).toHaveValue(/\{\{氏名\}\}/);
  });

  test('リンク挿入チップで本文にリンクが入り toast が出る', async ({ page }) => {
    await page.goto('/newsletters/compose');
    const body = page.locator('textarea.body-input');
    await page.locator('.merge.link', { hasText: '顧客情報フォーム' }).click();
    await expect(page.locator('.toast', { hasText: 'リンクを本文に挿入しました' })).toBeVisible();
    await expect(body).toHaveValue(/お客様情報フォーム/);
  });

  test('「Claudeで下書き」ボタンで手元Claude（MCP）依頼の案内 toast が出る', async ({ page }) => {
    await page.goto('/newsletters/compose');
    await page.getByRole('button', { name: /Claudeで下書き/ }).click();
    await expect(page.locator('.toast', { hasText: '手元のClaude（MCP）' })).toBeVisible();
  });

  test('下書き保存で toast が出て、id 付き URL に置き換わる（新規ドラフト作成）', async ({ page }) => {
    await page.goto('/newsletters/compose');
    const subject = `E2E下書き ${Date.now()}`;
    await page.getByPlaceholder('件名を入力').fill(subject);
    await page.locator('textarea.body-input').fill('テスト本文です。');

    await page.getByRole('button', { name: '下書き保存' }).click();
    // 保存成功の toast（saveNewsletterDraft が id を返したことを示す）
    await expect(page.locator('.toast', { hasText: '下書きを保存しました' })).toBeVisible();
    // 新規ドラフト → サーバーが採番した id 付き compose へ URL が replace される
    await expect(page).toHaveURL(/\/newsletters\/compose\?id=[0-9a-f-]{36}/);
    // 入力した件名はクライアント状態として保持される
    await expect(page.getByPlaceholder('件名を入力')).toHaveValue(subject);
  });

  test('予約送信トグルで日時入力が現れ、ボタン文言が変わる', async ({ page }) => {
    await page.goto('/newsletters/compose');
    await expect(page.locator('input[type=date]')).toHaveCount(0);
    await page.getByRole('radio', { name: '予約送信' }).check();
    await expect(page.locator('input[type=date]')).toBeVisible();
    await expect(page.locator('input[type=time]')).toBeVisible();
    await expect(page.locator('.btn-primary').last()).toContainText('予約を確定');
  });

  test('送信ボタンの確認ダイアログ：キャンセルで閉じる', async ({ page }) => {
    await page.goto('/newsletters/compose');
    await page.getByPlaceholder('件名を入力').fill(`E2E確認 ${Date.now()}`);
    await page.locator('textarea.body-input').fill('本文。');
    await page.locator('.chips .topic', { hasText: '税制改正ニュース' }).click();
    await expect(page.locator('.target-num')).toContainText('2');

    // 「今すぐ送信」ボタン → 確認ダイアログ（.scrim .modal）に人数が出る
    await page.locator('.btn-primary', { hasText: /人に送信/ }).click();
    const modal = page.locator('.scrim .modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('h3')).toContainText('2人にメルマガを送信しますか');
    await expect(modal.locator('.m-body')).toContainText('同意あり・配信停止していない');

    // キャンセルで閉じ、ページに留まる（送信されない）
    await modal.getByRole('button', { name: 'キャンセル' }).click();
    await expect(page.locator('.scrim .modal')).toHaveCount(0);
    await expect(page).toHaveURL(/\/newsletters\/compose/);
  });

  test('送信を確定すると結果画面（/newsletters/<uuid>）へ遷移する（使い捨て送信）', async ({ page }) => {
    await page.goto('/newsletters/compose');
    const subject = `E2E送信テスト ${Date.now()}`;
    await page.getByPlaceholder('件名を入力').fill(subject);
    await page.locator('textarea.body-input').fill('{{会社名}} ご担当者さま\n本文。');

    // トピック=税制改正ニュース → seed 購読者2名（既存 seed は壊さず新規メルマガを作る）
    await page.locator('.chips .topic', { hasText: '税制改正ニュース' }).click();
    await expect(page.locator('.target-num')).toContainText('2');

    await page.locator('.btn-primary', { hasText: /人に送信/ }).click();
    await page.locator('.scrim .modal').getByRole('button', { name: '送信する' }).click();

    // sendNewsletterAction は送信後に新規メルマガの結果画面へ redirect する
    // （送信＝seed を変更しない新規 newsletters 行の作成。URL が結果画面に変わることで送信完了を確認）
    await expect(page).toHaveURL(/\/newsletters\/[0-9a-f-]{36}$/);
    // compose 画面ではなくなっている（送信フローが完了して遷移したこと）
    await expect(page).not.toHaveURL(/\/compose/);
  });
});

test.describe('メルマガ結果 /newsletters/[id]', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('seedの送信済の結果画面に集計・明細・本文プレビューが出る', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(`/newsletters/${SEED_NL_ID}`);
    await expect(page.locator('.page-head h2')).toContainText(SEED_NL_SUBJECT);
    await expect(page.locator('.page-head .badge.sent')).toContainText('送信済');

    // 集計カード（対象38・送信済36・失敗0・配信停止スキップ2）
    const stats = page.locator('.stats .stat');
    await expect(stats.nth(0).locator('.v')).toContainText('38'); // 対象
    await expect(stats.nth(1).locator('.v')).toContainText('36'); // 送信済
    await expect(stats.nth(4).locator('.v')).toContainText('2');  // 配信停止スキップ

    // 配信明細（宛先ごと）3件
    const recPanel = page.locator('.panel', { hasText: '配信明細（宛先ごと）' });
    await expect(recPanel).toBeVisible();
    await expect(recPanel.locator('.count')).toContainText('3');
    await expect(recPanel.locator('tbody tr', { hasText: '佐藤 太郎' })).toBeVisible();
    await expect(recPanel.locator('tbody tr', { hasText: '鈴木 大輔' }).locator('.badge.skip')).toContainText('配信停止スキップ');

    // 本文プレビュー（件名と本文断片）
    const preview = page.locator('.panel', { hasText: '本文プレビュー' });
    await expect(preview).toBeVisible();
    await expect(preview).toContainText(SEED_NL_SUBJECT);
    await expect(preview).toContainText('税制改正');

    // メタ情報パネル（配信トピック・送信者）
    const meta = page.locator('.panel', { hasText: 'この配信について' });
    await expect(meta.locator('.topic', { hasText: '税制改正ニュース' })).toBeVisible();
    await expect(meta).toContainText('大吉会計事務所');

    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('配信明細の状態フィルタで「停止スキップ」のみに絞れる', async ({ page }) => {
    await page.goto(`/newsletters/${SEED_NL_ID}`);
    const recPanel = page.locator('.panel', { hasText: '配信明細（宛先ごと）' });
    // すべて = 3 行
    await expect(recPanel.locator('tbody tr')).toHaveCount(3);

    await recPanel.getByLabel('状態で絞り込み').selectOption('停止スキップ');
    // 停止スキップは鈴木 大輔の1件のみ
    await expect(recPanel.locator('tbody tr')).toHaveCount(1);
    await expect(recPanel.locator('tbody tr', { hasText: '鈴木 大輔' })).toBeVisible();

    // 送信済に切替 → 2件（佐藤太郎・田中啓介）
    await recPanel.getByLabel('状態で絞り込み').selectOption('送信');
    await expect(recPanel.locator('tbody tr')).toHaveCount(2);
  });

  test('結果画面の「複製して再利用」で下書きが作られ作成画面へ（toast）', async ({ page }) => {
    await page.goto(`/newsletters/${SEED_NL_ID}`);
    await page.getByRole('button', { name: '複製して再利用' }).click();
    await expect(page.locator('.toast', { hasText: '複製しました' })).toBeVisible();
    await expect(page).toHaveURL(/\/newsletters\/compose\?id=[0-9a-f-]{36}/);
    await expect(page.locator('.page-head h2')).toContainText('メルマガを作成');
  });

  test('結果画面の「CSV書き出し」でダウンロードが発火し toast が出る', async ({ page }) => {
    await page.goto(`/newsletters/${SEED_NL_ID}`);
    const dl = page.waitForEvent('download');
    await page.getByRole('button', { name: 'CSV書き出し' }).click();
    const download = await dl;
    expect(download.suggestedFilename()).toContain('recipients.csv');
    await expect(page.locator('.toast', { hasText: 'CSVで書き出しました' })).toBeVisible();
  });

  test('送信済の詳細で recipients を確認できる', async ({ page }) => {
    // 行クリック遷移は別テストでカバー済み。ここは seed 配信の明細(3件)を直接検証。
    await page.goto(`/newsletters/${SEED_NL_ID}`);
    const recPanel = page.locator('.panel', { hasText: '配信明細（宛先ごと）' });
    await expect(recPanel.locator('tbody tr')).toHaveCount(3);
  });
});
