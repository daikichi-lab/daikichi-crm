# 大吉CRM デプロイ／運用手順

実アプリ（Next.js App Router + Supabase + Cloudflare）の開発・テスト・本番化手順。

## アーキテクチャ（実装）
- **UI/サーバー**: Next.js 15 (App Router, TS)。サーバーコンポーネント＋サーバーアクション。
- **データ層 (`lib/data`)**: 全DB操作は **SQL RPC 経由**（C-6：検索/マッチング/スケジュール/メルマガ/活動/資料のロジックを1か所＝`supabase/migrations` に集約）。
  - `APP_DATA_DRIVER=pglite`（dev/test）: 埋め込み Postgres（`@electric-sql/pglite`、Docker不要）。起動時に `supabase/_pglite_bootstrap.sql`→`migrations/*`→`seed/seed.sql` を適用。
  - `APP_DATA_DRIVER=supabase`（本番）: PostgREST RPC（`/rest/v1/rpc/<fn>`）。ユーザーJWTで RLS が効く。
- **認証 (`lib/auth/session.ts`)**: `APP_AUTH=dev`（メールのみ・ローカル専用、HMAC署名cookie）/ `APP_AUTH=supabase`（本番・Supabase Auth）。未指定かつ本番は supabase（fail closed）。
- **セキュリティ**: 全テーブル RLS（authenticated のみ・anon 不可）。PIIマスク既定。CSVフォーミュラインジェクション対策。詳細は `docs/requirements.md` §9 / `contract.md`。

## ローカル開発
```bash
npm install
# dev サーバ（PGlite + dev認証 + seed）
APP_DATA_DRIVER=pglite APP_AUTH=dev APP_SEED=1 npm run dev
# → http://localhost:3000 /login（dev: yamada@daikichi.example でログイン。パスワード任意）
```

## テスト
```bash
npm test            # 単体（Vitest）: CSVロジック + PGlite経由のRPC/RLS
npm run test:e2e    # E2E（Playwright）: build→start(PGlite+dev認証+seed) で全画面・全操作
npm run typecheck   # tsc --noEmit
npm run lint
node scripts/db-validate.mjs   # マイグレーション+seed+RPCの適用確認
```

## 本番化（Supabase Tokyo + Cloudflare）
1. **Supabase プロジェクト作成（リージョン Tokyo）**。
2. **マイグレーション適用**: `supabase/migrations/0001_init.sql`〜`0007_write_rpc.sql` を順に実行（`_pglite_bootstrap.sql` は**適用しない**＝Supabaseは auth スキーマ/ロールを標準装備）。必要に応じ `supabase db push`。
3. **seed**（任意・初期データ）: `supabase/seed/seed.sql`。本番は実データ投入のため通常スキップ。
4. **RLS/権限の確認**: 全テーブル RLS 有効・`authenticated` のみ。RPC は `authenticated` に EXECUTE、公開関数（`submit_public_form`/`get_public_form_config`/`get_subscription_by_token`/`update_subscription`/`unsubscribe_all`）のみ `anon` に付与。`service_role` はブラウザ・Claudeに出さない。
5. **環境変数**（`.env.example` 参照）: `APP_DATA_DRIVER=supabase` `APP_AUTH=supabase` `NEXT_PUBLIC_SUPABASE_URL` `NEXT_PUBLIC_SUPABASE_ANON_KEY` `APP_SESSION_SECRET`。秘密は Cloudflare/Supabase の Secrets に。
6. **Storage**: 名刺・資料は**非公開バケット**＋署名URL（SEC-9/12）。アップロードは拡張子/MIME/サイズ検証。
7. **Cloudflare デプロイ（OpenNext）**: `@opennextjs/cloudflare` でビルドし Workers へ（無料枠・商用可）。`wrangler` でデプロイ。SSR制約が複雑な場合は SPA+Pages へ退避（要RLS依存・CLAUDE.md 注記）。
8. **Supabase Auth 連携の完成**: `lib/auth/session.ts` の supabase 分岐と `app/actions/auth.ts` の `signInWithPassword`、`lib/data/supabase-server.ts` のトークン受け渡し（`@supabase/ssr` 推奨）を実装。`app_users` は `auth.users.id` と一致させる profile パターン。

## MCP（Claude連携）の本番化
`mcp/crm-demo/` の各 `t_*` を本番RPC呼び出しに差し替え（入出力・ロジック不変＝C-6）。読み取り専用ロール＋ホワイトリストRPCの EXECUTE のみ。詳細は `docs/claude-integration.md`。
