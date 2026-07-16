// DB検証ハーネス: PGlite に bootstrap → migrations → seed を適用し、アサーションを実行。
// 使い方: node scripts/db-validate.mjs   (リポジトリ直下から)
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIG = join(ROOT, 'supabase', 'migrations');
const BOOTSTRAP = join(ROOT, 'supabase', '_pglite_bootstrap.sql');
const SEED = join(ROOT, 'supabase', 'seed', 'seed.sql');

function read(p) { return readFileSync(p, 'utf8'); }

export async function buildDb({ seed = true } = {}) {
  const db = new PGlite();
  await db.exec(read(BOOTSTRAP));
  const files = readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    try { await db.exec(read(join(MIG, f))); }
    catch (e) { throw new Error(`migration ${f} failed: ${e.message}`); }
  }
  if (seed && existsSync(SEED)) {
    try { await db.exec(read(SEED)); }
    catch (e) { throw new Error(`seed failed: ${e.message}`); }
  }
  return db;
}

// 認証ロール文脈を設定（Supabase の PostgREST 相当）。
export async function asUser(db, userId, role = 'authenticated') {
  await db.exec(`set role ${role};`);
  // is_local=false: セッションに永続（ハーネスは明示トランザクションを張らないため）
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [
    JSON.stringify({ sub: userId, role }),
  ]);
}
export async function asAnon(db) {
  await db.exec(`set role anon;`);
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ role: 'anon' })]);
}
export async function asAdminDb(db) { await db.exec('reset role;'); }

if (import.meta.url === `file://${process.argv[1]}`) {
  const db = await buildDb({ seed: existsSync(SEED) });
  const tables = await db.query(
    `select table_name from information_schema.tables where table_schema='public' order by table_name`
  );
  console.log('tables:', tables.rows.map((r) => r.table_name).join(', '));
  if (existsSync(SEED)) {
    for (const t of ['app_users', 'companies', 'contacts', 'company_documents', 'activities', 'tags']) {
      const c = await db.query(`select count(*)::int n from ${t}`);
      console.log(`  ${t}: ${c.rows[0].n}`);
    }
  }
  console.log('OK: bootstrap + migrations' + (existsSync(SEED) ? ' + seed' : '') + ' applied');
}
