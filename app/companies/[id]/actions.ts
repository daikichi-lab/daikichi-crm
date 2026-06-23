'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { softDeleteCompany, setPrimaryContact, createTask } from '@/lib/data/dal';

export async function softDeleteCompanyAction(id: string) {
  await softDeleteCompany(id);
  revalidatePath('/companies');
  redirect('/companies');
}

export async function setPrimaryContactAction(contactId: string, companyId: string) {
  await setPrimaryContact(contactId);
  revalidatePath(`/companies/${companyId}`);
}

export async function createCompanyTaskAction(companyId: string, title: string, dueDate: string) {
  await createTask({ company_id: companyId, title, due_date: dueDate || null, kind: '手動', source: 'manual' });
  revalidatePath(`/companies/${companyId}`);
}
