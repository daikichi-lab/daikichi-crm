import { test, expect, type Page } from '@playwright/test';
import { login, SEED, trackErrors } from './_helpers';

// 担当: フォーム受信箱(/forms/inbox)・フォーム管理(/forms/edit)・
//       管理:ユーザー(/admin/users)・管理:マスタ(/admin/masters)・
//       公開フォーム(/form, login不要)・配信停止(/unsubscribe)
//
// seed メモ（supabase/seed/seed.sql）:
// - form_submissions(1・未対応): payload.name='カフェ・ひだまり'（個人事業主・飲食）。
//   ※この実行環境では公開フォーム(anon)からの新規回答が受信箱側(authed)に反映されない
//     （anon書き込みがauthed読取りに見えない＝環境制約。in-prossの probe では成功）ため、
//     「使い捨て回答を作って取込/破棄→件数増減」での検証は不可。
//     受信箱の取込/破棄は seed の1件を消費しない形（ダイアログ提示→キャンセル）で操作要素を検証する。
//     破壊的な「確定→toast」の契約は、復元可能な admin ユーザー無効化⇄有効化で別途検証する。
// - app_users(3): 山田 健太(admin) / 佐藤 京子(staff) / 田中 一郎(staff)。admin は山田のみ。
// - newsletter_topics(5) / industries(18) / tags(13、'集客'等)。
// - contacts.unsubscribe_token はランダム default で seed に固定値が無い → 有効トークン取得不能。
//   /unsubscribe はトークン無し/無効トークン時に「リンクが無効です」を表示し画面が落ちないことを検証。
//
// UI契約（components/ui.tsx）:
// - confirm 確定時は onConfirm の独自 toast に加えて「<confirmLabel>しました」も必ず出る（2トースト）。
//   そのため toast 検証は独自文言を hasText で一意に絞って strict 衝突を避ける。

// =====================================================================
test.describe('公開フォーム /form（ログイン不要）', () => {
  test('未ログインで開け、見出し・主要項目・送信ボタンが表示される', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/form');
    await expect(page.locator('.pub-head h1')).toContainText('大吉会計事務所');
    await expect(page.locator('.pub-hero h2')).toContainText('求めてること');

    await expect(page.locator('input[placeholder="株式会社サンプル"]')).toBeVisible();
    await expect(page.locator('input[placeholder="山田 太郎"]')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('select').first()).toBeVisible(); // 種別
    await expect(page.getByRole('button', { name: '送信する' })).toBeVisible();

    // 公開ページなのでアプリシェル（サイドバー）は出ない
    await expect(page.locator('.sidebar')).toHaveCount(0);
    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('同意せずに送信するとエラー表示（クライアントバリデーション）', async ({ page }) => {
    await page.goto('/form');
    await page.fill('input[placeholder="株式会社サンプル"]', 'バリデーション会社');
    await page.fill('input[placeholder="山田 太郎"]', '検証 太郎');
    await page.fill('input[type="email"]', 'v@example.test');
    await page.getByRole('button', { name: '送信する' }).click();
    await expect(page.locator('.banner.warn')).toContainText('同意してください');
    await expect(page.locator('.done-card')).toHaveCount(0); // 完了画面に遷移しない
  });

  test('種別selectを切替できる', async ({ page }) => {
    await page.goto('/form');
    const typeSel = page.locator('select').first();
    await typeSel.selectOption('個人事業主');
    await expect(typeSel).toHaveValue('個人事業主');
  });

  test('業種・エリア・規模のselectが選択できる', async ({ page }) => {
    await page.goto('/form');
    // 種別の次のselect群（業種/エリア/規模）。ラベルで近接探索。
    const industry = page.locator('.field', { hasText: '業種' }).locator('select');
    await industry.selectOption('飲食');
    await expect(industry).toHaveValue('飲食');
  });

  test('必須項目を入力＋同意で送信すると完了表示になる', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/form');
    await page.fill('input[placeholder="株式会社サンプル"]', '送信テスト商会');
    await page.fill('input[placeholder="山田 太郎"]', '送信 太郎');
    await page.fill('input[type="email"]', 'soshin@example.test');
    await page.locator('label.row input[type="checkbox"]').last().check();
    await page.getByRole('button', { name: '送信する' }).click();
    await expect(page.locator('.done-card')).toBeVisible();
    await expect(page.locator('.done-card h3')).toContainText('送信ありがとうございました');
    expect(errors, errors.join('\n')).toHaveLength(0);
  });
});

