# 大吉CRM 本番化チェックリスト

`docs/DEPLOY.md`（手順の詳細）と対で使う実作業リスト。上から順に進める。無料枠維持（C-1）・Tokyoリージョン国内保管（C-7）が最優先制約。

> **状態サマリ（2026-07-17 更新）**: **アプリ機能はコード実装完了**（全画面・CSV・マッチング・紹介・期限タスク・メルマガ・議事録・公開フォーム・名刺OCR・資料保管・MCP／typecheck 通過・単体57件 green・E2E191件 green）。
> 認証・Storage・周辺機能も**アプリ層は実装済み**（旧記載の「未実装／デモ toast／スタブ」は解消）。以下は `[x]=コード実装済み` / `[ ]=本番環境での構築・適用・疎通確認が残` で表記。
> 純粋な残作業は **Phase 0・1・4・6 の本番環境構築とデプロイ実行**（Supabase Tokyo プロジェクト作成・マイグレーション適用・秘密鍵登録・Cloudflare デプロイ・送信ドメイン DNS）と、Phase 2/3/5 の**実 Supabase を相手にした疎通確認**。

## Phase 0 — アカウント・準備
- [ ] Supabase プロジェクト作成（**リージョン Tokyo** 固定）
- [ ] Cloudflare アカウント（Workers 有効化・独自ドメイン）
- [ ] メール送信用ドメインの DNS（SPF / DKIM / DMARC）※メルマガ実送信で必要
- [ ] `.env.local`（gitignore）に本番値。秘密は Cloudflare/Supabase の Secrets へ

## Phase 1 — DB / バックエンド
- [ ] マイグレーション `0001`〜`0012` を Supabase に適用（`_pglite_bootstrap.sql` は**適用しない**＝Supabaseは auth スキーマ/ロールを標準装備）。※`0011`=資料 Storage、`0012`=議事録/メルマガ/フォーム対策 RPC。既存本番に `0001`〜`0011` 適用済みなら**差分 `0012` のみ**適用
- [ ] マスタ初期投入（業種18 / メルマガトピック5 / タグ / エリア・規模は固定）※`seed.sql` から**マスタ部分のみ**投入。デモ企業・担当者は入れない
- [ ] RLS/権限の確認: 全テーブル RLS 有効・`authenticated` のみ、`anon` は公開5関数（`submit_public_form`/`get_public_form_config`/`get_subscription_by_token`/`update_subscription`/`unsubscribe_all`）のみ、`service_role` は秘匿
- [ ] **管理者アカウント作成**: `node scripts/create-admin.mjs`（下記「管理者の作成」参照）

## Phase 2 — 認証（Supabase Auth 連携）★アプリ層は実装済み／実 Supabase での疎通確認が残る
`authMode` は本番（`NODE_ENV=production` もしくは `APP_AUTH=supabase`）で自動的に `'supabase'` になる。以下はコード実装済みで、残るのは**実 Supabase を相手にした疎通確認**（Phase 4「疎通確認」で実施）。
- [x] `app/actions/auth.ts`: `supabaseSignIn`（=`supabase.auth.signInWithPassword`）を呼ぶ本番ログイン実装済み（旧「`?e=supabase` スタブ」は解消）
- [x] `lib/auth/session.ts`: `authMode==='supabase'` 分岐。`getCurrentUser` が `active` 失効・有効期限チェックを引き継ぐ
- [x] `lib/data/supabase-server.ts`: `@supabase/ssr` の `createServerClient`＋Cookie（getAll/setAll）でセッションを受け渡し、RLS を効かせる（旧「`sb-access-token` を読むだけ」は解消）
- [x] パスワードリセット（`supabaseResetPassword`）・サインアウト（`supabaseSignOut`）実装済み
- [ ] （疎通）`node scripts/create-admin.mjs` で `auth.users.id` = `app_users.id` を突合した管理者が作られることを実 Supabase で確認
- [ ] （疎通）`app/admin/users` の「メール＋仮パスワード」追加で本番 Auth ユーザーが作成・ログインできることを確認（※メール招待フローは廃止済み＝仮パスワード方式）

