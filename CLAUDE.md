# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

大吉会計（会計事務所）向けの **顧客管理 + 顧客同士のビジネスマッチング** システム。

主な目的:
- 顧客（企業・個人事業主）の一覧管理
- **顧客同士のビジネス紹介**（協業先紹介・顧客紹介の両方）を仕組み化する
- 条件による顧客の絞り込み
- CSV取込・書き出し
- ローカルの Claude（MCP経由）からも、ブラウザUIからも同じデータを操作できる

## 現在の状態（重要）

**実装フェーズ。** 設計・モックに加えて、**実アプリを scaffold 済み**（Next.js 15 + TS、`app/`・`lib/`・`components/`・`supabase/migrations/`・`tests/`。DBは dev/test=PGlite, 本番=Supabase。単体/E2Eテストあり。`docs/DEPLOY.md`）。本番デプロイ（Cloudflare/Supabase Tokyo）と Supabase Auth 連携の完成が残作業。
設計・モックの成果物（実装の正典・UI指針）は引き続き次の3つ:

- **`docs/` — 仕様の正典。** `requirements.md`（要件定義 v0.4・最上位）→ `screen-design.md`（画面）→ `newsletter-feature.md`（メルマガ）→ `claude-integration.md`（Claude連携＝カスタムMCP）。**仕様で迷ったら、まず docs/、次に本ファイル**（矛盾時は CLAUDE.md > requirements.md > 各機能仕様）。
- **`mockups/` — 全画面の静的HTMLモック＋デザインシステム**（下記「モックの作法」）。実装時のUI指針。
- **`mcp/crm-demo/` — Claude連携の動くデモ**（read-only・依存ゼロのMCPサーバ）。本番DB前の検証用。

本ファイルは「既存コードの説明」ではなく**合意済みの設計判断の記録**。実アプリを scaffold したら「開発コマンド」を実コマンドへ追記すること。

## 確定済みの設計判断

実装中に迷ったら、まずここを参照すること。これらはユーザーと合意済みの前提:

1. **「無料」が最優先制約。** 月額コストゼロを維持する。これがスタック選定を支配する。
2. **マッチング = 顧客同士のビジネス紹介。** 顧客と担当者のマッチングではない。`needs`（求めてる）↔ `offers`（提供できる）の突合で、協業先紹介・顧客紹介の両方を1つのロジックでさばく。
3. **複数拠点・外出先からアクセスする** → ローカル専用ではなくクラウド構成。
4. **簡単なログイン（個人ごと）が必要。** 自前実装せず、Supabase Auth（メール+パスワード）を使う。
5. **顧客データはゼロから新規作成。** 既存CSVに合わせる必要はない（スキーマは下記の叩き台から始める）。
6. **項目（カラム）は運用しながら増える前提。** スキーマ進化を前提に設計する（後述の2層構造）。
7. **会計事務所の機微情報を扱う。** Supabaseプロジェクトは**リージョンを Tokyo** にして国内保管とする。
8. **ホスティングは Cloudflare。** Vercel無料(Hobby)は非商用限定で業務利用NGのため不採用。Cloudflareは無料枠で商用利用可。

## ターゲットアーキテクチャ

```
スタッフ（ブラウザ）──→ Next.js (Cloudflare Workers / OpenNext) ─┐
                                                              ├─→ Supabase (Tokyo)
ローカルの Claude ──MCP────────────────────────────────────────┘   ├ Postgres（顧客DB）
                                                                  ├ Auth（ログイン）
                                                                  └ 自動REST API (PostgREST)
```

- **フロントエンド / UI**: Next.js (App Router, TypeScript)。Cloudflare へは **OpenNext アダプタ**でデプロイ（無料・商用可）。
  - 注: Cloudflare + Next.js SSR はアダプタ設定にやや手間がかかる。複雑になりすぎる場合は「Vite製SPA + Cloudflare Pages（静的）+ Supabase直叩き」へ切替も選択肢（その場合セキュリティ境界は完全にRLS依存になる点に注意）。
