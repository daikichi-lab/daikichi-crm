#!/usr/bin/env node
// 本番Supabaseにマスタ（業種 / メルマガトピック / タグ）を投入する。デモ企業・担当者は入れない。
// 冪等: 既存ラベルは on conflict do nothing 相当（upsert onConflict:label）。値は seed.sql と同一（正典）。
// 使い方: node --env-file=.env.local scripts/seed-masters.mjs
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !svc) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY（env）が必要です');
  process.exit(1);
}
const db = createClient(url, svc, { auth: { persistSession: false } });

const INDUSTRIES = ['農林漁業', '建設', '製造', '卸売', '小売', '飲食', '宿泊・観光', '運輸・物流', 'IT・情報通信',
  '不動産', '金融・保険', '専門サービス', '医療・福祉', '教育・学習支援', '美容・理容', '生活関連サービス', '広告・メディア', 'その他'];
const TOPICS = ['税制改正ニュース', 'セミナー・勉強会案内', '経営お役立ち情報', '年末調整のお知らせ', '決算前リマインド'];
const TAGS = ['集客', 'EC強化', '食材卸', '配送代行', '記帳代行', 'Web広告', 'ブランディング',
  '店舗内装', '人材採用', '販路拡大', 'システム開発', '資金調達', '海産物卸'];

async function upsert(table, rows, conflict) {
  const { error } = await db.from(table).upsert(rows, { onConflict: conflict, ignoreDuplicates: true });
  if (error) {
    console.error(`  ✗ ${table}: ${error.message}`);
    return false;
  }
  const { count } = await db.from(table).select('*', { count: 'exact', head: true });
  console.log(`  ✓ ${table}: ${count} 件`);
  return true;
}

console.log('— マスタ投入 —');
let ok = true;
ok = (await upsert('industries', INDUSTRIES.map((label, i) => ({ label, sort: i + 1 })), 'label')) && ok;
ok = (await upsert('newsletter_topics', TOPICS.map((label, i) => ({ label, sort: i + 1 })), 'label')) && ok;
ok = (await upsert('tags', TAGS.map((label) => ({ label })), 'label')) && ok;
console.log(ok ? '\n✓ マスタ投入 完了' : '\n✗ 一部失敗');
process.exit(ok ? 0 : 2);