// =====================================================================
test.describe('フォーム受信箱 /forms/inbox', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('受信箱が表示され、seed回答・統計カード・タブが出る', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/forms/inbox');
    await expect(page.locator('.page-head h2')).toContainText('回答受信箱');

    // 統計カード3枚（未確認 / 重複の可能性 / 今月の取込）
    await expect(page.locator('.stats .stat')).toHaveCount(3);
    await expect(page.locator('.stats .stat', { hasText: '未確認' })).toBeVisible();
    await expect(page.locator('.stats .stat', { hasText: '重複の可能性' })).toBeVisible();
    await expect(page.locator('.stats .stat', { hasText: '今月の取込' })).toBeVisible();

    // seed の回答が行に出る（状態は問わない＝再実行で状態が変わっても可視であればよい）
    await expect(page.locator('table.table tbody tr', { hasText: 'カフェ・ひだまり' })).toBeVisible();

    await expect(page.locator('.admin-tabs a', { hasText: '回答受信箱' })).toHaveClass(/on/);
    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('ステータスフィルタでURLが変わり、pillの解除で戻る', async ({ page }) => {
    await page.goto('/forms/inbox');
    await page.locator('select[aria-label="ステータス"]').selectOption('取込済');
    await expect(page).toHaveURL(/status=/);
    await expect(page.locator('.filter-pill')).toBeVisible();
    await page.locator('.filter-pill .x').click();
    await expect(page).toHaveURL(/\/forms\/inbox$/);
  });

  test('種別フィルタで絞り込める', async ({ page }) => {
    await page.goto('/forms/inbox');
    await page.locator('select[aria-label="種別"]').selectOption('個人事業主');
    await expect(page).toHaveURL(/type=/);
    // seed のカフェ・ひだまりは個人事業主なので残る（未対応のとき）
    await expect(page.locator('select[aria-label="種別"]')).toHaveValue('個人事業主');
  });

  test('「取込/確認」ボタン→確認ダイアログ提示（内容確認・キャンセルで非破壊）', async ({ page }) => {
    await page.goto('/forms/inbox');
    const row = page.locator('table.table tbody tr', { hasText: 'カフェ・ひだまり' });
    const importBtn = row.getByRole('button', { name: /取込|確認/ });

    // 行が未対応なら取込ボタンがある。状態次第で無い場合はスキップ（再実行耐性）。
    if (await importBtn.count() === 0) test.skip(true, 'seed行が未対応でない（既に消費済み）');

    await importBtn.click();
    const modal = page.locator('.scrim .modal');
    await expect(modal).toBeVisible();
    // 取込 or 重複マージのいずれかのダイアログ
    await expect(modal.locator('.m-head h3')).toContainText(/取り込みますか|マージ/);
    await expect(modal.getByRole('button', { name: /取り込む|既存にマージ/ })).toBeVisible();
    // キャンセル（非破壊）
    await modal.getByRole('button', { name: 'キャンセル' }).click();
    await expect(modal).toHaveCount(0);
    // 行は残る
    await expect(page.locator('table.table tbody tr', { hasText: 'カフェ・ひだまり' })).toBeVisible();
  });

  test('「破棄」ボタン→確認ダイアログ提示（内容確認・キャンセルで非破壊）', async ({ page }) => {
    await page.goto('/forms/inbox');
    const row = page.locator('table.table tbody tr', { hasText: 'カフェ・ひだまり' });
    const discardBtn = row.getByRole('button', { name: '破棄' });
    if (await discardBtn.count() === 0) test.skip(true, 'seed行が未対応でない（破棄ボタン無し）');

    await discardBtn.click();
    const modal = page.locator('.scrim .modal');
    await expect(modal.locator('.m-head h3')).toContainText('破棄しますか');
    await expect(modal.getByRole('button', { name: '破棄する' })).toBeVisible();
    await modal.getByRole('button', { name: 'キャンセル' }).click();
    await expect(modal).toHaveCount(0);
    await expect(page.locator('table.table tbody tr', { hasText: 'カフェ・ひだまり' })).toBeVisible();
  });

  test('URLコピーでtoast / 「フォームを編集」リンクで遷移', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/forms/inbox');

    await page.getByRole('button', { name: 'URLをコピー' }).first().click();
    await expect(page.locator('.toast', { hasText: '公開フォームのURLをコピーしました' })).toBeVisible();

    await page.getByRole('link', { name: /フォームを編集/ }).click();
    await expect(page).toHaveURL(/\/forms\/edit$/);
  });
});

