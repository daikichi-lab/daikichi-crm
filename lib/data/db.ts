import 'server-only';

// データアクセスの単一窓口。全DB操作は RPC（SQL関数）経由＝C-6・SEC-X2（生SQLを外部に晒さない）。
// driver: pglite（dev/test・埋め込みPostgres）/ supabase（本番・PostgREST RPC）。

export type Role = 'authenticated' | 'anon';
export type Ctx = { uid: string | null; role?: Role };

const DRIVER = process.env.APP_DATA_DRIVER === 'supabase' ? 'supabase' : 'pglite';
const RPC_NAME = /^[a-z_][a-z0-9_]*$/;

// ---- PGlite ドライバ（単一接続を直列化） ----
let chain: Promise<unknown> = Promise.resolve();
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn) as Promise<T>;
  chain = run.then(() => {}, () => {});
  return run;
}

async function pgRpc<T>(name: string, args: Record<string, unknown>, ctx: Ctx): Promise<T> {
  const { getPg } = await import('./pglite-server');
  const db = await getPg();
  const keys = Object.keys(args).filter((k) => args[k] !== undefined);
  const params = keys.map((k) => args[k]);
  const role: Role = ctx.role ?? (ctx.uid ? 'authenticated' : 'anon');
  const claims = JSON.stringify(ctx.uid ? { sub: ctx.uid, role } : { role });
  return serialize(() =>
    db.transaction(async (tx) => {
      await tx.exec(`set local role ${role};`);
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [claims]);
      const argSql = keys.length ? '(' + keys.map((k, i) => `${k} := $${i + 1}`).join(', ') + ')' : '()';
      const r = await tx.query<{ result: T }>(`select ${name}${argSql} as result`, params);
      return (r.rows[0]?.result ?? null) as T;
    }),
  );
}

// ---- Supabase ドライバ（本番） ----
async function sbRpc<T>(name: string, args: Record<string, unknown>, ctx: Ctx): Promise<T> {
  const { getSupabaseForCtx } = await import('./supabase-server');
  const supabase = await getSupabaseForCtx(ctx);
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(`[rpc ${name}] ${error.message}`);
  return data as T;
}

/** RPC（SQL関数）を呼ぶ。args は関数の名前付き引数キーに対応。 */
export async function callRpc<T = unknown>(
  name: string,
  args: Record<string, unknown> = {},
  ctx: Ctx,
): Promise<T> {
  if (!RPC_NAME.test(name)) throw new Error(`invalid rpc name: ${name}`);
  return DRIVER === 'supabase' ? sbRpc<T>(name, args, ctx) : pgRpc<T>(name, args, ctx);
}

export const dataDriver = DRIVER;
