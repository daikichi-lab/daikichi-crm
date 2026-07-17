'use server';
import { revalidatePath } from 'next/cache';
import { updateNoteTodos, updateNoteSummary, addTagToCompany } from '@/lib/data/dal';
import { requireUser } from '@/lib/auth/session';

export async function updateNoteTodosAction(id: string, todos: string[]): Promise<void> {
  await updateNoteTodos(id, todos);
  revalidatePath(`/notes/${id}`);
  revalidatePath('/notes');
}

export async function updateNoteSummaryAction(id: string, summary: string): Promise<{ ok?: boolean; error?: string }> {
  await requireUser();
  const r = await updateNoteSummary(id, summary);
  revalidatePath(`/notes/${id}`);
  return r?.error ? { error: r.error } : { ok: true };
}

/** 議事録から検出した求/提タグを企業に追加（おすすめアクション）。 */
export async function addRecoTagAction(companyId: string, tag: string, side: 'need' | 'offer'): Promise<{ ok?: boolean; error?: string }> {
  await requireUser();
  if (!companyId) return { error: '会社に紐付いていない議事録です' };
  const r = await addTagToCompany(companyId, tag, side);
  revalidatePath(`/companies/${companyId}`);
  return r?.error ? { error: r.error } : { ok: true };
}
