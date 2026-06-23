'use server';

import { redirect } from 'next/navigation';
import { devSignIn, signOut, authMode } from '@/lib/auth/session';

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get('email') || '').trim();
  if (authMode === 'dev') {
    const u = await devSignIn(email);
    if (!u) redirect('/login?e=notfound');
    redirect('/dashboard');
  }
  // 本番(Supabase Auth)はここで supabase.auth.signInWithPassword に置換。
  redirect('/login?e=supabase');
}

export async function signOutAction(): Promise<void> {
  await signOut();
  redirect('/login');
}
