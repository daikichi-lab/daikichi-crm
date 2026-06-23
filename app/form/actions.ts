'use server';

import { submitPublicForm } from '@/lib/data/dal';

export type PublicFormInput = {
  type?: string;
  industry?: string;
  name?: string;
  contact?: string;
  kana?: string;
  email?: string;
  phone?: string;
  area?: string;
  size?: string;
  needs?: string[];
  offers?: string[];
  sns?: string;
  message?: string;
  newsletter?: boolean;
};

export async function submitPublicFormAction(p: PublicFormInput): Promise<{ ok?: boolean; error?: string }> {
  if (!p.name || !p.name.trim()) return { error: '会社名 / 屋号は必須です' };
  if (!p.contact || !p.contact.trim()) return { error: 'ご担当者名は必須です' };
  if (!p.email || !p.email.trim()) return { error: 'メールは必須です' };
  const res = await submitPublicForm(p as Record<string, unknown>);
  return res?.error ? { error: res.error } : { ok: true };
}
