'use server';

import { redirect } from 'next/navigation';
import { devSignIn, signOut, supabaseSignIn, supabaseSignOut, supabaseResetPassword, authMode } from '@/lib/auth/session';

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  if (authMode === 'dev') {
    // dev: メールのみで解決（パスワードは検証しない・ローカル専用）
    const u = await devSignIn(email);
    if (!u) redirect('/login?e=notfound');
    redirect('/dashboard');
  }
  // 本番: Supabase Auth（メール+パスワード）
  if (!email || !password) redirect('/login?e=empty');
  const r = await supabaseSignIn(email, password);
  if (!r.ok) redirect('/login?e=badcreds');
  redirect('/dashboard');
}

export async function signOutAction(): Promise<void> {
  if (authMode === 'supabase') await supabaseSignOut();
  else await signOut();
  redirect('/login');
}

/** パスワードリセット要求（本番のみ実送信。dev は何もしない）。 */
export async function resetPasswordAction(formData: FormData): Promise<void> {
  const email = String(formData.get('email') || '').trim();
  if (authMode === 'supabase' && email) await supabaseResetPassword(email);
  // 情報漏洩防止のため、存在有無にかかわらず同じ結果へ
  redirect('/login?reset=sent');
}
