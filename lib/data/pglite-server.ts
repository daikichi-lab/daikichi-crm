import 'server-only';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';

// dev/test 用の埋め込み Postgres（PGlite）。**プロセス内シングルトン**。
// Next の本番ビルドでは route セグメント／サーバーアクションが別モジュールグラフに
// なり得るため、globalThis にキャッシュして同一プロセス内で1インスタンスを共有する
// （別インスタンスだと書き込みが読み取りに反映されない）。
// bootstrap（Supabase互換shim）→ migrations → seed を一度だけ適用する。
const globalForPg = globalThis as unknown as { __daikichiPg?: Promise<PGlite> };

function dir(...p: string[]) {
  return join(process.cwd(), 'supabase', ...p);
}

async function init(): Promise<PGlite> {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite();
  await db.exec("set time zone 'Asia/Tokyo';");
  await db.exec(readFileSync(dir('_pglite_bootstrap.sql'), 'utf8'));
  const migDir = dir('migrations');
  for (const f of readdirSync(migDir).filter((x) => x.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(migDir, f), 'utf8'));
  }
  if (process.env.APP_SEED === '1') {
    const seed = dir('seed', 'seed.sql');
    if (existsSync(seed)) await db.exec(readFileSync(seed, 'utf8'));
  }
  return db;
}

export function getPg(): Promise<PGlite> {
  return (globalForPg.__daikichiPg ??= init());
}
