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

function sign(uid: string): string {
  const mac = createHmac('sha256', SECRET).update(uid).digest('base64url');
  return `${uid}.${mac}`;
}
function verify(value: string | undefined): string | null {
  if (!value || !SECRET) return null;
  const i = value.lastIndexOf('.');
  if (i <= 0) return null;
  const uid = value.slice(0, i);
  const mac = value.slice(i + 1);
  const expected = createHmac('sha256', SECRET).update(uid).digest('base64url');
  try {
    const a = Buffer.from(mac);
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) return uid;
  } catch {
    /* ignore */
  }
  return null;
}

type UserRow = { id: string; name: string; email: string; role: 'staff' | 'admin'; active: boolean; avatar_initial: string };
function toUser(u: UserRow | null): SessionUser | null {
  if (!u || !u.id) return null;
  return { id: u.id, name: u.name, email: u.email, role: u.role, avatar: u.avatar_initial };
}

/** 現在のログインユーザー。未ログイン/改ざんcookieは null。 */
export async function getCurrentUser(): Promise<SessionUser | null> {
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
  c.set(COOKIE, sign(uid), { httpOnly: true, sameSite: 'lax', secure: isProd, path: '/', maxAge: 60 * 60 * 24 * 7 });
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
