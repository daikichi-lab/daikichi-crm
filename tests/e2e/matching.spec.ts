import { test, expect, type Page } from '@playwright/test';
import { login, SEED, trackErrors } from './_helpers';

// 担当: マッチング(/matching) と 紹介履歴(/referrals)
// サーバーは 1プロセス・seed状態を共有(workers:1)。
// 破壊的操作は「相対変化」または「テスト後に元へ戻す」で各testを独立に保つ。

test.describe('マッチング（/matching）', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('起点未指定＝事務所全体のおすすめ（協業先紹介の候補が出る）', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/matching');

    await expect(page.locator('.page-head h2')).toContainText('紹介できる組み合わせ');

    // おすすめモードのトグルボタン文言（押すと会社選択モードへ）
    await expect(page.getByRole('button', { name: '会社を選んで探す' })).toBeVisible();
    // おすすめモードの案内バナー
    await expect(page.locator('.banner.info')).toContainText('全顧客の');

    // 起点未指定では select は出ない（会社選択パネルは非表示）
    await expect(page.locator('#candList .panel.reco')).not.toHaveCount(0);

    // 候補件数 .num が候補カード数と一致
    const count = await page.locator('#candList .panel.reco').count();
    await expect(page.locator('.page-head .num').first()).toHaveText(String(count));

    // おすすめは全件 協業先紹介
    const recos = page.locator('#candList .panel.reco');
    const n = await recos.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      await expect(recos.nth(i).locator('.kind')).toContainText('協業先紹介');
    }

    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('?base=<id> ＝ 起点候補が score・求/提タグ・方向つきで出る', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(`/matching?base=${SEED.daikichi}`);

    // 起点会社の select（解決された社名が選択値）
    const sel = page.locator('select.select');
    await expect(sel).toBeVisible();
    await expect(sel).toHaveValue('株式会社 大吉商事');

    // 起点の 求めてる / 提供できる チップ（seed: 集客/EC強化, 食材卸/配送代行）
    const panelBody = page.locator('.panel .panel-body').first();
    await expect(panelBody).toContainText('集客');
    await expect(panelBody).toContainText('EC強化');
    await expect(panelBody).toContainText('食材卸');

    // 大吉商事(求:集客,EC強化) ↔ 佐藤デザイン(提:集客,EC強化) → 協業先紹介・相性高い
    const reco = page.locator('#candList .panel.reco', { hasText: '佐藤デザイン事務所' }).first();
    await expect(reco).toBeVisible();
    // 方向: 「<from> に <to> を紹介」
    await expect(reco.locator('.reco-flow')).toContainText('株式会社 大吉商事');
    await expect(reco.locator('.reco-flow')).toContainText('佐藤デザイン事務所');
    await expect(reco.locator('.reco-flow')).toContainText('紹介');
    // score 表示（相性 高い/中）と一致タグ件数
    await expect(reco.locator('.fit')).toContainText('相性');
    await expect(reco.locator('.fit-hi')).toContainText('高い'); // 集客+EC強化=2タグ
    // 求(need)/提(offer) のタグペア
    await expect(reco.locator('.reco-pairs .chip.need').first()).toBeVisible();
    await expect(reco.locator('.reco-pairs .chip.offer').first()).toBeVisible();

    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('起点 select の変更で別会社の起点へ遷移する', async ({ page }) => {
    await page.goto(`/matching?base=${SEED.daikichi}`);
    const sel = page.locator('select.select');
    await expect(sel).toHaveValue('株式会社 大吉商事');

    // テック合同会社へ切替（option の value は社名）→ URL が base=（その社名）へ遷移
    await Promise.all([
      page.waitForURL(/\/matching\?base=/),
      sel.selectOption('テック合同会社'),
    ]);
    await expect(sel).toHaveValue('テック合同会社');
    expect(page.url()).toContain(encodeURIComponent('テック合同会社'));
  });

  test('「会社を選んで探す」⇄「事務所全体のおすすめ」のモード切替', async ({ page }) => {
    await page.goto('/matching');
    // おすすめ → 会社選択
    await Promise.all([
      page.waitForURL(/\/matching\?base=/),
      page.getByRole('button', { name: '会社を選んで探す' }).click(),
    ]);
    await expect(page.locator('select.select')).toBeVisible();
    // 会社選択 → おすすめへ戻す
    await Promise.all([
      page.waitForURL((u) => u.pathname === '/matching' && !u.search.includes('base=')),
      page.getByRole('button', { name: '事務所全体のおすすめ' }).click(),
    ]);
    await expect(page.locator('.banner.info')).toBeVisible();
  });

  test('絞り込み: 相性「高い」のみ適用すると中の候補が消える', async ({ page }) => {
    await page.goto(`/matching?base=${SEED.daikichi}`);
    const recos = page.locator('#candList .panel.reco');
    const before = await recos.count();

    // 「中」のチェックを外して適用（fgroup「相性」内の2番目=中）
    const seishin = page.locator('.match-filter .fgroup').first();
    await seishin.locator('label.ck').nth(1).locator('input').uncheck();
    await page.locator('.match-filter button.btn-primary', { hasText: '適用' }).click();

    await expect(page.locator('.toast')).toContainText('絞り込みました');
    // 中(score<2)が消える＝件数は減るか同数（全件高いなら同数）、増えはしない
    await expect(async () => {
      expect(await recos.count()).toBeLessThanOrEqual(before);
    }).toPass();
    // 残った候補はすべて相性「高い」
    const after = await recos.count();
    for (let i = 0; i < after; i++) {
      await expect(recos.nth(i).locator('.fit')).toHaveClass(/fit-hi/);
    }
  });

  test('「見送り」で候補がリストから消える', async ({ page }) => {
    await page.goto(`/matching?base=${SEED.daikichi}`);
    const recos = page.locator('#candList .panel.reco');
    const before = await recos.count();
    expect(before).toBeGreaterThan(0);

    const first = recos.first();
    const firstFlow = (await first.locator('.reco-flow').textContent())?.trim();
    await first.getByRole('button', { name: '見送り' }).click();

    await expect(page.locator('.toast')).toContainText('候補を見送りにしました');
    await expect(recos).toHaveCount(before - 1);
    // 件数表示 .num も更新
    await expect(page.locator('.page-head .num').first()).toHaveText(String(before - 1));
    // 見送った組み合わせはもう出ない
    if (firstFlow) {
      await expect(page.locator('#candList .reco-flow', { hasText: firstFlow })).toHaveCount(0);
    }
  });

  test('「この紹介を起票」→ 確認ダイアログ → toast → 起票済みになる', async ({ page }) => {
    // 注: この dev 環境では書き込み(create_referral)が永続化されないため、
    // /referrals の絶対件数増加ではなく、起票操作の観測可能な結果
    // （確認ダイアログ・toast「起票しました」・ボタンが起票済みへ）を検証する。
    await page.goto(`/matching?base=${SEED.daikichi}`);
    const reco = page.locator('#candList .panel.reco').first();
    const issueBtn = reco.getByRole('button', { name: 'この紹介を起票' });
    await expect(issueBtn).toBeEnabled();
    await issueBtn.click();

    // 確認ダイアログ（.scrim .modal、確定ボタン文言=起票・取消=キャンセル）
    const modal = page.locator('.scrim .modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('h3')).toContainText('この紹介を起票しますか');
    await expect(modal.getByRole('button', { name: 'キャンセル' })).toBeVisible();
    await modal.getByRole('button', { name: '起票', exact: true }).click();

    // 既定の確認後トースト「<confirmLabel>しました」
    await expect(page.locator('.toast')).toContainText('起票しました');
    await expect(modal).toHaveCount(0);
    // ボタンが起票済みに変わり無効化される
    await expect(reco.getByRole('button', { name: '起票済み' })).toBeDisabled();
  });

  test('起票の確認ダイアログをキャンセルすると起票されない', async ({ page }) => {
    await page.goto(`/matching?base=${SEED.daikichi}`);
    const reco = page.locator('#candList .panel.reco').first();
    await reco.getByRole('button', { name: 'この紹介を起票' }).click();
    const modal = page.locator('.scrim .modal');
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: 'キャンセル' }).click();
    await expect(modal).toHaveCount(0);
    // ボタンは「この紹介を起票」のままで操作可能
    await expect(reco.getByRole('button', { name: 'この紹介を起票' })).toBeEnabled();
  });

  test('「使い方」ガイドが開いて「とじる」で閉じる', async ({ page }) => {
    await page.goto('/matching');
    await page.getByRole('button', { name: '使い方' }).click();
    const modal = page.locator('.scrim .modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('h3')).toContainText('マッチングの使い方');
    await modal.getByRole('button', { name: 'とじる' }).click();
    await expect(modal).toHaveCount(0);
  });
});

