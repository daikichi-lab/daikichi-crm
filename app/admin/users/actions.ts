'use server';

import { revalidatePath } from 'next/cache';
import { inviteUser, setUserRole, setUserActive } from '@/lib/data/dal';

export async function inviteUserAction(name: string, email: string, role: string): Promise<{ ok?: boolean; error?: string }> {
  const e = email.trim();
  if (!e) return { error: 'メールアドレスを入力してください' };
  const res = await inviteUser(name.trim() || e, e, role);
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
