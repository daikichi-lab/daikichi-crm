'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { signOut, supabaseSignOut, authMode, requireUser } from '@/lib/auth/session';
import { updateMyProfile } from '@/lib/data/dal';

export async function updateMyProfileAction(name: string): Promise<{ ok?: boolean; error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: '表示名を入力してください' };
  const res = await updateMyProfile(trimmed);
  revalidatePath('/account');
  return res?.error ? { error: res.error } : { ok: true };
}

/**
 * 自分のパスワードを変更（本番=Supabase Auth）。**現在のパスワードで再認証してから**変更する
 * （セッション乗っ取り時のアカウント奪取を防ぐ・security review 指摘）。dev はパスワード無しのため no-op。
 */
export async function changePasswordAction(currentPassword: string, newPassword: string): Promise<{ ok?: boolean; error?: string }> {
  const user = await requireUser();
  if (!newPassword || newPassword.length < 8) return { error: 'パスワードは8文字以上にしてください' };
  if (authMode === 'supabase') {
    if (!currentPassword) return { error: '現在のパスワードを入力してください' };
    const { supabaseServerClient } = await import('@/lib/data/supabase-server');
    const supabase = await supabaseServerClient();
    // 現在のパスワードで再認証（本人確認）。失敗すれば変更しない。
    const { error: reauthErr } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
    if (reauthErr) return { error: '現在のパスワードが正しくありません' };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error: error.message };
  }
  return { ok: true };
}

export async function signOutAction(): Promise<void> {
  if (authMode === 'supabase') await supabaseSignOut();
  else await signOut();
  redirect('/login');
}
