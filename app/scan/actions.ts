'use server';
import { revalidatePath } from 'next/cache';
import { detectDuplicateCompany, createCompanyWithContact, addContactToCompany, uploadBusinessCard } from '@/lib/data/dal';

type ScanContact = {
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  is_primary?: boolean;
  extra?: Record<string, unknown>;
};
type ScanCompany = {
  name: string;
  type?: string;
  industry?: string;
  area?: string;
  size?: string;
};

/** 重複候補の検出（社名・メール） */
export async function detectDuplicateAction(name: string, email?: string) {
  return detectDuplicateCompany(name, email);
}

/** 新規企業＋担当者を作成 */
export async function createCompanyWithContactAction(company: ScanCompany, contact: ScanContact, frontCard?: string) {
  const res = await createCompanyWithContact(company, contact);
  const contactId: string | undefined = res?.contact_id ?? res?.contact?.id;
  if (contactId && frontCard) await uploadBusinessCard(contactId, frontCard);
  revalidatePath('/companies');
  return res as { id?: string; company_id?: string; contact_id?: string; error?: string };
}

/** 既存企業に担当者を追加 */
export async function addContactToCompanyAction(companyId: string, contact: ScanContact, frontCard?: string) {
  const res = await addContactToCompany(companyId, contact);
  const contactId: string | undefined = res?.id ?? res?.contact_id;
  if (contactId && frontCard) await uploadBusinessCard(contactId, frontCard);
  revalidatePath(`/companies/${companyId}`);
  return res as { id?: string; error?: string };
}
