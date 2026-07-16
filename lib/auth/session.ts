import 'server-only';
import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { callRpc } from '../data/db';
import type { Ctx } from '../data/db';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: 'staff' | 'admin';
  avatar: string;
};

// 認証モード解決（fail-closed）:
//  - APP_AUTH を明示指定すればそれに従う（'dev' / 'supabase'）。
//  - 未指定なら、本番(NODE_ENV=production)は 'supabase'、それ以外は 'dev'。
//  → dev認証は**明示的なオプトイン**でのみ本番に乗る（既定では絶対に有効化されない）。
export const authMode: 'dev' | 'supabase' =
  process.env.APP_AUTH === 'dev'
    ? 'dev'
    : process.env.APP_AUTH === 'supabase'
      ? 'supabase'
      : process.env.NODE_ENV === 'production'
        ? 'supabase'
        : 'dev';

const COOKIE = 'app_session';
const isProd = process.env.NODE_ENV === 'production';
// セッション署名鍵。本番は APP_SESSION_SECRET 必須（無ければ署名検証が常に失敗＝fail closed）。
const SECRET = process.env.APP_SESSION_SECRET || (isProd ? '' : 'dev-insecure-secret-do-not-use-in-prod');
const SESSION_TTL_SEC = 60 * 60 * 24 * 7; // 7日

// セッション値 = `uid.exp.mac`（exp=失効UNIX秒）。exp を署名対象に含めてサーバー側で失効を強制する
// （旧形式 `uid.mac` は無期限に有効だった＝security review 指摘2。旧cookieは検証不一致で無効化される）。
function sign(uid: string): string {
  const payload = `${uid}.${Math.floor(Date.now() / 1000) + SESSION_TTL_SEC}`;
  const mac = createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${mac}`;
}
function verify(value: string | undefined): string | null {
  if (!value || !SECRET) return null;
  const i = value.lastIndexOf('.');
  if (i <= 0) return null;
  const payload = value.slice(0, i); // `uid.exp`
  const mac = value.slice(i + 1);
  const expected = createHmac('sha256', SECRET).update(payload).digest('base64url');
  let ok = false;
  try {
    const a = Buffer.from(mac);
    const b = Buffer.from(expected);
    ok = a.length === b.length && timingSafeEqual(a, b);
  } catch {
    /* ignore */
  }
  if (!ok) return null;
  const j = payload.lastIndexOf('.');
  if (j <= 0) return null;
  const uid = payload.slice(0, j);
  const exp = Number(payload.slice(j + 1));
  if (!Number.isFinite(exp) || exp * 1000 <= Date.now()) return null; // 期限切れ＝失効
  return uid || null;
}

type UserRow = { id: string; name: string; email: string; role: 'staff' | 'admin'; active: boolean; avatar_initial: string };
function toUser(u: UserRow | null): SessionUser | null {
  // 無効化(active=false)ユーザーは認証しない（多層防御・security review 指摘1）。
  // app_get_user 側でも and active でフィルタ済みだが、他経路からの流入にも備える。
  if (!u || !u.id || u.active === false) return null;
  return { id: u.id, name: u.name, email: u.email, role: u.role, avatar: u.avatar_initial };
}

/** 現在のログインユーザー。未ログイン/改ざんcookie/無効化ユーザーは null。 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  if (authMode === 'supabase') {
    // Supabase 未設定（ビルド時・未構築環境）は未ログイン扱いで null（例外にしない）。実RPCの実行時throwは維持。
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
    // Supabase Auth: getUser() で JWT を検証し（getSession は非検証のため使わない）、profile を突合。
    // Supabase 到達不可・トークン不正は未ログイン扱い（fail-closed）。
    try {
      const { supabaseServerClient } = await import('../data/supabase-server');
      const supabase = await supabaseServerClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) return null;
      const u = await callRpc<UserRow | null>('app_get_user', { p_id: user.id }, { uid: user.id, role: 'authenticated' });
      return toUser(u); // app_get_user は and active でフィルタ済み＋toUser でも二重チェック
    } catch {
      return null;
    }
  }
  // dev: HMAC 署名 cookie
  const c = await cookies();
  const uid = verify(c.get(COOKIE)?.value);
  if (!uid) return null;
  const u = await callRpc<UserRow | null>('app_get_user', { p_id: uid }, { uid, role: 'authenticated' });
  return toUser(u);
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) throw new UnauthorizedError();
  return u;
}
export async function requireAdmin(): Promise<SessionUser> {
  const u = await requireUser();
  if (u.role !== 'admin') throw new ForbiddenError();
  return u;
}
export function ctxOf(user: SessionUser | null): Ctx {
  return user ? { uid: user.id, role: 'authenticated' } : { uid: null, role: 'anon' };
}

export class UnauthorizedError extends Error {
  constructor() { super('unauthorized'); this.name = 'UnauthorizedError'; }
}
export class ForbiddenError extends Error {
  constructor() { super('forbidden'); this.name = 'ForbiddenError'; }
}

function setSession(uid: string, c: Awaited<ReturnType<typeof cookies>>) {
  c.set(COOKIE, sign(uid), { httpOnly: true, sameSite: 'lax', secure: isProd, path: '/', maxAge: SESSION_TTL_SEC });
}

/**
 * dev ログイン（メールでユーザー解決・パスワード省略）。authMode==='dev' のときのみ有効。
 * 本番の正規ログインは Supabase Auth（signInWithPassword）に置き換える。
 */
export async function devSignIn(email: string): Promise<SessionUser | null> {
  if (authMode !== 'dev') return null;
  const u = await callRpc<UserRow | null>('app_find_user_by_email', { p_email: email }, { uid: null, role: 'authenticated' });
  const user = toUser(u);
  if (user) setSession(user.id, await cookies());
  return user;
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/**
 * 本番ログイン（Supabase Auth・メール+パスワード）。authMode==='supabase' のときのみ有効。
 * 成功時に @supabase/ssr が認証 cookie を書き込む（サーバーアクション内で呼ぶこと）。
 */
export async function supabaseSignIn(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  if (authMode !== 'supabase') return { ok: false, error: 'not supabase mode' };
  const { supabaseServerClient } = await import('../data/supabase-server');
  const supabase = await supabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** 本番サインアウト（Supabase の認証 cookie をクリア）。 */
export async function supabaseSignOut(): Promise<void> {
  if (authMode !== 'supabase') return;
  const { supabaseServerClient } = await import('../data/supabase-server');
  const supabase = await supabaseServerClient();
  await supabase.auth.signOut();
}

/** パスワードリセットメールを送信（Supabase Auth）。 */
export async function supabaseResetPassword(email: string, redirectTo?: string): Promise<{ ok: boolean; error?: string }> {
  if (authMode !== 'supabase') return { ok: false, error: 'not supabase mode' };
  const { supabaseServerClient } = await import('../data/supabase-server');
  const supabase = await supabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