- **バックエンド+DB+認証**: Supabase（Postgres + Auth + 自動生成REST API）。専用バックエンドは原則持たず、Supabaseをバックエンドとして使う。
- **Claude連携**: Supabase 公式 MCP サーバーをローカル接続。UIからもClaudeからも**同じデータ・同じ結果**になるよう、検索・絞り込み・マッチングのロジックは1か所（DB側のSQL/RPC関数 か 共有データ層）に集約する。

## セキュリティ要件（最優先・調査反映）

機微情報（会計事務所の顧客＝事業情報）を扱うため、以下は交渉不可:

1. **RLS（Row Level Security）を全テーブルで有効化。** Supabaseで公開される全テーブルにRLSを設定する。RLS無効＝anonキーで全件読み書き可能になる。ポリシーは `auth.uid()` 起点で組む。
2. **`service_role`（secret）キーをブラウザに絶対出さない。** このキーはRLSを貫通する。サーバー側（Workers/サーバーコンポーネント）のみ。ブラウザには anon / publishable キーのみ。
   - ⚠️ Supabaseは新APIキー形式（`sb_publishable_*` / `sb_secret_*`）へ移行中。実装時に最新の鍵運用を公式ドキュメントで確認すること。
3. **認可をミドルウェアだけに頼らない（DALパターン）。** Next.js 16 ではミドルウェアは `proxy.ts`（Nodeランタイム）に改称。認証・認可チェックはデータアクセス層（DAL）で必ず行う。理由: CVE-2025-29927（ミドルウェア認証バイパス）の教訓。
4. **シークレットはコードに置かない。** `.env.local`（gitignore）や Cloudflare/Supabase の環境変数・シークレット機構で管理。`NEXT_PUBLIC_*` に機微情報を入れない（ブラウザに露出する）。
5. **CSV取込/書き出しの安全対策。**
   - 取込: スキーマ検証・型チェックを通してから投入（不正値・列ずれを弾く）。
   - 書き出し: **CSVフォーミュラインジェクション対策**（`=`, `+`, `-`, `@` 始まりのセルをエスケープ）。
6. **クライアント側チェックだけに依存しない。** 表示制御はUX、強制力はRLS＋サーバー側DAL。

## データモデル

> 詳細な確定仕様は `docs/requirements.md`（要件定義書）を正とする。本節はその要約。

**企業（事業者）と担当者を分離する。** `type` で企業/個人事業主を区別。個人事業主は「企業1件＋担当者1件（本人）」で表現する。マッチングの肝 `needs`/`offers` は**企業側**に持つ（ビジネスマッチングは事業者同士のため）。先方の担当者（名刺の人物）と名刺画像は別テーブルに分ける。

構成: `companies`（顧客企業＝事業者, 1）→ `contacts`（担当者, 多）→ `business_cards`（名刺画像, 多）

```
companies（顧客企業／事業者）   ※旧 customers
  id          自動採番
  type        企業 / 個人事業主
  name        会社名 or 屋号・氏名
  industry    業種（業種マスタの値・選択式）
  area        エリア（都道府県マスタの値・選択式）
  size        規模区分（売上ベース・選択式）
  needs       求めてること（タグ・複数）   ← マッチングの肝
  offers      提供できること（タグ・複数）  ← マッチングの肝
  status      顧問中 / 見込み など
  owner       社内担当スタッフ（任意・表示/絞り込み用。アクセス制御には使わない）
  notes       自由メモ
  extra       後から増える項目（JSONB）
  created_at / updated_at
  deleted_at  論理削除（null=有効。配下の contacts/business_cards も既定で非表示）

contacts（担当者＝先方の担当者）
  id          自動採番
  company_id  FK → companies
  name / name_kana   氏名 / フリガナ
  title / department 役職 / 部署
  email / phone / mobile
  is_primary  主担当フラグ
  extra       JSONB
  created_at / updated_at / deleted_at

business_cards（名刺画像＋OCR）
  id          自動採番
  contact_id  FK → contacts
  front_path  表面画像のStorageパス（非公開バケット）
  back_path   裏面画像のStorageパス（任意）
  ocr_status  未処理 / 処理中 / 完了 / 失敗
  ocr_raw     OCR抽出の生結果（JSONB）
  created_at / updated_at
```

