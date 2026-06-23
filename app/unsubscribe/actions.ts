'use server';

import { updateSubscription, unsubscribeAll } from '@/lib/data/dal';

export async function updateSubscriptionAction(token: string, topics: string[]): Promise<{ ok?: boolean; error?: string }> {
  if (!token) return { error: 'リンクが無効です' };
  const res = await updateSubscription(token, topics);
  return res?.error ? { error: res.error } : { ok: true };
}

export async function unsubscribeAllAction(token: string): Promise<{ ok?: boolean; error?: string }> {
  if (!token) return { error: 'リンクが無効です' };
  const res = await unsubscribeAll(token);
  return res?.error ? { error: res.error } : { ok: true };
}
