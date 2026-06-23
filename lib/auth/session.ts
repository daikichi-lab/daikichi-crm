import 'server-only';
import { cookies } from 'next/headers';
import { callRpc, type Ctx } from '../data/db';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: 'staff' | 'admin';
  avatar: string;
};

const AUTH = process.env.APP_AUTH === 'supabase' ? 'supabase' : 'dev';
const COOKIE = 'app_uid';

type UserRow = { id: string; name: string; email: string; role: 'staff' | 'admin'; active: boolean; avatar_initial: string };

function toUser(u: UserRow | null): SessionUser | null {
  if (!u || !u.id) return null;
  return { id: u.id, name: u.name, email: u.email, role: u.role, avatar: u.avatar_initial };
}

/** 現在のログインユーザー。未ログインは null。 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const c = await cookies();
  const uid = c.get(AUTH === 'supabase' ? 'sb-uid' : COOKIE)?.value;
  if (!uid) return null;
  const u = await callRpc<UserRow | null>('app_get_user', { p_id: uid }, { uid, role: 'authenticated' });
  return toUser(u);
}

/** 認証必須。未ログインなら呼び出し側が /login へ。 */
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

/** ログインユーザーから DB 呼び出し用の Ctx を作る。 */
export function ctxOf(user: SessionUser | null): Ctx {
  return user ? { uid: user.id, role: 'authenticated' } : { uid: null, role: 'anon' };
}

export class UnauthorizedError extends Error {
  constructor() {
    super('unauthorized');
    this.name = 'UnauthorizedError';
  }
}
export class ForbiddenError extends Error {
  constructor() {
    super('forbidden');
    this.name = 'ForbiddenError';
  }
}

// --- dev ログイン（メールでユーザー解決・パスワード省略）。本番は Supabase Auth に置換。 ---
export async function devSignIn(email: string): Promise<SessionUser | null> {
  const u = await callRpc<UserRow | null>('app_find_user_by_email', { p_email: email }, { uid: null, role: 'authenticated' });
  const user = toUser(u);
  if (user) {
    const c = await cookies();
    c.set(COOKIE, user.id, { httpOnly: true, sameSite: 'lax', path: '/' });
  }
  return user;
}

export async function signOut(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE);
  c.delete('sb-uid');
  c.delete('sb-access-token');
}

export const authMode = AUTH;
