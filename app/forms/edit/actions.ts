'use server';

import { revalidatePath } from 'next/cache';
import { updateFormConfig } from '@/lib/data/dal';

export type FormConfigInput = {
  title?: string;
  intro?: string;
  consent?: string;
  submit_label?: string;
  done_title?: string;
  fields?: string[];
  notify_email?: string;
  auto_subscribe?: boolean;
  published?: boolean;
};

export async function saveFormConfigAction(p: FormConfigInput): Promise<{ ok?: boolean; error?: string }> {
  const res = await updateFormConfig(p);
  revalidatePath('/forms/edit');
  revalidatePath('/form');
  revalidatePath('/forms/inbox');
  return res?.error ? { error: res.error } : { ok: true };
}
