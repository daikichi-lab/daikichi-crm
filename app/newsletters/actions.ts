'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { saveNewsletterDraft, sendNewsletter, duplicateNewsletter, getNewsletterSegment } from '@/lib/data/dal';

export async function getSegmentAction(opts: {
  topics?: string[];
  status?: string;
  industry?: string;
  area?: string;
}): Promise<{ count: number; sample: { name: string; company: string; email: string }[] }> {
  const r = await getNewsletterSegment({
    topics: opts.topics,
    status: opts.status || undefined,
    industry: opts.industry || undefined,
    area: opts.area || undefined,
  });
  return { count: r.count ?? 0, sample: (r as any).sample ?? [] };
}

export async function duplicateNewsletterAction(id: string): Promise<{ id?: string; error?: string }> {
  const r = await duplicateNewsletter(id);
  revalidatePath('/newsletters');
  return r;
}

export async function saveNewsletterDraftAction(p: {
  id?: string;
  subject: string;
  body: string;
  topic_ids: string[];
  segment: { status?: string; industry?: string; area?: string };
}): Promise<{ id?: string; error?: string }> {
  const r = await saveNewsletterDraft({
    ...(p.id ? { id: p.id } : {}),
    subject: p.subject,
    body: p.body,
    topic_ids: p.topic_ids,
    segment: p.segment,
  });
  revalidatePath('/newsletters');
  return r;
}

export async function sendNewsletterAction(p: {
  id?: string;
  subject: string;
  body: string;
  topic_ids: string[];
  segment: { status?: string; industry?: string; area?: string };
}): Promise<void> {
  const r = await sendNewsletter({
    ...(p.id ? { id: p.id } : {}),
    subject: p.subject,
    body: p.body,
    topic_ids: p.topic_ids,
    segment: p.segment,
  });
  revalidatePath('/newsletters');
  const id = r && (r as any).id;
  if (id) redirect(`/newsletters/${id}`);
  redirect('/newsletters');
}
