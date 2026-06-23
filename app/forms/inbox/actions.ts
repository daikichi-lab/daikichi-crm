'use server';

import { revalidatePath } from 'next/cache';
import { importFormSubmission, discardFormSubmission } from '@/lib/data/dal';

export async function importSubmissionAction(id: string): Promise<{ company_id?: string; error?: string }> {
  const res = await importFormSubmission(id);
  revalidatePath('/forms/inbox');
  revalidatePath('/companies');
  return res ?? { error: 'unknown' };
}

export async function discardSubmissionAction(id: string): Promise<{ ok?: boolean; error?: string }> {
  const res = await discardFormSubmission(id);
  revalidatePath('/forms/inbox');
  return res ?? { ok: true };
}
