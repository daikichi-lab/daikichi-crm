#!/usr/bin/env node
// 本番 Supabase に管理者を作成する（Auth ユーザー＝ハッシュ化パスワード ＋ app_users プロフィール）。
// app_users.id は auth.users.id と一致させる（profile パターン・migrations 0001 の注記）。
//
// 使い方（パスワードは環境変数で渡す＝シェル履歴・git に平文を残さない）:
//   SUPABASE_URL="https://<project>.supabase.co" \
//   SUPABASE_SERVICE_ROLE_KEY="<service_role_key>" \
//   ADMIN_PASSWORD='********' \
//     node scripts/create-admin.mjs --email admin@example.co.jp --name '氏名' [--role admin|staff]
//
// service_role キーは RLS を貫通するためサーバー/手元専用。ブラウザ・NEXT_PUBLIC_* に出さない（SEC-3）。
import { createClient } from '@supabase/supabase-js';

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
function die(msg) {
  console.error(`エラー: ${msg}`);
  process.exit(1);
}

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = arg('email', process.env.ADMIN_EMAIL);
const password = process.env.ADMIN_PASSWORD; // 引数では受けない（平文露出防止）
const role = arg('role', 'admin');
const name = arg('name', process.env.ADMIN_NAME || (email ? email.split('@')[0] : ''));

if (!url || !serviceKey) die('SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY（env）が必要です');
if (!email) die('--email が必要です');
if (!password) die('ADMIN_PASSWORD（env）が必要です');
if (role !== 'admin' && role !== 'staff') die("--role は admin か staff");

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

// 1) Auth ユーザー（既存なら再利用してパスワードを更新＝冪等）
let userId;
const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (created.error) {
  if (/already|exist|registered/i.test(created.error.message)) {
    // 既存メールを一覧から解決（小規模事務所前提。多数なら getUserByEmail 系に置換）
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) die(`既存ユーザー一覧の取得に失敗: ${error.message}`);
    const u = data.users.find((x) => (x.email || '').toLowerCase() === email.toLowerCase());
    if (!u) die('既存メールだが Auth ユーザーを解決できませんでした（perPage を増やして再実行）');
    userId = u.id;
    const upd = await admin.auth.admin.updateUserById(userId, { password });
    if (upd.error) die(`パスワード更新に失敗: ${upd.error.message}`);
    console.log(`既存の Auth ユーザーを更新（パスワード再設定）: ${userId}`);
  } else {
    die(`Auth ユーザー作成に失敗: ${created.error.message}`);
  }
} else {
  userId = created.data.user.id;
  console.log(`Auth ユーザーを作成: ${userId}`);
}

// 2) app_users プロフィール（service_role は RLS を貫通）
const { error: pErr } = await admin
  .from('app_users')
  .upsert({ id: userId, name, email, role, active: true, avatar_initial: [...name][0] || '管' }, { onConflict: 'id' });
if (pErr) die(`app_users プロフィール作成に失敗: ${pErr.message}`);

console.log(`✓ 管理者を作成しました: ${name} <${email}> role=${role} id=${userId}`);
