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

/** 自分のパスワードを変更（本番=Supabase Auth の updateUser・自セッション）。dev はパスワード無しのため no-op。 */
export async function changePasswordAction(newPassword: string): Promise<{ ok?: boolean; error?: string }> {
  await requireUser();
  if (!newPassword || newPassword.length < 8) return { error: 'パスワードは8文字以上にしてください' };
  if (authMode === 'supabase') {
    const { supabaseServerClient } = await import('@/lib/data/supabase-server');
    const supabase = await supabaseServerClient();
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
