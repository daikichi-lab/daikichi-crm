import 'server-only';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';

// dev/test 用の埋め込み Postgres（PGlite）。プロセス内シングルトン。
// bootstrap（Supabase互換shim）→ migrations → seed を一度だけ適用する。
let ready: Promise<PGlite> | null = null;

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
  return (ready ??= init());
}
