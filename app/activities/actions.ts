'use server';
import { revalidatePath } from 'next/cache';
import { recordActivity } from '@/lib/data/dal';

export async function recordActivityAction(p: { kind: string; company?: string; title: string; actor?: string }) {
  const r = await recordActivity(p);
  revalidatePath('/activities');
  return r;
}