test.describe('紹介履歴（/referrals）', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('一覧と by_status 集計（統計カード）が表示される', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/referrals');

    await expect(page.locator('.page-head h2')).toContainText('紹介履歴');

    // 集計カード 提案/打診中/成立/不成立
    const stats = page.locator('.stats .stat');
    await expect(stats).toHaveCount(4);
    await expect(stats.nth(0)).toContainText('提案');
    await expect(stats.nth(1)).toContainText('打診中');
    await expect(stats.nth(2)).toContainText('成立');
    await expect(stats.nth(3)).toContainText('不成立');

    // seed の打診中レコード（大吉商事 → 佐藤デザイン事務所）が見える
    const row = page.locator('.table tbody tr', { hasText: '佐藤デザイン事務所' }).first();
    await expect(row).toBeVisible();
    await expect(row.locator('.flow')).toContainText('株式会社 大吉商事');
    await expect(row.locator('.badge')).toContainText('打診中');

    // トップバーの「マッチングから起票」リンク
    await expect(page.getByRole('link', { name: 'マッチングから起票' })).toHaveAttribute('href', '/matching');

    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('ステータス絞り込み（打診中）でURLと行が連動し、クリアできる', async ({ page }) => {
    await page.goto('/referrals');
    const filter = page.locator('.filterbar select');

    await Promise.all([
      page.waitForURL(/status=/),
      filter.selectOption('打診中'),
    ]);
    await expect(page.url()).toContain('status=' + encodeURIComponent('打診中'));
    // 表示行はすべて打診中
    const badges = page.locator('.table tbody tr .badge');
    const n = await badges.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) await expect(badges.nth(i)).toContainText('打診中');

    // フィルタピル + 条件クリア
    await expect(page.locator('.filter-pill')).toContainText('打診中');
    await Promise.all([
      page.waitForURL((u) => !u.search.includes('status=')),
      page.getByText('条件をクリア').click(),
    ]);
    await expect(filter).toHaveValue('');
  });

  test('該当なしステータス（成立など seed に無い場合）で空表示か件数0', async ({ page }) => {
    await page.goto('/referrals?status=' + encodeURIComponent('不成立'));
    // 行がある場合は全て不成立、無い場合は空メッセージ
    const dataRows = page.locator('.table tbody tr').filter({ hasNot: page.locator('td[colspan]') });
    const empty = page.locator('.table tbody td[colspan]');
    if (await dataRows.count()) {
      const badges = page.locator('.table tbody tr .badge');
      const n = await badges.count();
      for (let i = 0; i < n; i++) await expect(badges.nth(i)).toContainText('不成立');
    } else {
      await expect(empty).toContainText('該当する紹介がありません');
    }
  });

  test('ステータス変更モーダルで更新を実行すると toast が出て閉じる', async ({ page }) => {
    // 注: この dev 環境では update_referral_status の書き込みが永続化されず、
    // ReferralRowAction も router.refresh() を呼ばないため、行バッジ/集計は
    // 即時に変化しない（リロードしても seed のまま）。
    // よってここでは更新操作の観測可能な結果（モーダル・toast・閉じる）を検証する。
    await page.goto('/referrals');

    // 操作対象 = seed の打診中レコード（大吉商事 → 佐藤デザイン事務所）
    const row = page.locator('.table tbody tr', { hasText: '佐藤デザイン事務所' }).first();
    await expect(row.locator('.badge')).toContainText('打診中');

    // 「状態を更新」→ modal（.scrim .modal）で 提案 を選び 更新
    await row.getByRole('button', { name: '状態を更新' }).click();
    const modal = page.locator('.scrim .modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('h3')).toContainText('ステータスを更新');
    // モーダル内の遷移先（from → to）が表示されている
    await expect(modal.locator('.m-body')).toContainText('佐藤デザイン事務所');
    const sel = modal.locator('select.select');
    await sel.selectOption('提案');
    await expect(sel).toHaveValue('提案');
    await modal.getByRole('button', { name: '更新' }).click();

    await expect(page.locator('.toast')).toContainText('ステータスを更新しました');
    await expect(modal).toHaveCount(0);
  });

  test('状態更新モーダルはキャンセルで変更されず閉じる', async ({ page }) => {
    await page.goto('/referrals');
    const row = page.locator('.table tbody tr', { hasText: '佐藤デザイン事務所' }).first();
    const statusBefore = (await row.locator('.badge').textContent())?.trim();

    await row.getByRole('button', { name: '状態を更新' }).click();
    const modal = page.locator('.scrim .modal');
    await expect(modal).toBeVisible();
    await modal.locator('select.select').selectOption('成立');
    await modal.getByRole('button', { name: 'キャンセル' }).click();
    await expect(modal).toHaveCount(0);

    // バッジは変わっていない
    await expect(row.locator('.badge')).toContainText(statusBefore || '打診中');
  });

  test('from/to の社名リンクが会社詳細へ向く', async ({ page }) => {
    await page.goto('/referrals');
    const row = page.locator('.table tbody tr', { hasText: '佐藤デザイン事務所' }).first();
    const fromLink = row.locator('.flow a').first();
    await expect(fromLink).toHaveAttribute('href', /\/companies\//);
    await Promise.all([
      page.waitForURL(/\/companies\//),
      fromLink.click(),
    ]);
    await expect(page.locator('.sidebar')).toBeVisible();
  });
});
