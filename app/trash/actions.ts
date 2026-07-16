'use server';

import { revalidatePath } from 'next/cache';
import { restoreCompany, restoreContact, purgeCompany } from '@/lib/data/dal';

export async function restoreCompanyAction(id: string): Promise<void> {
  await restoreCompany(id);
  revalidatePath('/trash');
  revalidatePath('/companies');
}

export async function restoreContactAction(id: string): Promise<void> {
  await restoreContact(id);
  revalidatePath('/trash');
}

export async function purgeCompanyAction(id: string): Promise<{ ok?: boolean; error?: string }> {
  const res = await purgeCompany(id);
  revalidatePath('/trash');
  return res ?? { ok: true };
}