補助テーブル: `tags`（needs/offers 共通のタグマスタ。マスタ選択＋自由追加）、`referrals`（紹介履歴・Phase 2）。`industry`/`area`/`size` はマッチング精度のため選択式マスタ（自由入力にしない）。

### 名刺・OCR

- 担当者ごとに名刺の表/裏画像を **Supabase Storage の非公開バケット**に保存。テーブルにはパスのみ。閲覧は**署名URL**（機微情報＝個人情報）。
- OCRは **ブラウザ内 Tesseract.js**（完全無料・画像を外部OCRサービスに送らない＝C-7に最適）。テキストの項目振り分けは自前ヒューリスティクス、**抽出結果は必ず人が確認・補正してから保存**する。

### スキーマ進化のルール（2層構造）

「項目を後から追加していく」を支えるための運用ルール:

- **コア項目**（絞り込み・マッチングで多用するもの）は、ちゃんとした**列**にする（検索が速い・型がつく・RLSやインデックスが効く）
- **試験的・低頻度の項目**は、まず `extra`（JSONB）に**マイグレーション無しで追加**する
- `extra` の項目が「絞り込みで多用される」と分かったら、**正式な列に昇格**させる（マイグレーションを書く）

新項目を足すときは、いきなり列を増やすのではなく、まず `extra` に入れて運用で確かめること。
スキーマ変更は `supabase/migrations/` のSQLマイグレーションで管理し、TypeScript型はSupabaseスキーマから自動生成して型安全を保つ。

## マッチングの考え方

- `needs` と `offers` の**タグの重なり**でスコア化し、相性の高い顧客の組み合わせを提案する
  - 例: A社 `needs:集客` ↔ B社 `offers:Web広告` → 協業先紹介
  - 例: A社 `offers:食材卸` ↔ B社 `needs:仕入先` → 顧客紹介
- スコアリングは Postgres 側（SQL / RPC関数）で完結させ、**外部LLM APIに課金しない**。これにより UI と MCP(Claude) が同一ロジックを共有できる。
- 文章での提案文・要約が必要な場合は、追加API課金を避けるため**手元のClaude（MCP経由）**に行わせる。

## CSV

- 取込（登録）・書き出し（エクスポート）の両方をサポートする。
- 列構成は上記 `companies`（企業）スキーマに対応させる（CSVは企業単位。担当者・名刺は名刺スキャン/手動で登録）。
- セキュリティ要件5（検証・フォーミュラインジェクション対策）を必ず満たすこと。

## Claude Code 開発環境（`.claude/`）

このプロジェクトを「設計・セキュリティ・コードのきれいさ」高水準で進めるための開発環境方針。
**注: 以下の設定ファイルの具体構文は公式ドキュメントで確認してから実装すること**（Hooks/Skills/MCPの構文は変わりうる）。

- **MCP（CRMデータ）**: Claude連携は**カスタムMCP一択**（汎用の公式Supabase MCPは不採用＝広すぎ・生SQL・RLS貫通のため）。**read-only・最小権限**で運用。詳細は `docs/claude-integration.md`。現状は `mcp/crm-demo/`（依存ゼロの動くデモ）を `.mcp.json` の `crm-demo` として登録済み。本番は各ツールのデータ元を Supabase の RPC 呼び出しへ差し替える（ツール名・操作は不変＝UIとロジック共有）。`.mcp.json` には他に context7 / playwright / figma を登録。
- **MCP（デザイン参照）**: Lazyweb MCP（`https://www.lazyweb.com/mcp`）を**UI参考画面の調査専用**で接続。**用途はモック/デザイン作業に限定し、実顧客データ（機微情報）を一切渡さない**（クエリ・スクショ送出に注意）。トークンは無料・no-billing だが per-user シークレットのため、**ユーザースコープ（`~/.claude.json`）に保存しリポジトリにはコミットしない**（`.mcp.json` には入れない）。外部の個人運営・新興サービスにつき依存しない（参考であって複製ではない）。導入は `curl | bash` を避け公式手動手順を用いる。
- **Hooks**: 自動品質・安全ゲート（編集後の lint/format 自動実行、`.env`等シークレットファイルへの編集ブロック、コミット前のlint/型チェック/テスト）。matcherはツール名の正規表現、許可/拒否はフックスクリプト側でstdinのJSONを読んで終了コードで制御する。
- **Skills** (`.claude/skills/`): 手順系をオンデマンドで（CSV取込手順、Supabaseマイグレーション手順、セキュリティ監査チェックリスト）。
- **Subagents** (`.claude/agents/`): `security-reviewer`（RLS設定・鍵漏洩・機微データ露出の監査を分離コンテキストで）。
- **Plugins**: 上記が安定したらチーム配布用にパッケージ化を検討。

