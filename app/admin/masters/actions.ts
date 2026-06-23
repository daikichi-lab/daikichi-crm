'use server';

import { revalidatePath } from 'next/cache';
import { addTag, renameTag, mergeTags, addIndustry, addNewsletterTopic } from '@/lib/data/dal';

function ok(res: any) { return res?.error ? { error: res.error as string } : { ok: true }; }

export async function addTagAction(label: string): Promise<{ ok?: boolean; error?: string }> {
  const v = label.trim();
  if (!v) return { error: 'タグ名を入力してください' };
  const res = await addTag(v);
  revalidatePath('/admin/masters');
  return ok(res);
}

export async function renameTagAction(from: string, to: string): Promise<{ ok?: boolean; error?: string }> {
  const t = to.trim();
  if (!t) return { error: '新しいタグ名を入力してください' };
  const res = await renameTag(from, t);
  revalidatePath('/admin/masters');
  revalidatePath('/companies');
  return ok(res);
}

export async function mergeTagsAction(from: string, to: string): Promise<{ ok?: boolean; error?: string }> {
  if (!from || !to || from === to) return { error: '統合元と統合先を指定してください' };
  const res = await mergeTags(from, to);
  revalidatePath('/admin/masters');
  revalidatePath('/companies');
  return ok(res);
}

export async function addIndustryAction(label: string): Promise<{ ok?: boolean; error?: string }> {
  const v = label.trim();
  if (!v) return { error: '業種名を入力してください' };
  const res = await addIndustry(v);
  revalidatePath('/admin/masters');
  return ok(res);
}

export async function addNewsletterTopicAction(label: string): Promise<{ ok?: boolean; error?: string }> {
  const v = label.trim();
  if (!v) return { error: 'トピック名を入力してください' };
  const res = await addNewsletterTopic(v);
  revalidatePath('/admin/masters');
  return ok(res);
}
