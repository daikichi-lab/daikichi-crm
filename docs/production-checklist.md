# 大吉CRM 本番化チェックリスト

`docs/DEPLOY.md`（手順の詳細）と対で使う実作業リスト。上から順に進める。無料枠維持（C-1）・Tokyoリージョン国内保管（C-7）が最優先制約。

## Phase 0 — アカウント・準備
- [ ] Supabase プロジェクト作成（**リージョン Tokyo** 固定）
- [ ] Cloudflare アカウント（Workers 有効化・独自ドメイン）
- [ ] メール送信用ドメインの DNS（SPF / DKIM / DMARC）※メルマガ実送信で必要
- [ ] `.env.local`（gitignore）に本番値。秘密は Cloudflare/Supabase の Secrets へ

## Phase 1 — DB / バックエンド
- [ ] マイグレーション `0001`〜`0010` を Supabase に適用（`_pglite_bootstrap.sql` は**適用しない**＝Supabaseは auth スキーマ/ロールを標準装備）
- [ ] マスタ初期投入（業種18 / メルマガトピック5 / タグ / エリア・規模は固定）※`seed.sql` から**マスタ部分のみ**投入。デモ企業・担当者は入れない
- [ ] RLS/権限の確認: 全テーブル RLS 有効・`authenticated` のみ、`anon` は公開5関数（`submit_public_form`/`get_public_form_config`/`get_subscription_by_token`/`update_subscription`/`unsubscribe_all`）のみ、`service_role` は秘匿
- [ ] **管理者アカウント作成**: `node scripts/create-admin.mjs`（下記「管理者の作成」参照）

## Phase 2 — 認証（Supabase Auth 連携の完成）★現状の最大の未実装
現在は dev の HMAC cookie 認証のみ実装。本番の Supabase Auth 分岐が未接続。
- [ ] `app/actions/auth.ts`: `supabase.auth.signInWithPassword` を実装（現在は `?e=supabase` へ落ちるスタブ）
- [ ] `lib/auth/session.ts`: `authMode==='supabase'` 分岐。`getCurrentUser` を Supabase セッションから解決し、**今回入れた `active` 失効・有効期限チェックを引き継ぐ**
- [ ] `lib/data/supabase-server.ts`: `@supabase/ssr` でアクセストークンを Cookie 経由に受け渡し（現在は `sb-access-token` を読むだけ）
- [ ] サインアップ/招待で `auth.users.id` = `app_users.id` を突合（profile 自動作成 or 招待フロー）
- [ ] パスワードリセット（`/reset-password`）、サインアウトの本番動作
- [ ] `app/admin/users` の招待（`app_invite_user`）を Supabase の招待メールと連動

## Phase 3 — Storage（名刺・資料）
- [ ] 非公開バケット作成（例: `business-cards` / `company-documents`）
- [ ] アップロード実装＋拡張子/MIME/サイズ検証（現状はデモ toast）: 名刺スキャン・企業詳細の資料タブ
- [ ] 閲覧/DL は**署名URL**（有効期限つき・SEC-9/12）で発行

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
- [ ] メルマガ実送信: 送信APIアダプタ（Resend/Brevo 等の無料枠）を `send({to,subject,html,text})` の裏に。日次上限に応じて分割送信（Cron）
- [ ] 名刺OCR: ブラウザ内 Tesseract.js（外部送信なし・C-7）
- [ ] Google カレンダー / Notta 連携（打ち合わせ・議事録）※将来フェーズ
- [ ] MCP（`mcp/crm-demo`）を本番RPC呼び出しへ差し替え（read-only ロール＋ホワイトリスト EXECUTE）

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
