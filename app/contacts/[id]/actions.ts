'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { setPrimaryContact, softDeleteContact } from '@/lib/data/dal';

export async function setPrimaryContactAction(id: string, companyId?: string) {
  await setPrimaryContact(id);
  revalidatePath(`/contacts/${id}`);
  if (companyId) revalidatePath(`/companies/${companyId}`);
}

export async function softDeleteContactAction(id: string, companyId?: string) {
  await softDeleteContact(id);
  revalidatePath('/companies');
  if (companyId) revalidatePath(`/companies/${companyId}`);
  redirect(companyId ? `/companies/${companyId}` : '/companies');
}
