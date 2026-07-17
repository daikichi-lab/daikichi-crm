'use server';
import { revalidatePath } from 'next/cache';
import { createNote } from '@/lib/data/dal';
import { requireUser } from '@/lib/auth/session';

/** 議事録の手動取込（貼り付け/TXT）。全文から次アクション候補（先頭の箇条書き/行）を軽く抽出。 */
export async function importNoteAction(p: {
  title: string; company_id?: string; summary?: string; full_text?: string; next_actions?: string[];
}): Promise<{ id?: string; error?: string }> {
  await requireUser();
  if (!p.title?.trim()) return { error: 'タイトルは必須です' };
  const r = await createNote({
    title: p.title.trim(),
    company_id: p.company_id || undefined,
    summary: p.summary?.trim() || undefined,
    full_text: p.full_text?.trim() || undefined,
    next_actions: (p.next_actions ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 20),
    source: '手動取込',
  });
  revalidatePath('/notes');
  return r?.error ? { error: r.error } : { id: r.id };
}