## モックの作法（mockups/）

全画面は静的HTML。`assets/app.css` が**デザインシステム**（CSS変数：インクネイビー×印章ゴールドの「台帳」スタイル、`求=青 / 提=金` のマッチング・シグネチャ）、`assets/app.js` が**共通シェルを注入**する（サイドバー・トップバー・アイコン・`demoModal()`/`toast()`）。

画面を1枚足すとき:
1. `<name>.html` を作り `assets/app.css` と `assets/app.js` を読み込む。
2. `<aside class="sidebar" data-active="<navのid>"></aside>` を置く（app.js がナビを描画）。
3. ナビに出すなら `app.js` の `NAV` / `CONNECT` / `ADMIN` 配列に項目を追加（新アイコンは `I` にSVGパス追加）。
4. 目次 `index.html` のカタログにもカードを足す。

新コンポーネントの色・余白は**既存のCSS変数から導く**（独自の見た目を作らない＝一貫性優先）。`app.js` は全モック共通なので、ナビ変更は全画面に波及する。

## 開発コマンド

**実アプリは scaffold 済み**（Next.js 15 App Router + TS。DBは dev/test=PGlite, 本番=Supabase。詳細手順は `docs/DEPLOY.md`）。

```bash
npm install
# dev（PGlite埋め込みPostgres + dev認証 + seed。要 APP_SESSION_SECRET は dev では自動）
APP_DATA_DRIVER=pglite APP_AUTH=dev APP_SEED=1 npm run dev     # http://localhost:3000
npm run build           # next build（型チェック込み）
npm run typecheck       # tsc --noEmit
npm run lint            # next lint
npm test                # 単体（Vitest）: CSVロジック + PGlite経由のRPC/RLS
npm run test:e2e        # E2E（Playwright）: 全画面・全操作
node scripts/db-validate.mjs   # migrations+seed+RPC の適用確認（PGlite）
```

- **アーキテクチャ**: 全DB操作は SQL RPC 経由（`supabase/migrations/`）＝C-6。`lib/data`(DAL)＋`lib/auth`(認証)。画面は `app/`（App Router）。共通UIは `components/`。設計詳細は `docs/DEPLOY.md`。
- **本番化（Cloudflare/Supabase Tokyo）**: `docs/DEPLOY.md` 参照（OpenNext: `wrangler.jsonc`/`open-next.config.ts`、Supabase Auth連携の完成、Storage署名URL）。
- dev ログインは `yamada@daikichi.example`（admin）等の seed メール（パスワード任意）。本番は Supabase Auth。

現時点で実在する作業（モック・デモMCP）:

**モックのプレビュー**（`mockups/` 内で実行）
- 配信: `python3 -m http.server 8765` → ブラウザで `http://localhost:8765/index.html`（全画面カタログ）。
- スクショ確認は **ローカルの python playwright + バンドル版 chromium**（`p.chromium.launch()`）で撮る。`channel="chrome"` は root が要りこの環境では失敗する。出力は `mockups/shots/`。

**デモMCP**（`mcp/crm-demo/`、read-only・依存ゼロ）
- 起動はClaude Codeが `.mcp.json` 経由で行う（`node mcp/crm-demo/server.mjs`）。設定変更後は `/mcp` で有効化／再起動が必要。
- 単体確認（stdio に JSON-RPC を流す）:
  ```bash
  printf '%s\n' \
   '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}}}' \
   '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
   | node mcp/crm-demo/server.mjs
  ```
- 注意: 依存ゼロの `.mjs`。**ブロックコメント内に `*/` を書かない**（例「X-*/SEC」はコメントを早期に閉じて SyntaxError になる）。詳細・本番化手順は `mcp/crm-demo/README.md`。
