'use server';

import { revalidatePath } from 'next/cache';
import { inviteUser, setUserRole, setUserActive, deleteUser, restoreUser } from '@/lib/data/dal';
import { requireAdmin, authMode } from '@/lib/auth/session';

/**
 * 管理画面からユーザーを追加する（メール招待は廃止）。
 * - 本番(supabase): service_role で Supabase Auth ユーザー（メール+仮パスワード）を作成し、
 *   app_users プロフィールを同じ id で作成。管理者が本人にメール/パスワードを伝える運用。
 * - dev: プロフィールのみ作成（dev認証はメールのみ・パスワード不問）。
 */
export async function createUserAction(
  p: { name: string; email: string; password: string; role: string },
): Promise<{ ok?: boolean; error?: string }> {
  await requireAdmin();
  const email = p.email.trim().toLowerCase();
  const name = p.name.trim() || email.split('@')[0];
  const role = p.role === 'admin' ? 'admin' : 'staff';
  if (!email) return { error: 'メールアドレスを入力してください' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'メールアドレスの形式が正しくありません' };

  if (authMode === 'supabase') {
    if (!p.password || p.password.length < 8) return { error: 'パスワードは8文字以上で設定してください' };
    try {
      const { supabaseAdminClient } = await import('@/lib/data/supabase-server');
      const admin = supabaseAdminClient();
      const created = await admin.auth.admin.createUser({ email, password: p.password, email_confirm: true });
      let userId: string | undefined;
      if (created.error) {
        if (/already|exist|registered/i.test(created.error.message)) return { error: '既に存在するメールです' };
        return { error: `作成に失敗しました: ${created.error.message}` };
      }
      userId = created.data.user?.id;
      if (!userId) return { error: 'ユーザーIDを取得できませんでした' };
      const { error: pErr } = await admin
        .from('app_users')
        .upsert({ id: userId, name, email, role, active: true, avatar_initial: [...name][0] || '？' }, { onConflict: 'id' });
      if (pErr) return { error: `プロフィール作成に失敗しました: ${pErr.message}` };
      revalidatePath('/admin/users');
      return { ok: true };
    } catch (e) {
      return { error: e instanceof Error ? e.message : '作成に失敗しました' };
    }
  }

  // dev: プロフィールのみ（パスワードは dev では未使用）
  const res = await inviteUser(name, email, role);
  revalidatePath('/admin/users');
  return res?.error ? { error: res.error } : { ok: true };
}

export async function setUserRoleAction(id: string, role: string): Promise<{ ok?: boolean; error?: string }> {
  const res = await setUserRole(id, role);
  revalidatePath('/admin/users');
  return res?.error ? { error: res.error } : { ok: true };
}

export async function setUserActiveAction(id: string, active: boolean): Promise<{ ok?: boolean; error?: string }> {
  const res = await setUserActive(id, active);
  revalidatePath('/admin/users');
  return res?.error ? { error: res.error } : { ok: true };
}

/** 論理削除（退職等）。活動履歴の担当名は保持される。 */
export async function deleteUserAction(id: string): Promise<{ ok?: boolean; error?: string }> {
  const res = await deleteUser(id);
  revalidatePath('/admin/users');
  return res?.error ? { error: res.error } : { ok: true };
}
export async function restoreUserAction(id: string): Promise<{ ok?: boolean; error?: string }> {
  const res = await restoreUser(id);
  revalidatePath('/admin/users');
  return res?.error ? { error: res.error } : { ok: true };
}