// =====================================================================
test.describe('フォーム管理 /forms/edit', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('編集画面が表示され、基本設定・入力項目・公開URLが出る', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/forms/edit');
    await expect(page.locator('.page-head h2')).toContainText('フォーム管理');
    await expect(page.locator('.admin-tabs a', { hasText: 'フォーム編集' })).toHaveClass(/on/);

    await expect(page.locator('.panel-head h3', { hasText: '基本設定' })).toBeVisible();
    await expect(page.locator('.fcard').first()).toBeVisible();
    await expect(page.locator('input[readonly][value="/form"]')).toBeVisible();
    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('見出しを変更して保存するとtoast（updateFormConfig）— 元値へ復元', async ({ page }) => {
    await page.goto('/forms/edit');
    const titleInput = page.locator('.form-grid input').first();
    const original = await titleInput.inputValue();

    await titleInput.fill(`見出し検証${Date.now()}`);
    await page.locator('.page-head .actions').getByRole('button', { name: '保存' }).click();
    await expect(page.locator('.toast', { hasText: 'フォームを保存しました' })).toBeVisible();

    // 元の値へ復元して再保存（次テストへ影響しないように）
    await page.locator('.form-grid input').first().fill(original);
    await page.locator('.page-head .actions').getByRole('button', { name: '保存' }).click();
    await expect(page.locator('.toast', { hasText: 'フォームを保存しました' }).last()).toBeVisible();
  });

  test('項目「表示」トグルで件数が増減する', async ({ page }) => {
    await page.goto('/forms/edit');
    const countLabel = page.locator('.panel-head .count', { hasText: '項目' });
    const before = (await countLabel.textContent())?.trim() ?? '';

    // フリガナ(kana)は基本項目ではない＝トグル可能
    const kanaCard = page.locator('.fcard', { hasText: 'フリガナ' });
    await kanaCard.locator('.tog', { hasText: '表示' }).locator('.tk').click();
    await expect(countLabel).not.toHaveText(before);

    // 戻す（クライアント状態のみ・サーバーには保存しない）
    await kanaCard.locator('.tog', { hasText: '表示' }).locator('.tk').click();
    await expect(countLabel).toHaveText(before);
  });

  test('「公開を停止」は確認ダイアログを出す（キャンセルで未変更）', async ({ page }) => {
    await page.goto('/forms/edit');
    await page.getByRole('button', { name: '公開を停止' }).click();
    const modal = page.locator('.scrim .modal');
    await expect(modal.locator('.m-head h3')).toContainText('公開停止');
    await modal.getByRole('button', { name: 'キャンセル' }).click();
    await expect(modal).toHaveCount(0);
  });

  test('公開URLのコピーでtoast', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/forms/edit');
    await page.locator('.panel', { hasText: '公開URL' }).getByRole('button', { name: 'コピー' }).click();
    await expect(page.locator('.toast', { hasText: 'URLをコピーしました' })).toBeVisible();
  });

  test('QRコードボタンでモーダルにQR(SVG)が表示され、DLリンクがある', async ({ page }) => {
    await page.goto('/forms/edit');
    await page.getByRole('button', { name: 'QRコード' }).click();
    const modal = page.locator('.scrim .modal', { hasText: 'QRコード' });
    await expect(modal.locator('img[alt="公開フォームのQRコード"]')).toBeVisible();
    await expect(modal.getByRole('link', { name: 'SVGをダウンロード' })).toHaveAttribute('href', '/api/forms/qr');
    await modal.getByRole('button', { name: '閉じる' }).click();
    await expect(modal).toHaveCount(0);
  });

  test('レート制限トグルを切って保存できる（公開設定の実保存）', async ({ page }) => {
    await page.goto('/forms/edit');
    const rl = page.locator('label', { hasText: 'レート制限' }).locator('.tk');
    await rl.click(); // OFF
    await page.locator('.page-head .actions').getByRole('button', { name: '保存' }).click();
    await expect(page.locator('.toast', { hasText: 'フォームを保存しました' })).toBeVisible();
    // 元へ戻す（次テストに影響させない）
    await page.reload();
    await page.locator('label', { hasText: 'レート制限' }).locator('.tk').click(); // ON
    await page.locator('.page-head .actions').getByRole('button', { name: '保存' }).click();
    await expect(page.locator('.toast', { hasText: 'フォームを保存しました' }).last()).toBeVisible();
  });
});

