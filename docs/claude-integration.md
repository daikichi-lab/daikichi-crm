# 機能仕様 — Claude 連携（カスタムMCP）

- **版**: 0.2（ドラフト）
- **最終更新**: 2026-06-23
- **位置づけ**: `docs/requirements.md`（FR-X1〜X3）と `CLAUDE.md`「Claude連携」を具体化する補足仕様。番号は本書独自に `X-*`（設計判断）/ `SEC-X*`（セキュリティ）を用い、既存の `FR-*` / `SEC-*` / `C-*` を参照する。
- **矛盾時の優先**: `CLAUDE.md` > `requirements.md` > 本書。
- **v0.2 変更点**: 実装済みの **`search_documents`**（資料の全社横断メタ検索・FR-F10〜F13 / SEC-12）を §4 ツール表・§8 に追記。活動履歴の読み取りツール候補 **`get_company_timeline`**（FR-AC10）を §4・§9 に追加。デモMCP（`mcp/crm-demo/`）は現在**計9ツール**。

---

## 1. 目的

ローカルの Claude（Claude Desktop / Claude Code）から、**自然言語で大吉CRMを操作**できるようにする。検索・絞り込み・マッチング・メルマガ下書きを、**ブラウザUIと同じデータ・同じロジック（DB側RPC）で**実行し、結果を一致させる（C-6 / FR-X1）。実現手段は **CRM専用のカスタムMCPサーバ**に一本化する。

---

## 2. 確定した設計判断

ユーザーと合意済み（2026-06-22）。

- **X-1 カスタムMCP一択。** 連携は **CRM専用に自作するMCPサーバ**で行う。**Supabase 公式MCP（汎用・生SQL/RLS貫通）は本番採用しない**（広すぎる）。アプリ内からの **Claude API 直叩きも採用しない**（従量課金＝C-1に反する）。
- **X-2 まず read-only。** Phase 1 のツールは**参照系のみ**（書き込みなし）。FR-X2「read-only モード」を踏襲。書き込みツールは Phase 2 で**確認＋監査つき**に限り検討（§8）。
- **X-3 ロジックは1か所（共有RPC/DAL）。** MCPはマッチングや検索を**再実装しない**。UIと同じ **Postgres RPC関数 / データアクセス層(DAL)** を薄く包むだけ（C-6・二重メンテ回避）。
- **X-4 無料維持。** MCP＋手元のClaudeサブスクリプションで運用し、**従量のLLM API課金を発生させない**（C-1 / FR-X3）。
- **X-5 既定はローカル stdio 起動。** スタッフPCで Claude Desktop / Claude Code が起動する**ローカルstdio**を既定とする。チームで共有したくなったら **Cloudflare Workers 上の HTTP(SSE) MCP** へ拡張（§8）。
- **X-6 最小権限。** Claudeには「決めたツールだけ」を見せ、**生SQLを渡さない**。DBへは `service_role` ではなく**読み取り専用の限定ロール**で接続し、**ホワイトリストしたRPCのEXECUTEのみ**許可する（§5）。

---

## 3. 構成（層構造）

```
                  ┌── Web画面 ……………… 人間（ブラウザ）              ┐
共有ロジック ←────┼── カスタムMCPサーバ … Claude（自然言語で自律操作）┤
（RPC関数/DAL）    └──(将来) REST API … スクリプト/自動化              ┘
  ↑ 唯一の正＝Supabase DB（東京・C-7）
```

- **土台**：検索/マッチング等のロジックは **Postgres の RPC関数（SQL）** に集約（C-6）。UIもMCPもこれを呼ぶ。
- **カスタムMCP**：MCP SDK で書く小さなサーバ。各ツールは対応するRPCを呼び、結果を整形してClaudeへ返すだけ。
- **REST API**：必要になったら Supabase の自動生成（PostgREST）を使う。本書のスコープ外（用意は容易）。

ツール定義のイメージ（案・確定ではない）:

