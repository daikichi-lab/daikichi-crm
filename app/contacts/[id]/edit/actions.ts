'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createContact, updateContact, uploadBusinessCard, setPrimaryContact } from '@/lib/data/dal';

type ContactPayload = {
  name: string;
  kana?: string;
  title?: string;
  department?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  is_primary?: boolean;
  extra?: Record<string, unknown>;
};

type CardInput = { front?: string; back?: string };

/** 既存担当者の更新 */
export async function updateContactAction(id: string, companyId: string | undefined, payload: ContactPayload, card?: CardInput) {
  await updateContact(id, payload);
  if (payload.is_primary) await setPrimaryContact(id);
  if (card?.front) await uploadBusinessCard(id, card.front, card.back);
  revalidatePath(`/contacts/${id}`);
  if (companyId) revalidatePath(`/companies/${companyId}`);
  redirect(`/contacts/${id}`);
}

/** 企業配下に新規担当者を作成 */
export async function createContactAction(companyId: string, payload: ContactPayload, card?: CardInput) {
  const res = await createContact(companyId, payload);
  const newId: string | undefined = res?.id;
  if (newId && payload.is_primary) await setPrimaryContact(newId);
  if (newId && card?.front) await uploadBusinessCard(newId, card.front, card.back);
  revalidatePath(`/companies/${companyId}`);
  if (newId) redirect(`/contacts/${newId}`);
  redirect(`/companies/${companyId}#contacts`);
}
