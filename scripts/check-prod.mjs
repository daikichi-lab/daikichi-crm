#!/usr/bin/env node
// 本番Supabaseの疎通・スキーマ・管理者を確認する（秘密値は出力しない）。
// 使い方: node --env-file=.env.local scripts/check-prod.mjs
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
const mask = (s) => (s ? `${s.slice(0, 4)}…${s.slice(-4)} (len ${s.length})` : '(未設定)');
const ok = (b) => (b ? '✓' : '✗');

console.log('— 環境変数 —');
console.log('  URL:', url || '(未設定)');
console.log('  anon:', mask(anon));
console.log('  service_role:', mask(svc));
if (!url || !anon || !svc) {
  console.error('\n未設定の値があります。.env.local を確認してください。');
  process.exit(1);
}

const db = createClient(url, svc, { auth: { persistSession: false } });
let allOk = true;

// 1) 接続＋スキーマ（app_users が存在＝migrations 適用済み）
console.log('\n— スキーマ / データ —');
const usersRes = await db.from('app_users').select('id,name,email,role,active', { count: 'exact' });
if (usersRes.error) {
  allOk = false;
  console.log(`  ${ok(false)} app_users 参照エラー: ${usersRes.error.message}`);
  console.log('    → migrations 0001〜0010 がまだ適用されていない可能性があります。');
} else {
  console.log(`  ${ok(true)} app_users テーブルあり（${usersRes.count} 名）`);
  const admins = (usersRes.data || []).filter((u) => u.role === 'admin');
  for (const u of usersRes.data || []) {
    console.log(`      - [${u.role}] ${u.email} ${u.active ? '有効' : '無効'}  ${u.name}`);
  }
  const target = (usersRes.data || []).find((u) => (u.email || '').toLowerCase() === 'fuga.shiojiri@daikichi-accg.co.jp');
  console.log(`  ${ok(!!target)} 管理者 fuga.shiojiri@daikichi-accg.co.jp: ${target ? `あり（role=${target.role}）` : '未作成 → scripts/create-admin.mjs を実行'}`);
  if (!target) allOk = false;
  console.log(`  ${ok(admins.length > 0)} admin ロール ${admins.length} 名`);
}

// 2) 主要RPCの存在（app_dashboard を service_role で試行）
console.log('\n— RPC —');
const rpc = await db.rpc('app_dashboard');
if (rpc.error) {
  allOk = false;
  console.log(`  ${ok(false)} app_dashboard: ${rpc.error.message}`);
} else {
  console.log(`  ${ok(true)} app_dashboard 実行OK（companies_total=${rpc.data?.companies_total ?? '?'}）`);
}

// 3) マスタ（業種）が投入済みか
const ind = await db.from('industries').select('label', { count: 'exact', head: true });
if (ind.error) console.log(`  ${ok(false)} industries: ${ind.error.message}`);
else console.log(`  ${ok((ind.count ?? 0) > 0)} 業種マスタ ${ind.count ?? 0} 件${(ind.count ?? 0) === 0 ? ' → マスタ未投入' : ''}`);

// 3.5) Storage バケット（手作業で作成する business-cards / company-documents・非公開）
console.log('\n— Storage —');
const buckets = await db.storage.listBuckets();
if (buckets.error) {
  console.log(`  ✗ バケット一覧の取得に失敗: ${buckets.error.message}`);
} else {
  for (const name of ['business-cards', 'company-documents']) {
    const b = (buckets.data || []).find((x) => x.name === name);
    if (!b) { console.log(`  ✗ バケット ${name}: 未作成 → ダッシュボードで作成（非公開）`); allOk = false; }
    else console.log(`  ${b.public ? '⚠' : '✓'} バケット ${name}: あり（${b.public ? '公開＝要修正（非公開に）' : '非公開'}）`);
  }
}
// 0011 判定は create_document の存在で（未適用なら PostgREST が関数未検出エラーを返す）
const rpcDoc = await db.rpc('create_document', { p: {} });
const applied0011 = !rpcDoc.error; // 適用済みなら app レベルの {error:'…必須'} が返り、PostgREST error は無い
console.log(`  ${applied0011 ? '✓' : '✗'} 資料RPC(0011適用): ${applied0011 ? 'create_document あり' : 'create_document 未検出 → migration 0011 を適用'}`);
if (!applied0011) allOk = false;

// 4) anon の権限確認（anonでは app_users を読めないのが正常＝RLS）
console.log('\n— RLS（anon は保護データを読めないのが正常）—');
const anonDb = createClient(url, anon, { auth: { persistSession: false } });
const anonRead = await anonDb.from('app_users').select('id').limit(1);
const blocked = !!anonRead.error || (anonRead.data || []).length === 0;
console.log(`  ${ok(blocked)} anon からの app_users 読み取りは${blocked ? '遮断（正常）' : '許可されてしまっている ⚠'}`);
if (!blocked) allOk = false;

console.log(`\n結果: ${allOk ? '✓ 本番接続の基本チェックは合格' : '✗ 未完了の項目あり（上記参照）'}`);
process.exit(allOk ? 0 : 2);
