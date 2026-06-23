# 大吉CRM デモMCP（Claude Code 連携）

ローカルの **Claude Code / Claude Desktop** から、大吉CRMを **自然言語で read-only 操作**するための
デモ用カスタムMCPサーバです。仕様は `docs/claude-integration.md`（カスタムMCP一択）に準拠。

- **依存パッケージなし**（Node標準のみ）。`npm install` 不要。
- **read-only**：書き込みツールは持ちません（SEC-X1）。
- **最小権限**：生SQLは受け付けず、決めたツールのみ（SEC-X2）。連絡先(email/電話)は**既定でマスク**（SEC-X4）。
- 現状は **デモデータ**（モック画面と同じ世界の10社・保管資料18件・活動履歴13件）を返します。本番は Supabase に差し替え（後述）。

---

## 1. 導入（セットアップ）

前提: Node.js（`node -v` で確認。v18以降）。本リポジトリ直下に `.mcp.json` があり、
`crm-demo` サーバが**登録済み**です:

```jsonc
// .mcp.json（抜粋）
"crm-demo": {
  "type": "stdio",
  "command": "node",
  "args": ["mcp/crm-demo/server.mjs"],
  "env": {}
}
```

### Claude Code で有効化
1. このリポジトリのディレクトリで `claude` を起動（またはVS Code拡張で開く）。
2. プロジェクトの `.mcp.json` を検出すると、**MCPサーバを有効化してよいか確認**が出ます → 許可。
   - 手動確認: スラッシュコマンド **`/mcp`** でサーバ一覧と状態（`crm-demo` が `connected`）を確認。
3. 以降、Claude Code が必要に応じて `crm-demo` のツールを呼びます。

> Claude Desktop で使う場合は、Desktop の MCP 設定に同じ `command`/`args` を、
> `args` を**絶対パス**（例: `/home/<you>/daikichi-crm/mcp/crm-demo/server.mjs`）で登録してください。

### 単体での動作確認（任意）
```bash
printf '%s\n' \
'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}}}' \
'{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
| node mcp/crm-demo/server.mjs
```
→ `tools/list` に10ツールが並べばOK。

---

## 2. システムの操作方法（Claudeへの頼み方）

Claude Code に**ふつうの日本語で**頼めば、裏で適切なツールが呼ばれます。例:

| やりたいこと | 言い方の例 | 使われるツール |
|---|---|---|
| 顧客を絞り込む | 「東京の卸売で顧問中の会社を出して」 | `search_companies` |
| 企業の詳細 | 「大吉商事の詳細と担当者を見せて」 | `get_company` |
| 会った人を探す | 「主担当の人を会社横断で一覧して」 | `list_contacts` |
| 紹介候補（マッチング）| 「大吉商事に紹介できる相手は？根拠タグも」 | `find_matches` |
| おすすめの組み合わせ | 「相性の良い紹介の組み合わせを上位5件」 | `suggest_matches` |
| タグ語彙 | 「使われている求/提タグを一覧して」 | `list_tags` |
| マスタ確認 | 「業種・エリア・規模のマスタを見せて」 | `get_masters` |
| メルマガ宛先の規模感 | 「税制改正ニュース購読で東京の対象人数は？」 | `get_newsletter_segment` |
| 資料を全社横断で探す | 「全社の“商品カタログ”を一覧して」「決算書の資料はどこにある？」 | `search_documents` |
| 顧客の活動履歴を見る | 「大吉商事に最近何をした？時系列で」「テック合同会社の議事録だけ」 | `get_company_timeline` |
| 下書き（応用） | 「飲食の見込み客向けにセミナー案内を300字で。宛先の規模も添えて」 | `get_newsletter_segment` + Claudeが本文作成 |

ポイント:
- **本文や提案文はClaude自身が書きます**。ツールは「素材（宛先・候補・条件）」を返すだけ＝**追加のLLM課金なし**（FR-X3）。
- 検索・マッチングの**ロジックは1か所**（本番はDBのRPC）。だから**UIと同じ結果**になります（C-6）。

---

## 3. セキュリティ（read-only前提）

- **書き込み不可**：このサーバに更新系ツールはありません（SEC-X1）。
- **生SQL不可**：決められたツールだけ（SEC-X2）。
- **PII最小化**：`email`/電話は既定でマスク。`reveal_contact_info: true` を指定した時だけ復元（SEC-X4）。
- **資料はメタデータのみ**：`search_documents` はファイル名・種別・会社・サイズ等の**メタデータだけ**返し、**ファイル本体・署名URLは返しません**（SEC-12）。実体の閲覧/DLはUI側で署名URL発行。
- **活動履歴は要約のみ**：`get_company_timeline` は活動の要約＋参照（種別・要点・担当・元レコードID）だけを返し、**議事録全文・名刺・資料の実体や連絡先は返しません**（SEC-13/SEC-X4）。
- **⚠️ データ送信先**：「手元のClaude」でも**モデルはクラウド（Anthropic）**。ツールが返した内容は
  Anthropicへ送信されます。本番では**返す列を絞る／用途を社内合意**する（SEC-X5・C-7）。
- 本番は `service_role` を使わず、**読み取り専用ロール＋ホワイトリストRPCのEXECUTE**で接続（SEC-X3/X6）。

---

## 4. 本番化（Supabaseへ差し替え）

`server.mjs` の各 `t_*`（ツール本体）を、Supabase の RPC 呼び出しに置き換えるだけです（`§SUPABASE` コメント参照）。
**ツール名・入出力・操作方法は変えない**ので、Claude側の使い方はそのまま。

```js
// 例: search_companies を PostgREST RPC に置換
async function t_search_companies(a={}){
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/search_companies`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', apikey: process.env.SUPABASE_READONLY_KEY,
              Authorization:`Bearer ${process.env.SUPABASE_READONLY_KEY}` },
    body: JSON.stringify(a)
  });
  return await res.json();   // 列の絞り込みはRPC側で（PII最小化）
}
```
鍵は `process.env`（ローカル）/ Cloudflare Secrets（リモート）から読み、**Claudeには渡しません**。
```
