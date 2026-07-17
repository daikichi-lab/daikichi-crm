'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { softDeleteCompany, setPrimaryContact } from '@/lib/data/dal';

export async function softDeleteCompanyAction(id: string) {
  await softDeleteCompany(id);
  revalidatePath('/companies');
  redirect('/companies');
}

export async function setPrimaryContactAction(contactId: string, companyId: string) {
  await setPrimaryContact(contactId);
  revalidatePath(`/companies/${companyId}`);
}
