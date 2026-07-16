'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { signOut } from '@/lib/auth/session';
import { updateMyProfile } from '@/lib/data/dal';

export async function updateMyProfileAction(name: string): Promise<{ ok?: boolean; error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: '表示名を入力してください' };
  const res = await updateMyProfile(trimmed);
  revalidatePath('/account');
  return res?.error ? { error: res.error } : { ok: true };
}

export async function signOutAction(): Promise<void> {
  await signOut();
  redirect('/login');
}
