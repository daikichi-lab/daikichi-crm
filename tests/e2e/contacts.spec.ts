import { test, expect, type Page } from '@playwright/test';
import { login, SEED, trackErrors } from './_helpers';

// 担当画面（担当者詳細 / フォーム / 名刺スキャン）の E2E。
//
// 【このテスト環境の前提（重要）】
// dev/test ハーネスは PGlite（インメモリ・単一プロセス内）を使うが、Next の本番ビルドでは
// server-action と page-render が別インスタンスで走ることがあり、書込（作成/更新/削除）が
// 別リクエストの読込に反映されない（＝書いた行を直後に読み戻せない）。本番（Supabase）では
// 起きない。よって本 spec は指示どおり「書込が本番RPC前提で効かなくても、UIの遷移／トースト／
// ステップ遷移／フォーム検証」を対象にし、作成行のDB読み戻しには依存しない。
// seed 行（常に全インスタンスに存在）は読み込みも確実なので、表示・遷移はそれで検証する。

// 1x1 の有効なPNG（実ファイルアップロードのフィクスチャ・全テスト共用）。
const CARD_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const PRIMARY_CONTACT = SEED.pSato; // 佐藤 太郎（大吉商事の主担当・名刺あり）
// seed の非主担当 = 海風水産（…009）の唯一の担当者「大島 涼」。詳細が確実に読める。
const NON_PRIMARY_CONTACT = 'bbbbbbbb-0000-0000-0000-000000000009';
const NON_PRIMARY_COMPANY = 'aaaaaaaa-0000-0000-0000-000000000009';
// 削除フロー検証用に隔離した seed 担当者（山本 浩 / 山本会計サービス…007）。
// 他テストはこの担当者・企業を参照しないので、削除しても他テストに影響しない。
const DELETE_CONTACT = 'bbbbbbbb-0000-0000-0000-000000000007';

/** 企業の担当者タブを開く。 */
async function openContactsTab(page: Page, companyId: string) {
  await page.goto(`/companies/${companyId}`);
  await expect(page.locator('nav.tabs')).toBeVisible();
  await page.locator('nav.tabs button', { hasText: '担当者' }).click();
}