```ts
// search_companies ツール（読み取り専用・RPCを呼ぶだけ）
server.tool("search_companies", {
  description: "条件で顧客（企業）を検索して一覧を返す。UIの絞り込みと同一。",
  inputSchema: { type, industry, area, status, needs, offers, keyword, limit },
}, async (args) => {
  // 限定ロールで SECURITY DEFINER の RPC を呼ぶ（生SQLは書かない）
  const rows = await rpc("search_companies", args);   // ← UIと同じRPC
  return rows.map(pickAllowedColumns);                // ← 必要列だけ（PII最小化）
});
```

---

## 4. 公開ツール仕様（案）

Phase 1 は参照系のみ（X-2）。すべて**対応RPCを呼ぶ薄いラッパ**。

| ツール | 用途 | 主な入力 | 出力（必要列のみ） | 権限 | 対応 |
|---|---|---|---|---|---|
| `search_companies` | 顧客を条件検索 | type/industry/area/status/needs/offers/keyword | id, name, type, industry, area, status, needs, offers | read | FR-C6 |
| `get_company` | 企業の詳細＋担当者要約 | company_id | 企業項目＋担当者名/役職（連絡先は既定で**マスク**、要時のみ） | read | FR-C3 |
| `list_contacts` | 「会った人」横断一覧 | keyword/company/primaryOnly | 氏名, 会社, 役職, 最終接点（email/phoneは既定マスク） | read | 会った人 |
| `find_matches` | 紹介候補をスコア順で取得 | company_id | 相手企業, スコア, 重なりタグ, 方向（協業/顧客紹介） | read | FR-M1〜M4 |
| `suggest_matches` | 起点指定なしのおすすめ | limit | 相性の高い組み合わせ | read | FR-M6 |
| `list_tags` | 求/提タグ語彙 | — | label, 使用件数 | read | FR-T |
| `get_masters` | 業種/エリア/規模マスタ | — | マスタ値一覧 | read | §8.6 |
| `get_newsletter_segment` | メルマガ宛先の規模感 | topic_ids, filters | 対象人数, サンプル（**本文はClaudeが作成**） | read | FR-N8/N12 |
| `search_documents` | 企業の保管資料を全社横断でメタ検索 | keyword/category/company/limit | company, file_name, category, size, uploaded_by, created_at（**本体・署名URLは返さない**） | read | FR-F10〜F13 |

> **文章生成（下書き）は Claude 自身が担当**する（FR-X3）。ツールは「宛先・条件・素材データ」を返すだけで、LLM呼び出しはツール内で行わない（追加課金なし＝C-1）。

**参照系の将来候補（read-only）**: `get_company_timeline`（企業の活動履歴を時系列で取得・FR-AC10。PII最小化・SEC-X4）。

**Phase 2 候補（書き込み・要確認＋監査つき／別途合意）**: `save_newsletter_draft`、`create_referral`（紹介起票・FR-R4）など。実行前に Claude に確認させ、`created_by` と操作ログを残す（NFR-9）。

---

## 5. 認証・権限（最小権限）

- **X-6 の具体化**:
  - MCPサーバは DB に **読み取り専用の専用ロール**で接続（`service_role` を使わない）。
  - そのロールには**ホワイトリストしたRPCの `EXECUTE` のみ**付与。テーブルへの広い `SELECT` 付与はしない（RPCを `SECURITY DEFINER` で必要範囲に限定）。
  - **Claudeにはキーを一切渡さない**。キー/接続情報はMCPサーバの環境変数（ローカル）または Cloudflare Secrets（リモート）に置く（SEC-5）。
- 大吉CRMは「全員で共有」（requirements §5）のため、MCPは**事務所共通のデータ範囲**を読む。per-userのRLS絞り込みは不要だが、**RPC粒度での最小権限**は維持する。

---

## 6. セキュリティ要件（SEC-X）

