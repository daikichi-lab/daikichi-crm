'use server';

import { headers } from 'next/headers';
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
  _hp?: string; // ハニーポット（人間は空のまま。ボットが埋めると破棄）
};

/** リクエストヘッダから発信元IPを推定（Cloudflare/リバースプロキシ経由）。 */
async function clientIp(): Promise<string | undefined> {
  const h = await headers();
  const cf = h.get('cf-connecting-ip');
  if (cf) return cf;
  const xff = h.get('x-forwarded-for');
  return xff ? xff.split(',')[0].trim() : undefined;
}

export async function submitPublicFormAction(p: PublicFormInput): Promise<{ ok?: boolean; error?: string }> {
  if (!p.name || !p.name.trim()) return { error: '会社名 / 屋号は必須です' };
  if (!p.contact || !p.contact.trim()) return { error: 'ご担当者名は必須です' };
  if (!p.email || !p.email.trim()) return { error: 'メールは必須です' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email.trim())) return { error: 'メールの形式が正しくありません' };
  const res = await submitPublicForm(p as Record<string, unknown>, await clientIp());
  return res?.error ? { error: res.error } : { ok: true };
}