test.describe('担当者詳細 /contacts/[id]', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('企業詳細の担当者タブから担当者詳細へ遷移できる', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(`/companies/${SEED.daikichi}`);
    // 担当者タブを開く
    await page.locator('nav.tabs button', { hasText: '担当者' }).click();
    const pane = page.locator('.contact-card').first();
    await expect(pane).toBeVisible();
    // 行内「詳細」リンクで担当者詳細へ
    await Promise.all([
      page.waitForURL(/\/contacts\/[0-9a-f-]+$/),
      pane.locator('.ops a', { hasText: '詳細' }).first().click(),
    ]);
    await expect(page.locator('.page-head h2')).toBeVisible();
    expect(errors).toHaveLength(0);
  });

  test('主担当バッジ・連絡先・所属企業リンクが表示される', async ({ page }) => {
    await page.goto(`/contacts/${PRIMARY_CONTACT}`);
    await expect(page.locator('.page-head h2')).toContainText('佐藤 太郎');
    // 主担当バッジ
    await expect(page.locator('.page-head .badge', { hasText: '主担当' })).toBeVisible();
    // 連絡先（メールの mailto リンク）
    await expect(page.locator(`a[href^="mailto:"]`).first()).toBeVisible();
    // 所属企業の会社詳細リンク
    const companyLink = page.getByRole('link', { name: '会社の詳細を開く' });
    await expect(companyLink).toBeVisible();
    await Promise.all([page.waitForURL(/\/companies\//), companyLink.click()]);
  });

  test('名刺ビューア（表面）クリックで署名URLトーストが出る', async ({ page }) => {
    await page.goto(`/contacts/${PRIMARY_CONTACT}`);
    // 名刺パネル内の擬似カード（.card）をクリック
    const card = page.locator('.bizset .card').first();
    await expect(card).toBeVisible();
    await card.click();
    await expect(page.locator('.toast', { hasText: '名刺を拡大表示' })).toBeVisible();
  });

  test('名刺の「差し替え」で実ファイルをアップロードするとトーストが出る（Storage）', async ({ page }) => {
    await page.goto(`/contacts/${PRIMARY_CONTACT}`);
    // 差し替え = 隠しファイル入力（画像）。setInputFiles で直接投入（dev は擬似ストレージ）
    const input = page.locator('input[type=file][accept*=".jpg"]');
    await input.setInputFiles({ name: 'meishi.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('fake-image-bytes') });
    await expect(page.locator('.toast', { hasText: '名刺を差し替えました' })).toBeVisible();
  });

  test('名刺の「履歴」で過去の名刺一覧モーダルが開く', async ({ page }) => {
    await page.goto(`/contacts/${PRIMARY_CONTACT}`);
    await page.getByRole('button', { name: '履歴', exact: true }).click();
    const modal = page.locator('.scrim .modal', { hasText: '過去の名刺' });
    await expect(modal).toBeVisible();
    // seed の主担当は名刺ありなので、最低1件＋「表面」ボタンが出る
    await expect(modal.getByRole('button', { name: '表面' }).first()).toBeVisible({ timeout: 7500 });
    await modal.getByRole('button', { name: '閉じる' }).click();
    await expect(modal).toHaveCount(0);
  });

  test('主担当の担当者には「主担当を解除」ボタンが出て、確認ダイアログが開く', async ({ page }) => {
    await page.goto(`/contacts/${PRIMARY_CONTACT}`);
    const unset = page.getByRole('button', { name: '主担当を解除' });
    await expect(unset).toBeVisible();
    await unset.click();
    const modal = page.locator('.scrim .modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('主担当を解除しますか');
    // 取消（キャンセル）で閉じる＝状態は変えない
    await modal.getByRole('button', { name: 'キャンセル' }).click();
    await expect(modal).not.toBeVisible();
  });

  test('seed 担当者の詳細: 主担当の設定 UI（ボタン→トースト、または既に主担当の表示）', async ({ page }) => {
    // seed の海風水産は担当者1名（大島 涼）。クリーンな seed では非主担当なので「主担当にする」が出る。
    // ※ このハーネスは同一サーバ再利用時に主担当化が残るため、既に主担当なら解除 UI を検証する
    //    （いずれにせよ主担当まわりの操作要素が可視＝トリガ可能であることを担保）。
    await page.goto(`/contacts/${NON_PRIMARY_CONTACT}`);
    await expect(page.locator('.page-head h2')).toContainText('大島');
    const setBtn = page.getByRole('button', { name: 'この担当者を主担当にする' });
    if (await setBtn.isVisible().catch(() => false)) {
      await setBtn.click();
      await expect(page.locator('.toast', { hasText: '主担当に設定しました' })).toBeVisible();
    } else {
      // 既に主担当 → 解除ボタンとバッジが出ている
      await expect(page.locator('.page-head .badge', { hasText: '主担当' })).toBeVisible();
      await expect(page.getByRole('button', { name: '主担当を解除' })).toBeVisible();
    }
  });

  test('企業の担当者タブ: 主担当の設定 UI（★主担当にする→変更トースト、または主担当バッジ）', async ({ page }) => {
    await openContactsTab(page, NON_PRIMARY_COMPANY);
    const row = page.locator('.contact-card', { hasText: '大島' });
    await expect(row).toBeVisible();
    const makePrimary = row.locator('.ops button', { hasText: '主担当にする' });
    if (await makePrimary.isVisible().catch(() => false)) {
      await makePrimary.click();
      await expect(page.locator('.toast', { hasText: /主担当を .*大島.* に変更しました/ })).toBeVisible();
    } else {
      // 既に主担当 → バッジ表示（「主担当にする」ボタンは非表示）
      await expect(row.locator('.badge', { hasText: '主担当' })).toBeVisible();
    }
    // 行内の「詳細」「編集」リンクは常に可視
    await expect(row.locator('.ops a', { hasText: '詳細' })).toBeVisible();
    await expect(row.locator('.ops a', { hasText: '編集' })).toBeVisible();
  });

  test('削除ボタン → 確認ダイアログ（キャンセルで状態維持）', async ({ page }) => {
    await page.goto(`/contacts/${PRIMARY_CONTACT}`);
    await page.getByRole('button', { name: '削除', exact: true }).click();
    const modal = page.locator('.scrim .modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('ゴミ箱へ移動しますか');
    await modal.getByRole('button', { name: 'キャンセル' }).click();
    await expect(modal).not.toBeVisible();
    // キャンセルなのでまだ詳細ページに留まる
    await expect(page).toHaveURL(new RegExp(`/contacts/${PRIMARY_CONTACT}$`));
  });

  test('削除フロー: 確認ダイアログを確定すると企業詳細へ遷移する（隔離 seed 担当者で UI 検証）', async ({ page }) => {
    // 書込の読み戻しには依存せず、確認→確定→ナビゲーションの UI フローを検証。
    // 隔離した DELETE_CONTACT（山本 浩）を対象にして他テストへ影響させない。
    const resp = await page.goto(`/contacts/${DELETE_CONTACT}`);
    expect(resp?.status()).toBeLessThan(400);
    // クリーン seed では削除ボタンが出る（再利用サーバで既に削除済みなら詳細が描画されない可能性があるため可視確認）。
    const delBtn = page.getByRole('button', { name: '削除', exact: true });
    await expect(delBtn).toBeVisible();
    await delBtn.click();
    const modal = page.locator('.scrim .modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('ゴミ箱へ移動しますか');
    // 確定 → 企業詳細へリダイレクト（softDeleteContactAction の redirect）
    await Promise.all([
      page.waitForURL(/\/companies\//),
      modal.getByRole('button', { name: 'ゴミ箱へ移動' }).click(),
    ]);
    await expect(page.locator('.sidebar')).toBeVisible();
  });

  test('追加フォーム送信 → 担当者詳細URLへ遷移する（作成→redirect の UI フロー）', async ({ page }) => {
    const tmpName = `E2E追加_${Date.now()}`;
    await page.goto(`/companies/${SEED.tech}/contacts/new`);
    await page.fill('input[placeholder="佐藤 太郎"]', tmpName);
    await page.fill('input[placeholder="営業部 部長"]', 'テスト役職');
    await page.fill('input[type="email"]', 'e2e-new@example.com');
    // 保存 → createContactAction が新規担当者の詳細へ redirect する（URL 遷移を検証）。
    await Promise.all([
      page.waitForURL(/\/contacts\/[0-9a-f-]+$/),
      page.getByRole('button', { name: '保存', exact: true }).click(),
    ]);
    expect(page.url()).toMatch(/\/contacts\/[0-9a-f-]+$/);
    // ※ 詳細ページの内容検証は dev ハーネスの書込読み戻し制約により行わない（前述コメント参照）。
  });
});

test.describe('担当者フォーム /contacts/[id]/edit・/companies/[id]/contacts/new', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('追加フォームの主要要素（入力・名刺スロット・OCR導線）が可視', async ({ page }) => {
    await page.goto(`/companies/${SEED.daikichi}/contacts/new`);
    await expect(page.locator('.page-head h2')).toContainText('担当者を追加');
    await expect(page.locator('input[placeholder="佐藤 太郎"]')).toBeVisible();
    await expect(page.locator('input[placeholder="サトウ タロウ"]')).toBeVisible();
    // 名刺から自動入力（OCR）導線
    await expect(page.getByRole('link', { name: /名刺から自動入力/ })).toBeVisible();
    // 表面の名刺スロット（空）に実ファイルを投入 → 取込トースト＋プレビュー画像
    await expect(page.locator('.card-slot').first()).toBeVisible();
    await page.locator('input[type=file][accept="image/*"]').first()
      .setInputFiles({ name: 'card.png', mimeType: 'image/png', buffer: CARD_PNG });
    await expect(page.locator('.toast', { hasText: '表面の名刺を取り込みました' })).toBeVisible();
    await expect(page.locator('.card-slot.filled img')).toBeVisible();
  });

  test('編集フォームで表面名刺を実ファイルで差し替えて保存できる（実アップロード）', async ({ page }) => {
    await page.goto(`/contacts/${PRIMARY_CONTACT}/edit`);
    // 隠しfront入力に画像を投入 → プレビュー
    await page.locator('input[type=file][accept="image/*"]').first()
      .setInputFiles({ name: 'newcard.png', mimeType: 'image/png', buffer: CARD_PNG });
    await expect(page.locator('.card-slot.filled img')).toBeVisible();
    // 保存 → uploadScanImageAction で実アップロード後、詳細へ redirect
    await Promise.all([
      page.waitForURL(new RegExp(`/contacts/${PRIMARY_CONTACT}$`)),
      page.getByRole('button', { name: '保存', exact: true }).click(),
    ]);
    await expect(page).toHaveURL(new RegExp(`/contacts/${PRIMARY_CONTACT}$`));
  });

  test('氏名未入力で保存 → バリデーションのトースト', async ({ page }) => {
    await page.goto(`/companies/${SEED.daikichi}/contacts/new`);
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.locator('.toast', { hasText: '氏名を入力してください' })).toBeVisible();
    // 遷移しない
    await expect(page).toHaveURL(/\/contacts\/new$/);
  });

  test('編集フォーム: 既存値が初期表示され、保存で詳細URLへ redirect する', async ({ page }) => {
    // seed の佐藤 太郎を編集。既存値の初期表示と、保存→redirect の UI を検証（読み戻しは行わない）。
    await page.goto(`/contacts/${PRIMARY_CONTACT}/edit`);
    await expect(page.locator('.page-head h2')).toContainText('担当者を編集');
    const titleInput = page.locator('input[placeholder="営業部 部長"]');
    await expect(titleInput).toHaveValue('部長'); // seed の既存値が初期表示される
    await expect(page.locator('input[placeholder="佐藤 太郎"]')).toHaveValue('佐藤 太郎');
    await titleInput.fill('部長（E2E）');
    await Promise.all([
      page.waitForURL(new RegExp(`/contacts/${PRIMARY_CONTACT}$`)),
      page.getByRole('button', { name: '保存', exact: true }).click(),
    ]);
    await expect(page).toHaveURL(new RegExp(`/contacts/${PRIMARY_CONTACT}$`));
  });

  test('編集フォームのキャンセルで詳細へ戻る', async ({ page }) => {
    await page.goto(`/contacts/${PRIMARY_CONTACT}/edit`);
    // フォーム下部のキャンセル（companyId ありなので #contacts 付き企業詳細へ）
    await Promise.all([
      page.waitForURL(/\/companies\//),
      page.locator('.row').getByRole('link', { name: 'キャンセル' }).last().click(),
    ]);
  });
});

test.describe('名刺スキャン /scan', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  // 隠しファイル入力に画像を投入（front=.first / back=.nth(1)）。
  const uploadFront = (page: import('@playwright/test').Page) =>
    page.locator('input[type=file][capture]').first().setInputFiles({ name: 'card.png', mimeType: 'image/png', buffer: CARD_PNG });

  // 実OCR（Tesseract.js）は言語データの取得が重くCIで非決定的なため、E2Eは「OCRせず手入力で進む」
  // の決定的パスで capture→upload→create を検証する。OCRテキストの項目振り分けは
  // tests/unit/ocr-parse.test.ts で純関数として網羅する。

  test('ウィザード初期表示→画像取込（実ファイル）→手入力でステップ3', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/scan');
    await expect(page.locator('.page-head h2')).toContainText('名刺から顧客を作成');
    await expect(page.locator('[data-scan-steps] .s.on')).toHaveCount(1);

    await uploadFront(page); // → ステップ2、プレビュー画像
    await expect(page.locator('[data-scan-steps] .s.on')).toHaveCount(2);
    await expect(page.locator('.shot img')).toBeVisible();

    await page.getByRole('button', { name: 'OCRせず手入力で進む' }).click();
    await expect(page.locator('[data-scan-steps] .s.on')).toHaveCount(3);
    await expect(page.getByText('抽出結果を確認・補正')).toBeVisible();
    expect(errors).toHaveLength(0);
  });

  test('やり直すでステップ1へ戻る', async ({ page }) => {
    await page.goto('/scan');
    await uploadFront(page);
    await page.getByRole('button', { name: 'OCRせず手入力で進む' }).click();
    await page.getByRole('button', { name: 'やり直す', exact: true }).click();
    await expect(page.locator('[data-scan-steps] .s.on')).toHaveCount(1);
  });

  test('重複検出: 会社名がseed企業（みどり食堂）に一致すると重複候補と2択が出る', async ({ page }) => {
    await page.goto('/scan');
    await uploadFront(page);
    await page.getByRole('button', { name: 'OCRせず手入力で進む' }).click();
    // 会社名を手入力 → detect_duplicate_company がヒット
    await page.locator('.form-grid input').first().fill('みどり食堂');
    await expect(page.locator('.dup-opt').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/似た企業/)).toBeVisible();
    const existingRadio = page.locator('input[name="dupmode"][value="existing"]');
    const newRadio = page.locator('input[name="dupmode"][value="new"]');
    await expect(existingRadio).toBeChecked();
    await expect(page.locator('.form-grid input').first()).toBeDisabled();
    await expect(page.getByRole('button', { name: /担当者を追加$/ })).toBeVisible();
    // 「新規作成」へ切替 → ボタン文言と会社名 input の活性が変わる
    await newRadio.check();
    await expect(page.locator('.form-grid input').first()).toBeEnabled();
    await expect(page.getByRole('button', { name: '企業＋担当者を作成' })).toBeVisible();
  });

  test('裏面画像を実ファイルで追加できる', async ({ page }) => {
    await page.goto('/scan');
    await uploadFront(page);
    await page.locator('input[type=file][capture]').nth(1)
      .setInputFiles({ name: 'back.png', mimeType: 'image/png', buffer: CARD_PNG });
    await expect(page.locator('.toast', { hasText: '裏面を追加しました' })).toBeVisible();
    // 新UI: 裏面が取り込まれると「裏」トグルに ✓ が付き、状態表示が「裏 ✓取込済」になる
    await expect(page.getByRole('button', { name: /裏\s*✓/ })).toBeVisible();
    await expect(page.getByText(/裏 ✓取込済/)).toBeVisible();
  });

  test('新規作成: 一意な会社名で作成し企業詳細URLへ遷移する（実画像アップロード込み）', async ({ page }) => {
    await page.goto('/scan');
    await uploadFront(page);
    await page.getByRole('button', { name: 'OCRせず手入力で進む' }).click();
    const nonce = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
    await page.locator('.form-grid input').first().fill(`スキャン新規_${nonce}`); // 会社名 / 屋号
    await page.locator('.form-grid input').nth(1).fill('担当 太郎'); // 氏名（必須）
    const createBtn = page.getByRole('button', { name: '企業＋担当者を作成' });
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    await Promise.all([
      page.waitForURL(/\/companies\/[0-9a-f-]+/),
      createBtn.click(),
    ]);
    expect(page.url()).toMatch(/\/companies\/[0-9a-f-]+/);
    // ※ 企業詳細の内容検証は dev ハーネスの書込読み戻し制約により行わない（先頭コメント参照）。
  });
});
