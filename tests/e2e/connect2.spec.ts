import { test, expect, type Page } from '@playwright/test';
import { login, SEED, trackErrors } from './_helpers';

// 担当: 連携(2) — 打ち合わせ(/meetings)・議事録(/notes, /notes/[id])
//
// seed 状態メモ（supabase/seed/seed.sql）:
// - meetings(2): 「EC協業の打ち合わせ」(大吉商事, 2026-06-19) /「6月度 定例MTG」(テック合同会社, 2026-06-23)
//   どちらも company_id 付き = 自動リンク。TODAY=2026-06-24 なので両方「これまでの打ち合わせ」。
// - notes(2): 同名タイトル・source=Notta（自動保存）。
//   「6月度 定例MTG」の next_actions = [出荷量データを共有 / 見積もりの提示 / 次回日程の調整]
//   「EC協業の打ち合わせ」の next_actions = [商品カタログの共有 / 配送代行の条件整理]
// PGlite はサーバープロセス内で永続するため、todo の完了（破壊的）は同一リストを再投入して復元する。

test.describe('打ち合わせ /meetings', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('一覧が表示され、パネル・件数・会議カードが出る', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/meetings');
    await expect(page.locator('.sidebar')).toBeVisible();
    await expect(page.locator('.page-head h2')).toContainText('打ち合わせ');

    // 「これまでの打ち合わせ」パネルに seed の2件が出る
    const pastPanel = page.locator('.panel', { hasText: 'これまでの打ち合わせ' });
    await expect(pastPanel).toBeVisible();
    await expect(pastPanel.locator('.mtg', { hasText: 'EC協業の打ち合わせ' })).toBeVisible();
    await expect(pastPanel.locator('.mtg', { hasText: '6月度 定例MTG' })).toBeVisible();

    // 会議カードのバッジ（取込済）
    await expect(page.locator('.rec-badge.done').first()).toBeVisible();

    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('会議カードの会社リンクで会社詳細へ遷移する', async ({ page }) => {
    await page.goto('/meetings');
    const card = page.locator('.mtg', { hasText: 'EC協業の打ち合わせ' });
    await expect(card).toBeVisible();

    // カード内「顧客を開く」ボタン（linked のときのみ表示）
    const open = card.getByRole('link', { name: '顧客を開く' });
    await expect(open).toBeVisible();
    await open.click();
    await expect(page).toHaveURL(new RegExp(`/companies/${SEED.daikichi}`));
    await expect(page.locator('.sidebar')).toBeVisible();
  });

  test('会議カードの「議事録」リンクで議事録一覧へ遷移する', async ({ page }) => {
    await page.goto('/meetings');
    const card = page.locator('.mtg', { hasText: 'EC協業の打ち合わせ' });
    const notesLink = card.getByRole('link', { name: '議事録' });
    await expect(notesLink).toBeVisible();
    await notesLink.click();
    await expect(page).toHaveURL(/\/notes$/);
    await expect(page.locator('.page-head h2')).toContainText('議事録');
  });

  test('会社名インラインリンク（メールから自動リンク）も会社詳細へ', async ({ page }) => {
    await page.goto('/meetings');
    const card = page.locator('.mtg', { hasText: 'EC協業の打ち合わせ' });
    // cust-pill 内の会社名リンク
    const inline = card.locator('.cust-pill a');
    await expect(inline).toBeVisible();
    await inline.click();
    await expect(page).toHaveURL(new RegExp(`/companies/${SEED.daikichi}`));
  });

  test('再同期ボタンで toast が出る', async ({ page }) => {
    await page.goto('/meetings');
    const btn = page.getByRole('button', { name: '再同期' });
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
    await btn.click();
    await expect(page.locator('.toast')).toContainText('カレンダーを再同期しました');
  });

  test('検索フォームは送信で /meetings?q= に遷移する', async ({ page }) => {
    await page.goto('/meetings');
    const input = page.locator('form.search input[name=q]');
    await expect(input).toBeVisible();
    await input.fill('佐藤');
    await input.press('Enter');
    await expect(page).toHaveURL(/\/meetings\?q=%E4%BD%90%E8%97%A4|\/meetings\?q=/);
    await expect(page.locator('.page-head h2')).toContainText('打ち合わせ');
  });

  test('使い方ガイドが開閉できる', async ({ page }) => {
    await page.goto('/meetings');
    await page.getByRole('button', { name: /使い方|打ち合わせの使い方/ }).first().click();
    const modal = page.locator('.scrim .modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('打ち合わせの使い方');
    await modal.getByRole('button', { name: 'とじる' }).click();
    await expect(modal).toBeHidden();
  });
});

test.describe('議事録一覧 /notes', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('一覧に seed の議事録が表示される', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/notes');
    await expect(page.locator('.page-head h2')).toContainText('議事録');

    const recent = page.locator('.panel', { hasText: '最近の議事録' });
    await expect(recent).toBeVisible();
    await expect(recent.locator('a.note', { hasText: '6月度 定例MTG' })).toBeVisible();
    await expect(recent.locator('a.note', { hasText: 'EC協業の打ち合わせ' })).toBeVisible();
    // Notta = 自動保存ピル
    await expect(recent.locator('a.note').first().locator('.pill', { hasText: '自動保存' })).toBeVisible();

    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('議事録の行クリックで詳細へ遷移する', async ({ page }) => {
    await page.goto('/notes');
    const row = page.locator('a.note', { hasText: '6月度 定例MTG' });
    await expect(row).toBeVisible();
    await row.click();
    await expect(page).toHaveURL(/\/notes\/[0-9a-f-]+$/);
    await expect(page.locator('.page-head h2')).toContainText('6月度 定例MTG');
  });

  test('取り込みボタン（topbar）で toast が出る', async ({ page }) => {
    await page.goto('/notes');
    const btn = page.getByRole('button', { name: '＋ 議事録を取り込む' });
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(page.locator('.toast')).toContainText('議事録の取り込みを開始しました');
  });

  test('パネル内「取り込む」ボタンでも toast が出る', async ({ page }) => {
    await page.goto('/notes');
    const btn = page.getByRole('button', { name: '取り込む', exact: true });
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(page.locator('.toast')).toContainText('議事録の取り込みを開始しました');
  });

  test('自動連携設定の details を開きフォルダ変更 toast が出る', async ({ page }) => {
    await page.goto('/notes');
    const details = page.locator('details.setup');
    await details.locator('summary').click();
    await expect(details.locator('.inner')).toBeVisible();
    const change = page.getByRole('button', { name: '変更' });
    await expect(change).toBeVisible();
    await change.click();
    await expect(page.locator('.toast')).toContainText('フォルダを選び直します');
  });

  test('使い方ガイドが開閉できる', async ({ page }) => {
    await page.goto('/notes');
    await page.getByRole('button', { name: /使い方|議事録の使い方/ }).first().click();
    const modal = page.locator('.scrim .modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('議事録の使い方');
    await modal.getByRole('button', { name: 'とじる' }).click();
    await expect(modal).toBeHidden();
  });
});

test.describe('議事録詳細 /notes/[id]', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  // 一覧経由でタイトルから詳細を開くヘルパ（id は seed では自動採番のため固定しない）
  async function openNote(page: Page, title: string) {
    await page.goto('/notes');
    await page.locator('a.note', { hasText: title }).click();
    await expect(page).toHaveURL(/\/notes\/[0-9a-f-]+$/);
    await expect(page.locator('.page-head h2')).toContainText(title);
  }

  test('要点・次にやること・全文・関連リンクが表示される', async ({ page }) => {
    const errors = trackErrors(page);
    await openNote(page, '6月度 定例MTG');

    // 要点
    const summary = page.locator('.panel', { hasText: '要点' });
    await expect(summary).toBeVisible();
    await expect(summary).toContainText('ECサイト構築');

    // 次にやること（seed の3件）
    const todoPanel = page.locator('.panel', { hasText: '次にやること' });
    await expect(todoPanel.locator('label.todo')).toHaveCount(3);
    await expect(todoPanel).toContainText('出荷量データを共有');

    // 全文
    const transcript = page.locator('.panel', { hasText: '文字起こし（全文）' });
    await expect(transcript.locator('.transcript')).toContainText('定例MTG');

    // この打ち合わせ（kv） — h3 で厳密に該当パネルを特定（「関連」パネルも文言を含むため）
    const meta = page.locator('.panel', {
      has: page.locator('.panel-head h3', { hasText: 'この打ち合わせ' }),
    });
    await expect(meta).toContainText('Notta');

    // 関連リンク（カレンダー・紹介・会社詳細）
    const related = page.locator('.panel', {
      has: page.locator('.panel-head h3', { hasText: '関連' }),
    });
    await expect(related.getByRole('link', { name: /この打ち合わせ（カレンダー）/ })).toBeVisible();
    await expect(related.getByRole('link', { name: /関連する紹介/ })).toBeVisible();

    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('「会社を開く」で会社詳細へ遷移する', async ({ page }) => {
    await openNote(page, '6月度 定例MTG');
    await page.getByRole('link', { name: '会社を開く' }).click();
    await expect(page).toHaveURL(new RegExp(`/companies/${SEED.tech}`));
  });

  test('全文コピー・編集ボタンで toast が出る', async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
    await openNote(page, '6月度 定例MTG');

    await page.getByRole('button', { name: '全文コピー' }).click();
    await expect(page.locator('.toast', { hasText: '全文をコピーしました' })).toBeVisible();

    await page.getByRole('button', { name: '編集' }).click();
    await expect(page.locator('.toast', { hasText: '要点を編集できます' })).toBeVisible();
  });

  test('次のアクション（おすすめ）の起票ボタンで toast が出る', async ({ page }) => {
    await openNote(page, '6月度 定例MTG');
    const reco = page.locator('.panel', { hasText: '次のアクション（おすすめ）' });

    await reco.getByRole('button', { name: '追加' }).click();
    await expect(page.locator('.toast', { hasText: 'マッチングに反映' })).toBeVisible();

    await reco.getByRole('button', { name: '紹介を起票' }).click();
    await expect(page.locator('.toast', { hasText: '起票しました' })).toBeVisible();
  });

  test('「次にやること」をチェックで完了→一覧から外れる（楽観更新＋toast）', async ({ page }) => {
    // 議事録（EC協業の打ち合わせ）で「次にやること」を1件完了→楽観更新＋toast＋永続化を検証。
    // 件数は state 非依存にするため before を取得して相対検証する。
    await openNote(page, 'EC協業の打ち合わせ');
    const todoPanel = page.locator('.panel', { hasText: '次にやること' });
    const before = await todoPanel.locator('label.todo').count();
    expect(before).toBeGreaterThanOrEqual(1);

    const target = await todoPanel.locator('label.todo').first().innerText();
    // onChange で楽観的に unmount されるため check() ではなく click()（checked 確認待ちを避ける）
    await todoPanel.locator('label.todo input[type=checkbox]').first().click();

    // toast + 楽観的に一覧から消える
    await expect(page.locator('.toast', { hasText: '「次にやること」を完了にしました' })).toBeVisible();
    await expect(todoPanel.locator('label.todo')).toHaveCount(before - 1);

    // 永続化される（globalThis 共有 PGlite）: 再取得しても完了分は戻らない
    const noteUrl = page.url();
    await page.goto('/notes');
    await page.goto(noteUrl);
    const panel2 = page.locator('.panel', { hasText: '次にやること' });
    await expect(panel2.locator('label.todo')).toHaveCount(before - 1);
    await expect(panel2.locator('label.todo', { hasText: target })).toHaveCount(0);
  });
});