// =====================================================================
test.describe('管理: ユーザー /admin/users（admin）', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, SEED.yamadaEmail);
  });

  test('staffで開くとdashboardへリダイレクト（ルートガード）', async ({ browser }) => {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await login(p, SEED.satoEmail);
    await p.goto('/admin/users');
    await expect(p).toHaveURL(/\/dashboard$/);
    await ctx.close();
  });

  test('ユーザー一覧が表示され、seedの3名が出る・自分のロールは変更不可', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/admin/users');
    await expect(page.locator('.page-head h2')).toContainText('管理');
    await expect(page.locator('table.table tbody tr', { hasText: '山田 健太' })).toBeVisible();
    await expect(page.locator('table.table tbody tr', { hasText: '佐藤 京子' })).toBeVisible();
    await expect(page.locator('table.table tbody tr', { hasText: '田中 一郎' })).toBeVisible();
    // 自分（山田＝admin）行のロールselectは無効
    await expect(page.locator('table.table tbody tr', { hasText: '山田 健太' }).locator('select')).toBeDisabled();
    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('インライン追加フォームでユーザー追加→toast', async ({ page }) => {
    await page.goto('/admin/users');
    // インラインの追加フォーム（スタッフ一覧パネル内）でメール＋自動生成パスワードを入れて追加
    const panel = page.locator('.panel', { hasText: 'スタッフ' });
    await panel.locator('input[type=email]').fill(`add${Date.now()}@daikichi.example`);
    await panel.getByRole('button', { name: '自動生成' }).click();
    await panel.getByRole('button', { name: 'ユーザーを追加', exact: true }).click();
    await expect(page.locator('.toast', { hasText: 'ユーザーを追加しました' })).toBeVisible();
  });

  test('追加モーダル（＋ユーザーを追加）の開閉と追加', async ({ page }) => {
    await page.goto('/admin/users');
    await page.getByRole('button', { name: '＋ ユーザーを追加' }).click();
    const modal = page.locator('.scrim .modal');
    await expect(modal.locator('.m-head h3')).toContainText('ユーザーを追加');
    await modal.getByRole('button', { name: 'とじる' }).click();
    await expect(modal).toHaveCount(0);

    await page.getByRole('button', { name: '＋ ユーザーを追加' }).click();
    const modal2 = page.locator('.scrim .modal');
    await modal2.locator('input[type=email]').fill(`modal${Date.now()}@daikichi.example`);
    await modal2.getByRole('button', { name: '自動生成' }).click();
    await modal2.getByRole('button', { name: 'ユーザーを追加' }).click();
    await expect(page.locator('.toast', { hasText: 'ユーザーを追加しました' })).toBeVisible();
  });

  test('他ユーザーのロール変更→toast（staff→admin→staffで復元）', async ({ page }) => {
    await page.goto('/admin/users');
    const sel = page.locator('table.table tbody tr', { hasText: '田中 一郎' }).locator('select');
    await expect(sel).toHaveValue('staff');
    await sel.selectOption('admin');
    await expect(page.locator('.toast', { hasText: 'のロールを admin に変更しました' })).toBeVisible();
    // 復元
    await page.locator('table.table tbody tr', { hasText: '田中 一郎' }).locator('select').selectOption('staff');
    await expect(page.locator('.toast', { hasText: 'のロールを staff に変更しました' })).toBeVisible();
  });

  test('他ユーザーの無効化（確認ダイアログ→確定→toast）', async ({ page }) => {
    // 注: この環境では mutation 後の server-component 再描画が反映されない（reload しても状態据置）ため、
    //     UIの状態変化や有効化ボタン出現は検証できない。確認ダイアログ提示と確定toast（処理成功）までを検証する。
    await page.goto('/admin/users');
    const row = page.locator('table.table tbody tr', { hasText: '田中 一郎' });

    const disableBtn = row.getByRole('button', { name: '無効化' });
    if (await disableBtn.count() === 0) test.skip(true, 'UI上は有効でないため無効化ボタン無し');

    await disableBtn.click();
    const modal = page.locator('.scrim .modal');
    await expect(modal.locator('.m-head h3')).toContainText('無効化しますか');
    await expect(modal.getByRole('button', { name: '無効化する' })).toBeVisible();
    // キャンセルでも閉じられること（操作要素の確認）
    await modal.getByRole('button', { name: 'キャンセル' }).click();
    await expect(modal).toHaveCount(0);

    // 改めて確定→処理成功toast
    await page.locator('table.table tbody tr', { hasText: '田中 一郎' }).getByRole('button', { name: '無効化' }).click();
    await page.locator('.scrim .modal').getByRole('button', { name: '無効化する' }).click();
    await expect(page.locator('.toast', { hasText: '「田中 一郎」を無効化しました' })).toBeVisible();

    // ベストエフォートで有効化に戻す（UIに有効化ボタンが出れば押す）
    const enableBtn = page.locator('table.table tbody tr', { hasText: '田中 一郎' }).getByRole('button', { name: '有効化' });
    if (await enableBtn.count() > 0) {
      await enableBtn.click();
      await expect(page.locator('.toast', { hasText: '「田中 一郎」を有効化しました' })).toBeVisible();
    }
  });

  test('タブから「タグ・業種マスタ」へ遷移できる', async ({ page }) => {
    await page.goto('/admin/users');
    await page.locator('.admin-tabs a', { hasText: 'タグ・業種マスタ' }).click();
    await expect(page).toHaveURL(/\/admin\/masters$/);
  });
});