- **SEC-X1 read-only 既定。** Phase 1 は参照系のみ。書き込みは Phase 2 で確認＋監査つきに限定（X-2）。
- **SEC-X2 生SQLを渡さない。** Claudeが触れるのは定義済みツールのみ。任意SQL実行は提供しない（公式MCP不採用の主因）。
- **SEC-X3 `service_role`/secretをClaude・ブラウザに出さない。** MCPサーバ側のみ保持（SEC-3/5）。
- **SEC-X4 PII最小化。** ツールは**必要な列だけ**返す。連絡先（email/phone）や名刺は既定でマスクし、明示要求時のみ・用途を限定して返す。
- **SEC-X5 ⚠️ データ送信先の明示（最重要・正直に）。** 「手元のClaude」と言っても **Claudeモデルはクラウド（Anthropic）**。MCPで取得したデータは**Anthropicへ送信される**。会計事務所の機微情報のため、**何をClaudeに渡すか**を事務所で合意し、最小限にする（C-7／Tesseract.jsで外部OCRを避けた判断と同じ土俵）。
  - 補足: 無料＝従量課金なし（C-1）であって、データがローカルに留まる意味ではない。
- **SEC-X6 監査。** MCP経由の主要操作（特に Phase 2 の書き込み）は誰が・いつ・何を、を記録（NFR-9）。read系もアクセスログを残せると望ましい。
- **SEC-X7 接続範囲の限定。** 対象は当該Supabaseプロジェクトのみ（CLAUDE.md「対象プロジェクト限定」）。

---

## 7. 無料維持（C-1）

- 手元のClaude（Desktop / Code）の**サブスクリプション内**で動かし、**従量のLLM API課金を出さない**（FR-X3 / X-4）。
- MCPサーバ自体は軽量。ローカルstdioなら追加ホスティング費ゼロ。リモートにする場合も Cloudflare Workers 無料枠で賄える。

---

## 8. フェーズ

| フェーズ | 内容 |
|---|---|
| **前提（Phase 0/1）** | Supabase 稼働、検索/マッチングの **RPC関数**が存在すること（UIと共有）。 |
| **MCP-1（参照MVP）** | ローカルstdioのカスタムMCP。`search_companies`/`get_company`/`find_matches`/`suggest_matches`/`list_contacts`/`list_tags`/`get_masters`/`get_newsletter_segment`/`search_documents`（**計9ツール**）。read-only・最小権限・PIIマスク。**→ デモ実装済（`mcp/crm-demo/`・依存ゼロ・デモデータ）。`.mcp.json` に `crm-demo` 登録済。Supabase稼働後に各ツールのデータ元を RPC へ差し替えて本番化。** |
| **MCP-2（下書き支援）** | `get_newsletter_segment` 等で宛先文脈を渡し、Claudeがメルマガ/紹介提案文を下書き（FR-N12/FR-X3）。 |
| **MCP-3（拡張）** | 必要なら Cloudflare 上の HTTP(SSE) MCP でチーム共有。書き込みツール（`create_referral` 等）を**確認＋監査つき**で限定追加。 |

---

## 9. 未確定事項（次に決める）

1. **書き込みの可否**: Phase 2 で `create_referral` / `save_newsletter_draft` を入れるか（read-onlyのままにするか）。
2. **連絡先・名刺の扱い**: MCPでemail/phone/名刺を返す条件（既定マスク → 明示要求時のみ、で良いか）。
3. **接続クライアント**: Claude Desktop と Claude Code のどちらを主に使うか（両対応は可能）。
4. **ローカル or リモート**: 当面ローカルstdioで良いか、最初からCloudflareのHTTP MCPにするか。
5. **活動履歴の読み取りツール**: `get_company_timeline`（FR-AC10）を MCP に追加するか（read-only・PII最小化・SEC-X4）。`search_documents` は実装済のため本番RPC化のみ。

---

## 10. 次アクション（合意後）

1. 本書のレビュー・§9 の確定。
2. Phase 1 実装時に、UIと共有する**検索/マッチングRPC**を確定（C-6）。
3. 読み取り専用ロール＋RPCホワイトリスト（`EXECUTE`）の権限設計、`security-reviewer` で監査。
4. ✅ デモのカスタムMCP（MCP-1）を実装・接続確認・`.mcp.json` 登録済（`mcp/crm-demo/`）。本番はこのツール群のデータ元を Supabase RPC に差し替える。
5. PIIマスク・SEC-X5 の社内合意を文書化。