## Phase 3 — Storage（名刺・資料）★アップロード/OCR/署名URL はアプリ層で実装済み
- [ ] 非公開バケット作成（`business-cards` / `company-documents`）※本番プロジェクトで作成
- [x] アップロード実装＋拡張子/MIME/サイズ検証（**実アップロード**）: 名刺スキャン（ブラウザ内 Tesseract.js OCR）・企業詳細の資料タブ（migration `0011`）
- [x] 閲覧/DL は**署名URL**（有効期限つき・SEC-9/12）で発行。IDOR 対策済み（クライアント供給パスを廃止＝サーバ側でパス解決）
- [ ] （疎通）本番バケットに対してアップロード→署名URL閲覧が通ることを確認

## Phase 4 — Cloudflare デプロイ（OpenNext）
準備は実装済み: `@opennextjs/cloudflare`＋`wrangler` 導入、`wrangler.jsonc`（vars: driver/auth/公開URL・anon）、npm scripts（`cf:deploy`/`cf:preview`/`cf:typegen`）。ローカルで `opennextjs-cloudflare build` が成功し `.open-next/worker.js` 生成を確認済み（PGlite は遅延chunkで本番未ロード）。

手順（この順で実施）:
- [ ] **Cloudflare にログイン**: `npx wrangler login`（ブラウザでOAuth承認）。※CLIが使えない場合はダッシュボードでもトークン発行可
- [ ] **機微鍵を Secret 登録**（gitに出さない）:
  - `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY`（`.env.local` の値を貼る）
  - `npx wrangler secret put APP_SESSION_SECRET`（同上）
- [ ] **デプロイ**: `npm run cf:deploy`（= `opennextjs-cloudflare build && … deploy`）。初回は Worker 名 `daikichi-crm` で作成され `*.workers.dev` URL が発行される
- [ ] **Supabase Auth の URL 設定**: Supabase → Authentication → URL Configuration の Site URL / Redirect URLs に本番URL（`https://daikichi-crm.<subdomain>.workers.dev` や独自ドメイン）を追加（パスワード再設定リンク等のため）
- [ ] **疎通確認**: 本番URLにアクセス→管理者でログイン→ダッシュボード/資料アップロード/署名URLを確認
- [ ] **独自ドメイン**（任意）: Cloudflare ダッシュボード → Workers → Custom Domains で割当。割当後、上の Supabase URL 設定も更新
- [ ] 補足: SSR 制約が複雑化した場合のみ SPA+Pages 退避を検討（セキュリティ境界が完全に RLS 依存になる点に注意・CLAUDE.md）。今回は OpenNext ビルドが通ったため不要

## Phase 5 — 周辺機能（本番で有効化）
- [x] メルマガ実送信: 送信APIアダプタ（Resend）を `send({to,subject,html,text})` の裏に実装済み。※本番稼働は `RESEND_API_KEY` 登録と送信ドメイン DNS（Phase 0）が前提。無料枠の日次上限に応じた分割送信（Cron）は必要時に追加
- [x] 名刺OCR: ブラウザ内 Tesseract.js（外部送信なし・C-7）実装済み
- [x] MCP（`mcp/crm-demo`）: 環境変数で本番 Supabase RPC(PostgREST) へ自動切替する実装済み（read-only）。※本番は read-only ロール＋ホワイトリスト EXECUTE の付与を確認
- [ ] Google カレンダー / Notta 連携（打ち合わせ・議事録）※将来フェーズ（iCal 書き出しは実装済み）

## Phase 6 — 運用
- [ ] 無料枠モニタ（Storage 1GB / メール日次上限 / Workers リクエスト）
- [ ] バックアップ方針（Supabase 自動バックアップ）
- [ ] 本番で `APP_SEED` を投入しない（実データ保護）

---

## 管理者の作成（`scripts/create-admin.mjs`）
Supabase Auth のユーザー（ハッシュ化パスワード）＋ `app_users` の管理者プロフィールを作成する。**パスワードは環境変数で渡し、コミットしない。**

```bash
SUPABASE_URL="https://<project>.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="<service_role_key>" \
ADMIN_PASSWORD='Password!1' \
  node scripts/create-admin.mjs --email fuga.shiojiri@daikichi-accg.co.jp --name '塩尻'
```
- 既存メールなら Auth ユーザーを再利用し、パスワードを指定値へ更新（冪等）。
- `service_role` キーはこのスクリプト（サーバー/手元）専用。ブラウザ・`NEXT_PUBLIC_*` に絶対入れない（SEC-3）。

**dev 環境**では seed に同じ管理者プロフィールを投入済みのため、`APP_AUTH=dev` では `fuga.shiojiri@daikichi-accg.co.jp`（パスワード不問）で即ログインできる。