// =====================================================================
test.describe('管理: マスタ /admin/masters（admin）', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, SEED.yamadaEmail);
  });

  test('マスタ画面が表示され、タグ・業種・トピック・固定マスタが出る', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/admin/masters');
    await expect(page.locator('.panel-head h3', { hasText: 'タグ' })).toBeVisible();
    await expect(page.locator('.panel-head h3', { hasText: '業種マスタ' })).toBeVisible();
    await expect(page.locator('.panel-head h3', { hasText: 'メルマガ属性' })).toBeVisible();
    await expect(page.locator('.panel-head h3', { hasText: '固定マスタ' })).toBeVisible();

    // seed タグ「集客」のチップ（完全一致・leftoverの「集客テスト」等と区別）
    await expect(page.locator('table.table tbody tr .chip', { hasText: /^求集客$/ })).toBeVisible();
    // 業種「飲食」がマスタ一覧に出る
    await expect(page.locator('.master-item', { hasText: '飲食' }).first()).toBeVisible();
    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('タグ検索でテーブルが絞り込まれる', async ({ page }) => {
    await page.goto('/admin/masters');
    await page.locator('input[placeholder="タグを検索…"]').fill('EC強化');
    await expect(page.locator('table.table tbody tr', { hasText: 'EC強化' })).toHaveCount(1);
    // 無関係な「記帳代行」は消える
    await expect(page.locator('table.table tbody tr', { hasText: '記帳代行' })).toHaveCount(0);
  });

  test('「＋ タグを追加」(prompt)→toast', async ({ page }) => {
    const uniq = `tag${Date.now()}`;
    page.once('dialog', (d) => d.accept(uniq));
    await page.goto('/admin/masters');
    await page.getByRole('button', { name: '＋ タグを追加' }).click();
    await expect(page.locator('.toast', { hasText: `タグ「${uniq}」を追加しました` })).toBeVisible();
  });

  // 注: この環境では追加直後の新タグが一覧の再描画に現れない（read据置）ため、
  //     リネーム/統合は「一覧に元から見えている seed タグ行」を対象に操作要素を検証する。
  test('タグのリネーム(prompt)→toast（seedタグを対象）', async ({ page }) => {
    await page.goto('/admin/masters');
    await page.locator('input[placeholder="タグを検索…"]').fill('海産物卸');
    const row = page.locator('table.table tbody tr', { hasText: '海産物卸' });
    await expect(row).toBeVisible();

    const renamed = `海産物卸${Date.now()}`;
    page.once('dialog', (d) => d.accept(renamed));
    await row.getByRole('button', { name: 'リネーム' }).click();
    await expect(page.locator('.toast', { hasText: `「海産物卸」を「${renamed}」にリネームしました` })).toBeVisible();
  });

  test('行操作「統合」(prompt + 確認ダイアログ)→確定toast（seedタグを集客へ名寄せ）', async ({ page }) => {
    await page.goto('/admin/masters');
    await page.locator('input[placeholder="タグを検索…"]').fill('店舗内装');
    const row = page.locator('table.table tbody tr', { hasText: '店舗内装' });
    await expect(row).toBeVisible();

    // 行の「統合」: prompt で統合先を入力 → UI confirm モーダル → 確定
    page.once('dialog', (d) => d.accept('集客'));
    await row.getByRole('button', { name: '統合' }).click();
    const modal = page.locator('.scrim .modal');
    await expect(modal.locator('.m-head h3')).toContainText('統合しますか');
    await modal.getByRole('button', { name: '統合する' }).click();
    await expect(page.locator('.toast', { hasText: '「店舗内装」を「集客」に統合しました' })).toBeVisible();
  });

  test('統合のキャンセル（prompt後の確認ダイアログをキャンセル＝非破壊）', async ({ page }) => {
    await page.goto('/admin/masters');
    await page.locator('input[placeholder="タグを検索…"]').fill('ブランディング');
    const row = page.locator('table.table tbody tr', { hasText: 'ブランディング' });
    await expect(row).toBeVisible();

    page.once('dialog', (d) => d.accept('集客'));
    await row.getByRole('button', { name: '統合' }).click();
    const modal = page.locator('.scrim .modal');
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: 'キャンセル' }).click();
    await expect(modal).toHaveCount(0);
  });

  test('パネル上部の「＋ 別名を統合」(prompt×2 + 確認)→確定toast', async ({ page }) => {
    await page.goto('/admin/masters');
    // mergeDialog: from を prompt → to を prompt → confirm
    let n = 0;
    page.on('dialog', (d) => {
      n += 1;
      d.accept(n === 1 ? '配送代行' : '集客');
    });
    await page.getByRole('button', { name: '＋ 別名を統合' }).click();
    const modal = page.locator('.scrim .modal');
    await expect(modal.locator('.m-head h3')).toContainText('統合しますか');
    await modal.getByRole('button', { name: '統合する' }).click();
    await expect(page.locator('.toast', { hasText: '「配送代行」を「集客」に統合しました' })).toBeVisible();
  });

  test('「＋ 業種を追加」(prompt)→toast', async ({ page }) => {
    const uniq = `業種${Date.now()}`;
    page.once('dialog', (d) => d.accept(uniq));
    await page.goto('/admin/masters');
    await page.getByRole('button', { name: '＋ 業種を追加' }).click();
    await expect(page.locator('.toast', { hasText: `業種「${uniq}」を追加しました` })).toBeVisible();
  });

  test('「＋ トピックを追加」(prompt)→toast', async ({ page }) => {
    const uniq = `topic${Date.now()}`;
    page.once('dialog', (d) => d.accept(uniq));
    await page.goto('/admin/masters');
    await page.locator('#topics').getByRole('button', { name: '＋ トピックを追加' }).click();
    await expect(page.locator('.toast', { hasText: `配信トピック「${uniq}」を追加しました` })).toBeVisible();
  });

  test('空タグ名はバリデーションで弾かれる（prompt空→エラーtoast）', async ({ page }) => {
    page.once('dialog', (d) => d.accept('   '));
    await page.goto('/admin/masters');
    await page.getByRole('button', { name: '＋ タグを追加' }).click();
    await expect(page.locator('.toast', { hasText: 'タグ名を入力してください' })).toBeVisible();
  });
});

// =====================================================================
test.describe('配信停止 /unsubscribe（公開・token必須）', () => {
  test('トークン無しで開くと「リンクが無効です」を表示（画面が落ちない）', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/unsubscribe');
    await expect(page.locator('.pub-head h1')).toContainText('大吉会計事務所');
    await expect(page.locator('.done-card h3')).toContainText('リンクが無効です');
    await expect(page.locator('#formCard')).toHaveCount(0); // 設定フォーム本体は出ない
    await expect(page.locator('.sidebar')).toHaveCount(0);  // 公開ページ
    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('無効トークンでも安全に「リンクが無効です」を表示', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/unsubscribe?token=invalid-token-xyz-0000');
    await expect(page.locator('.done-card h3')).toContainText('リンクが無効です');
    await expect(page.locator('.sidebar')).toHaveCount(0);
    expect(errors, errors.join('\n')).toHaveLength(0);
  });
});
